import type { CoachMessage, Profile } from '../../shared/types.ts';
import { aiConfigured } from './aiSettings.ts';
import { all, nowIso, one, run } from '../db.ts';
import { complete } from './ai.ts';
import { listBodyWeights } from './bodyWeight.ts';
import { activeProgramId, loadProgram } from './programs.ts';
import { detectStalls, getStats, historyDigest } from './stats.ts';
import { AI_LANGUAGE, formatKg, langOf, type Lang } from '../i18n.ts';

export async function listMessages(limit = 100): Promise<CoachMessage[]> {
  const rows = await all('SELECT * FROM coach_messages ORDER BY id DESC LIMIT $1', [limit]);
  return rows.reverse().map((r) => ({ id: r.id, role: r.role, content: r.content, createdAt: r.created_at }));
}

async function addMessage(role: 'user' | 'assistant', content: string): Promise<CoachMessage> {
  const ts = nowIso();
  const row = await one<{ id: number }>('INSERT INTO coach_messages (role, content, created_at) VALUES ($1, $2, $3) RETURNING id', [role, content, ts]);
  return { id: row!.id, role, content, createdAt: ts };
}

export async function clearMessages() {
  await run('DELETE FROM coach_messages');
}

/** Facts computed from logged data, in the profile's language. Used as AI context and as the offline answer. */
export async function trainingFacts(profile: Profile | null): Promise<string> {
  const lang: Lang = langOf(profile);
  const T = (en: string, nl: string) => (lang === 'nl' ? nl : en);
  const num = (n: number) => (lang === 'nl' ? n.toFixed(1).replace('.', ',') : n.toFixed(1));
  const stats = await getStats(8);
  const pid = await activeProgramId();
  const program = pid ? await loadProgram(pid, profile) : null;
  const stalls = await detectStalls(langOf(profile));
  const recentWeeks = stats.weekly.slice(-4);
  const avgPerWeek = recentWeeks.reduce((a, w) => a + w.workouts, 0) / recentWeeks.length;
  const lines: string[] = [];

  lines.push(
    T(
      `Completed workouts: ${stats.totals.workouts}; sets: ${stats.totals.sets}; total volume: ${stats.totals.volumeKg} kg.`,
      `Afgeronde trainingen: ${stats.totals.workouts}; sets: ${stats.totals.sets}; totaal volume: ${stats.totals.volumeKg} kg.`,
    ),
  );
  // Frequency varies on purpose; it is a fact to report, not a target to meet.
  lines.push(T(`Average workouts per week (last 4 weeks): ${num(avgPerWeek)}.`, `Gemiddeld aantal trainingen per week (laatste 4 weken): ${num(avgPerWeek)}.`));
  // Body weight trend: latest weigh-in and the change over roughly the last month.
  const weights = await listBodyWeights();
  if (weights.length) {
    const latest = weights[weights.length - 1];
    const monthAgo = new Date(Date.parse(latest.date) - 30 * 86_400_000).toISOString().slice(0, 10);
    const base = weights.find((w) => w.date >= monthAgo) ?? latest;
    const diff = Math.round((latest.weightKg - base.weightKg) * 10) / 10;
    const change = base === latest ? '' : T(` (${diff >= 0 ? '+' : ''}${formatKg(diff, lang)} since ${base.date})`, ` (${diff >= 0 ? '+' : ''}${formatKg(diff, lang)} sinds ${base.date})`);
    lines.push(T(`Body weight: ${formatKg(latest.weightKg, lang)} on ${latest.date}${change}.`, `Lichaamsgewicht: ${formatKg(latest.weightKg, lang)} op ${latest.date}${change}.`));
  }
  const weekly = stats.weekly.map((w) => w.volumeKg).join(', ');
  lines.push(T(`Volume per week (kg), oldest first: ${weekly}.`, `Volume per week (kg), oudste eerst: ${weekly}.`));
  if (stats.muscles.length) {
    const muscles = stats.muscles.map((m) => `${m.muscle} ${m.setsPerWeekRecent} (${m.setsPerWeekPrevious})`).join(', ');
    lines.push(T(`Sets per week per muscle group, last 4 weeks (the 4 weeks before): ${muscles}.`, `Sets per week per spiergroep, laatste 4 weken (4 weken daarvoor): ${muscles}.`));
  }
  if (program) {
    const deload = program.deloadFrom ? T(`, deload from workout ${program.deloadFrom}`, `, deload vanaf training ${program.deloadFrom}`) : '';
    const done = program.isComplete ? T(' (completed)', ' (afgerond)') : '';
    lines.push(
      T(
        `Active program: "${program.name}", next is workout ${program.workoutNumber} of ${program.totalWorkouts}, rotating through ${program.days.length} training days${deload}${done}.`,
        `Actief programma: "${program.name}", volgende is training ${program.workoutNumber} van ${program.totalWorkouts}, rouleert door ${program.days.length} trainingsdagen${deload}${done}.`,
      ),
    );
    for (const d of program.days) {
      const items = d.exercises.map((e) => {
        const next = e.target ? `${T(' next time', ' volgende keer')} ${e.loadType === 'bodyweight' ? T('bodyweight', 'lichaamsgewicht') : formatKg(e.target.weight, lang)} (${e.target.decision})` : '';
        return `${e.name} ${e.sets}x${e.repMin}-${e.repMax}${next}`;
      });
      lines.push(`  ${d.name}: ${items.join('; ')}`);
    }
  }
  const stallList = stalls.map((s) => `${s.name} (${T(`no progress in ${s.sessions} sessions`, `geen vooruitgang in ${s.sessions} trainingen`)})`).join(', ');
  lines.push(stalls.length ? T(`Stalling exercises: ${stallList}.`, `Stagnerende oefeningen: ${stallList}.`) : T('No stalling exercises.', 'Geen stagnerende oefeningen.'));
  return lines.join('\n');
}

async function systemPrompt(profile: Profile | null): Promise<string> {
  return `You are a knowledgeable, direct strength coach inside a training app. You analyse the user's logged training data and give practical advice about progression, training load, recovery and program design.

Rules:
- Base every statement about the user's progress on the data below. If the data is insufficient, say so instead of guessing.
- You do not set training weights. Next-session weights are calculated by the app's progression engine from logged sets (double progression). Explain those recommendations when asked, but never invent different numbers.
- If the program should change (exercise swaps, volume, split), say what you would change and why, and tell the user they can tap the button to adjust the program with this advice, so the app rebuilds it with that request.
- Keep answers concise and structured for a phone screen: short paragraphs or a few bullets.
- Not a medical professional: for pain or injury, advise seeing a physiotherapist or doctor.
- Reply in ${AI_LANGUAGE[langOf(profile)]} unless the user's latest message is clearly in another language.

USER PROFILE
${profile ? `Age ${profile.age}, ${profile.heightCm} cm, ${profile.weightKg} kg, ${profile.level}, goal: ${profile.goal}, ${profile.trainingDays} training days in rotation (frequency varies), ${profile.sessionMinutes} min/session. Limitations: ${profile.limitations || 'none'}.` : 'No profile yet.'}

TRAINING SUMMARY
${await trainingFacts(profile)}

RECENT SESSIONS PER EXERCISE (weight x reps)
${await historyDigest(5)}`;
}

async function offlineAnswer(profile: Profile | null): Promise<string> {
  const facts = await trainingFacts(profile);
  return langOf(profile) === 'nl'
    ? `AI staat uit, dus hier zijn de feiten uit je gelogde trainingen:\n\n${facts}\n\nZet AI aan via Profiel → AI-instellingen voor een geschreven analyse en antwoord op je vragen.`
    : `AI is off, so here are the facts from your logged workouts:\n\n${facts}\n\nTurn on AI in Profile → AI settings for a written analysis and answers to your questions.`;
}

export async function sendMessage(content: string, profile: Profile | null): Promise<CoachMessage[]> {
  const user = await addMessage('user', content.trim().slice(0, 4000));
  let reply: string;
  if (!aiConfigured()) {
    reply = await offlineAnswer(profile);
  } else {
    const history = (await listMessages(12)).map((m) => ({ role: m.role, content: m.content }));
    while (history.length && history[0].role !== 'user') history.shift();
    try {
      reply = await complete({ feature: 'coach', system: await systemPrompt(profile), messages: history, maxTokens: 4000 });
    } catch (err) {
      // Remove the unanswered question so a retry does not leave two user turns in a row.
      await run('DELETE FROM coach_messages WHERE id = $1', [user.id]);
      throw err;
    }
  }
  const assistant = await addMessage('assistant', reply.trim());
  return [user, assistant];
}
