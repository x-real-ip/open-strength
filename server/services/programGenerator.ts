import { z } from 'zod';
import type { Profile, Program } from '../../shared/types.ts';
import { AI_LANGUAGE, langOf, pick, loc, type Lang } from '../i18n.ts';
import { aiConfigured } from './aiSettings.ts';
import { AiError, complete, extractJson, type ChatMessage } from './ai.ts';
import { alternativesFor, availableExercises, getExercise, isAvailable, NO_PREFS, type Prefs } from './exercises.ts';
import { loadPrefs } from './exercisePrefs.ts';
import { normalizeSupersets, type ProgramDraft } from './programs.ts';
import { buildTemplateProgram, exercisesPerSession, useSupersets } from './programTemplates.ts';
import { detectStalls, historyDigest } from './stats.ts';

const num = (min: number, max: number) => z.coerce.number().transform((v) => Math.min(max, Math.max(min, Math.round(v))));

const aiProgramSchema = z.object({
  name: z.string().min(1).max(120),
  weeks: num(3, 12),
  deloadWeek: z.union([z.coerce.number(), z.null()]).optional(),
  rationale: z.string().default(''),
  days: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        focus: z.string().default(''),
        exercises: z
          .array(
            z.object({
              exerciseId: z.string(),
              sets: num(1, 6),
              repMin: num(1, 30),
              repMax: num(1, 30),
              restSeconds: num(30, 300),
              startWeight: z.coerce.number().optional(),
              notes: z.string().optional(),
              superset: z.union([z.string().max(4), z.null()]).optional().catch(null),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

const GOAL_TEXT: Record<Profile['goal'], string> = {
  hypertrophy: 'muscle growth (hypertrophy)',
  strength: 'maximal strength',
  conditioning: 'general conditioning and work capacity',
  fat_loss: 'fat loss while keeping muscle',
};

function systemPrompt(lang: Lang): string {
  return [
    'You are an experienced, evidence-based strength coach who designs training programs.',
    'You reply with exactly one JSON object and nothing else.',
    `Write all human-readable text (name, focus, rationale, notes) in ${AI_LANGUAGE[lang]}.`,
  ].join(' ');
}

async function buildPrompt(profile: Profile, opts: { current?: Program | null; instructions?: string }, prefs: Prefs): Promise<string> {
  const catalogue = availableExercises(profile.equipment)
    .filter((e) => !prefs.excluded.has(e.id))
    .map(
      (e) =>
        `${prefs.favorites.has(e.id) ? '♥ ' : ''}${e.source === 'overload' ? '* ' : ''}${e.id} | ${e.name} | primary: ${e.primary} | pattern: ${e.pattern} | load: ${e.loadType}${e.weightNote ? ` (${e.weightNote})` : ''}`,
    )
    .join('\n');
  const stalls = await detectStalls();
  const history = await historyDigest(4);
  const current = opts.current
    ? opts.current.days
        .map((d) => `${d.name}: ${d.exercises.map((e) => `${e.name} [${e.exerciseId}] ${e.sets}x${e.repMin}-${e.repMax}${e.superset ? ` (superset ${e.superset})` : ''}`).join('; ')}`)
        .join('\n')
    : null;

  return `Design a training program for this person.

PROFILE
- Age: ${profile.age}, height: ${profile.heightCm} cm, body weight: ${profile.weightKg} kg
- Training level: ${profile.level}
- Goal: ${GOAL_TEXT[profile.goal]}
- Training days per week: ${profile.daysPerWeek}
- Time per session: ${profile.sessionMinutes} minutes (roughly ${exercisesPerSession(profile.sessionMinutes)} exercises)
- Limitations / points of attention: ${profile.limitations || 'none'}

ALLOWED EXERCISES (use only these ids; equipment is already filtered to what is available).
Ids marked * are the app's core exercises with a Dutch how-to guide: build the program mainly from those and use the others for variety or when they suit the person better.
${
    prefs.favorites.size
      ? "Ids marked ♥ are the person's favourites: use each favourite where it fits the split and the session length, in preference to other exercises for the same movement pattern.\n"
      : ''
  }${
    prefs.excluded.size
      ? `The person never wants these exercises; they are left out of the list and must not be used: ${[...prefs.excluded].map((id) => getExercise(id)?.name ?? id).join(', ')}.\n`
      : ''
  }${catalogue}

TRAINING HISTORY (most recent sessions per exercise, weight x reps)
${history}

${stalls.length ? `STALLING EXERCISES (no progress over 3+ sessions): ${stalls.map((s) => s.name).join(', ')}. Consider a variation or a different rep range for these.\n` : ''}${
    current ? `CURRENT PROGRAM\n${current}\n` : ''
  }${opts.instructions ? `REQUESTED CHANGES FROM THE USER\n${opts.instructions}\n` : ''}
RULES
- Exactly ${profile.daysPerWeek} day(s) in "days", in the order they should be trained.
- Spread muscle groups sensibly across the week and allow recovery between sessions that train the same muscles.
- Put compound lifts first, isolation work later.
- Weekly volume: roughly 10–20 hard sets per major muscle group for hypertrophy, fewer and heavier for strength; beginners start at the low end.
- Fit each session in the available time (count about 2–3 minutes per set including rest; about 1.5 minutes per set inside a superset).
${
  useSupersets(profile.sessionMinutes)
    ? `- Sessions are short, so pair exercises into supersets: give two exercises that do not compete for the same muscles (push with pull, or lower body with upper body) the same "superset" letter ("A", "B", …) and list them directly after each other. Each set of the first is followed by a set of the second, then rest. restSeconds on superset exercises is the rest after the round (60–120). A typical ${profile.sessionMinutes}-minute full-body day is 2–3 supersets.`
    : '- "superset": use null unless the user asks for supersets; then give two neighbouring, non-competing exercises the same letter.'
}
- Use rep ranges with at least 2 reps between repMin and repMax so double progression works (e.g. 8–12, 4–6, 10–15).
- restSeconds: 120–240 for heavy compounds, 60–120 for accessories.
- startWeight in kg: a conservative weight for the first session with 2–3 reps in reserve (per hand for dumbbells, 0 for bodyweight). These are only a first estimate; the app adjusts weights from logged results and overrides your estimate when history exists.
- Respect the limitations: avoid exercises that are likely to aggravate them and mention adaptations in notes.
- weeks between 4 and 8. For intermediate and advanced lifters set deloadWeek to the last week; otherwise null.
- notes: at most one short technique cue per exercise, or an empty string.

OUTPUT FORMAT (JSON only)
{
  "name": "short program name",
  "weeks": 6,
  "deloadWeek": 6,
  "rationale": "2–4 sentences explaining the split, volume and how it fits the goal and limitations",
  "days": [
    { "name": "Upper A", "focus": "chest, back, shoulders",
      "exercises": [ { "exerciseId": "barbell_bench_press", "sets": 3, "repMin": 6, "repMax": 10, "restSeconds": 150, "startWeight": 40, "notes": "", "superset": null } ] }
  ]
}`;
}

/** Validate and repair an AI program so it only contains usable, available exercises. */
export function sanitizeAiProgram(raw: unknown, profile: Profile, prefs: Prefs = NO_PREFS): ProgramDraft {
  const parsed = aiProgramSchema.parse(raw);
  if (parsed.days.length < profile.daysPerWeek) throw new AiError(`Expected ${profile.daysPerWeek} days, got ${parsed.days.length}`);

  const days = parsed.days.slice(0, profile.daysPerWeek).map((d) => {
    const used = new Set<string>();
    const exercises = d.exercises.flatMap((e) => {
      let def = getExercise(e.exerciseId);
      // Unavailable or excluded exercises are swapped for the best allowed alternative.
      if (def && (!isAvailable(def, profile.equipment) || prefs.excluded.has(def.id))) def = alternativesFor(def.id, profile.equipment, [...used], prefs)[0];
      if (!def || used.has(def.id)) return [];
      used.add(def.id);
      const repMin = Math.min(e.repMin, e.repMax);
      let repMax = Math.max(e.repMin, e.repMax);
      if (repMax - repMin < 2) repMax = Math.min(30, repMin + 2);
      return [
        { exerciseId: def.id, sets: e.sets, repMin, repMax, restSeconds: e.restSeconds, startWeight: e.startWeight, notes: (e.notes ?? '').slice(0, 200), superset: e.superset ?? null },
      ];
    });
    if (exercises.length === 0) throw new AiError(`Day "${d.name}" has no usable exercises`);
    // Dropped or replaced exercises can break a pair; normalizing removes half-empty supersets.
    return { name: d.name, focus: d.focus.slice(0, 120), exercises: normalizeSupersets(exercises) };
  });

  const deload = parsed.deloadWeek && parsed.deloadWeek >= 1 && parsed.deloadWeek <= parsed.weeks ? Math.round(parsed.deloadWeek) : null;
  return { name: parsed.name.slice(0, 80), weeks: parsed.weeks, deloadWeek: deload, source: 'ai', rationale: parsed.rationale.slice(0, 1500), days };
}

export interface GenerateResult {
  draft: ProgramDraft;
  notice: string | null;
}

export async function generateProgram(profile: Profile, opts: { current?: Program | null; instructions?: string; useAi?: boolean } = {}): Promise<GenerateResult> {
  const prefs = await loadPrefs();
  const lang = langOf(profile);
  if (opts.useAi === false || !aiConfigured()) {
    return {
      draft: buildTemplateProgram(profile, prefs),
      notice: aiConfigured()
        ? null
        : pick(
            loc(
              'AI is off, so a rule-based program was made. Turn on AI in Profile → AI settings to have programs designed by the AI.',
              'AI staat uit, dus er is een regelgebaseerd programma gemaakt. Zet AI aan via Profiel → AI-instellingen om programma’s door de AI te laten ontwerpen.',
            ),
            lang,
          ),
    };
  }

  const prompt = await buildPrompt(profile, opts, prefs);
  let lastError = '';
  let lastText = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
    if (attempt > 0 && lastText) {
      messages.push({ role: 'assistant', content: lastText.slice(0, 12000) });
      messages.push({ role: 'user', content: `That answer was rejected: ${lastError}. Reply again with one valid JSON object that follows all rules.` });
    }
    try {
      lastText = '';
      const text = await complete({ feature: 'program', system: systemPrompt(lang), messages, maxTokens: 16000, json: true });
      lastText = text;
      return { draft: sanitizeAiProgram(extractJson(text), profile, prefs), notice: null };
    } catch (err) {
      lastError = err instanceof z.ZodError ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : (err as Error).message;
      if (err instanceof AiError && err.status >= 503) break; // not configured or timed out: don't retry
    }
  }
  return {
    draft: buildTemplateProgram(profile, prefs),
    notice:
      lang === 'nl'
        ? `Het AI-programma was niet bruikbaar (${lastError.slice(0, 160)}). Er is een regelgebaseerd programma gemaakt.`
        : `The AI program was not usable (${lastError.slice(0, 160)}). A rule-based program was made instead.`,
  };
}
