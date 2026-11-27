// Explains in plain language how a program was put together, using the same rules that
// built it (programTemplates.ts, the AI validation in programGenerator.ts and the
// progression engine), so the program screen can show "why" without guesswork.
import type { Goal, MovementPattern, Profile, Program, ProgramExplanation } from '../../shared/types.ts';
import { formatKg, langOf } from '../i18n.ts';
import { getExercise } from './exercises.ts';
import { exercisesPerSession, scheme, supersetRest, useSupersets } from './programTemplates.ts';

const GOAL: Record<'en' | 'nl', Record<Goal, string>> = {
  en: { hypertrophy: 'muscle growth', strength: 'strength', conditioning: 'conditioning', fat_loss: 'fat loss while keeping muscle' },
  nl: { hypertrophy: 'spiermassa', strength: 'kracht', conditioning: 'conditie', fat_loss: 'vetverlies met behoud van spieren' },
};

const PATTERN: Record<'en' | 'nl', Record<MovementPattern, string>> = {
  en: {
    horizontal_push: 'horizontal push',
    vertical_push: 'vertical push',
    horizontal_pull: 'horizontal pull',
    vertical_pull: 'vertical pull',
    squat: 'squat',
    lunge: 'single leg',
    hinge: 'hip hinge',
    chest_iso: 'chest (isolation)',
    shoulder_iso: 'shoulders (isolation)',
    rear_delt: 'rear delts',
    quad_iso: 'quads (isolation)',
    hamstring_iso: 'hamstrings (isolation)',
    glute_iso: 'glutes',
    calf: 'calves',
    biceps: 'biceps',
    triceps: 'triceps',
    core: 'core',
  },
  nl: {
    horizontal_push: 'horizontaal duwen',
    vertical_push: 'verticaal duwen',
    horizontal_pull: 'horizontaal trekken',
    vertical_pull: 'verticaal trekken',
    squat: 'squat',
    lunge: 'één been',
    hinge: 'heupscharnier',
    chest_iso: 'borst (isolatie)',
    shoulder_iso: 'schouders (isolatie)',
    rear_delt: 'achterkant schouders',
    quad_iso: 'quadriceps (isolatie)',
    hamstring_iso: 'hamstrings (isolatie)',
    glute_iso: 'billen',
    calf: 'kuiten',
    biceps: 'biceps',
    triceps: 'triceps',
    core: 'core',
  },
};

const LEVEL: Record<'en' | 'nl', Record<Profile['level'], string>> = {
  en: { beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced' },
  nl: { beginner: 'beginner', intermediate: 'gevorderd', advanced: 'ervaren' },
};

const rest = (s: number) => (s % 60 === 0 ? `${s / 60} min` : s > 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min` : `${s} s`);
const range = (s: { sets: number; repMin: number; repMax: number }) => `${s.sets} × ${s.repMin}–${s.repMax}`;

export function explainProgram(program: Program, profile: Profile | null): ProgramExplanation[] {
  const lang = langOf(profile);
  const T = (en: string, nl: string) => (lang === 'nl' ? nl : en);
  const out: ProgramExplanation[] = [];
  const days = program.days;
  const n = days.length;
  const hasSupersets = days.some((d) => d.exercises.some((e) => e.superset));

  out.push(
    program.source === 'ai'
      ? {
          title: T('Who made it', 'Wie het heeft gemaakt'),
          text: [
            T(
              'The AI designed this program. It got your profile, your equipment, the list of exercises the app knows (with your favourites marked and the exercises you never want left out), your recent workouts and exercises that are stalling.',
              'De AI heeft dit programma ontworpen. Die kreeg je profiel, je apparatuur, de lijst met oefeningen die de app kent (met je favorieten gemarkeerd en zonder de oefeningen die je niet wilt), je laatste trainingen en oefeningen die stagneren.',
            ),
            T(
              'The app checks the answer before saving it: unknown, unavailable or excluded exercises are replaced or dropped, every rep range gets at least two reps of room, and supersets are only allowed between neighbouring exercises. If the answer is unusable, a rule-based program is made instead.',
              'De app controleert het antwoord voordat het wordt opgeslagen: onbekende, niet-beschikbare of uitgesloten oefeningen worden vervangen of geschrapt, elke rep-range krijgt minstens twee herhalingen speling, en supersets mogen alleen tussen oefeningen die naast elkaar staan. Is het antwoord onbruikbaar, dan komt er een regelgebaseerd programma.',
            ),
            ...(program.rationale ? [`${T('Notes from the AI', 'Toelichting van de AI')}: ${program.rationale}`] : []),
          ],
        }
      : {
          title: T('Who made it', 'Wie het heeft gemaakt'),
          text: [
            T(
              'The app built this program from your profile with fixed rules (no AI is set up, or the AI answer was unusable). The same profile and favourites always give the same program.',
              'De app heeft dit programma met vaste regels opgebouwd uit je profiel (er is geen AI ingesteld, of het AI-antwoord was onbruikbaar). Hetzelfde profiel en dezelfde favorieten geven daardoor altijd hetzelfde programma.',
            ),
          ],
        },
  );

  const names = days.map((d) => d.name).join(', ');
  const first = days[0]?.name ?? T('the first', 'de eerste');
  const last = days[n - 1]?.name ?? T('the last', 'de laatste');
  out.push({
    title: T('Schedule', 'Schema'),
    text: [
      T(
        `${n} training day${n === 1 ? '' : 's'}: ${names}. They alternate; after ${last} you start again at ${first}.`,
        `${n} trainingsdag${n === 1 ? '' : 'en'}: ${names}. Ze wisselen elkaar af; na ${last} begin je weer bij ${first}.`,
      ),
      T(
        `A week has ${n} workout${n === 1 ? '' : 's'} and a block lasts ${program.weeks} weeks. The week only moves on when you have actually done the workouts, so a missed day shifts the schedule instead of being skipped.`,
        `Een week telt ${n} training${n === 1 ? '' : 'en'}, een blok duurt ${program.weeks} weken. De week gaat pas verder als je de trainingen echt gedaan hebt, dus een gemiste dag schuift het schema op in plaats van over te slaan.`,
      ),
    ],
  });

  if (profile) {
    const perSession = exercisesPerSession(profile.sessionMinutes);
    out.push({
      title: T('Exercises per session', 'Oefeningen per training'),
      text: [
        T(
          `You have ${profile.sessionMinutes} minutes per session; about ${perSession} exercises fit in that.`,
          `Je hebt ${profile.sessionMinutes} minuten per training; daar passen ongeveer ${perSession} oefeningen in.`,
        ) +
          (useSupersets(profile.sessionMinutes)
            ? T(
                ' Because sessions are short, exercises that do not get in each other’s way are paired into supersets (push with pull, legs with upper body): one set of each, then rest.',
                ' Omdat de trainingen kort zijn, worden oefeningen die elkaar niet in de weg zitten gekoppeld tot supersets (duwen met trekken, benen met bovenlichaam): één set van elk, dan rust.',
              )
            : ''),
        ...(program.source === 'template'
          ? [
              T(
                'Each training day has a fixed order of movement patterns, the most important first. Per pattern the app takes one of your favourites if it fits your equipment; otherwise the first exercise from its core list that does, with loaded exercises ahead of bodyweight ones. Exercises you never want are skipped.',
                'Elke trainingsdag heeft een vaste volgorde van bewegingspatronen, de belangrijkste eerst. Per patroon neemt de app een van je favorieten als die met jouw apparatuur kan; anders de eerste oefening uit de vaste lijst die kan, en oefeningen met gewicht gaan voor oefeningen met lichaamsgewicht. Oefeningen die je niet wilt, worden overgeslagen.',
              ),
            ]
          : []),
      ],
      bullets: days.map(
        (d) =>
          `${d.name}: ${d.exercises
            .map((e) => {
              const pattern = getExercise(e.exerciseId)?.pattern;
              return `${e.name}${pattern ? ` (${PATTERN[lang][pattern]})` : ''}`;
            })
            .join(', ')}`,
      ),
    });

    const compound = scheme(profile.goal, true, profile.level);
    const isolation = scheme(profile.goal, false, profile.level);
    out.push({
      title: T('Sets, reps and rest', 'Sets, herhalingen en rust'),
      text: [
        T(
          `Your goal is ${GOAL.en[profile.goal]}, your level ${LEVEL.en[profile.level]}. ${program.source === 'template' ? 'These prescriptions go with that:' : 'As a guideline the app uses, for that goal:'}`,
          `Je doel is ${GOAL.nl[profile.goal]}, je niveau ${LEVEL.nl[profile.level]}. ${program.source === 'template' ? 'Daarbij horen deze voorschriften:' : 'Als richtlijn gebruikt de app bij dat doel:'}`,
        ),
      ],
      bullets: [
        T(
          `Compound exercises (several joints, like squats and bench press): ${range(compound)} reps, ${rest(compound.restSeconds)} rest.`,
          `Samengestelde oefeningen (meerdere gewrichten, zoals squat en bankdrukken): ${range(compound)} herhalingen, ${rest(compound.restSeconds)} rust.`,
        ),
        T(
          `Isolation exercises (one joint, like a curl): ${range(isolation)} reps, ${rest(isolation.restSeconds)} rest.`,
          `Isolatie-oefeningen (één gewricht, zoals een curl): ${range(isolation)} herhalingen, ${rest(isolation.restSeconds)} rust.`,
        ),
        ...(hasSupersets
          ? [T(`In a superset the rest comes after the whole round: ${rest(supersetRest(profile.goal))}.`, `In een superset geldt de rust na de hele ronde: ${rest(supersetRest(profile.goal))}.`)]
          : []),
        T(
          'Every rep range has room (for example 8–12): you add reps first and weight after that.',
          'Elke rep-range heeft speling (bijvoorbeeld 8–12): zo kun je eerst herhalingen toevoegen en pas daarna gewicht.',
        ),
      ],
    });
  }

  out.push({
    title: T('Starting weights', 'Startgewichten'),
    text: [T('The first weight for each exercise comes from the best source available, in this order:', 'Het eerste gewicht per oefening komt uit de beste bron die er is, in deze volgorde:')],
    bullets: [
      T(
        'Your previous program, if you did this exercise there with the same reps: the weight you built up carries over.',
        'Je vorige programma, als je deze oefening daar met dezelfde herhalingen deed: het opgebouwde gewicht gaat mee.',
      ),
      T(
        'Your last session with this exercise, converted to the new reps through your estimated 1RM.',
        'Je laatste training met deze oefening, omgerekend via je geschatte 1RM naar de nieuwe herhalingen.',
      ),
      T(
        'Otherwise a careful estimate based on body weight and level. An AI suggestion is capped, so it is never absurdly heavy or light.',
        'Anders een voorzichtige schatting op basis van lichaamsgewicht en niveau. Een voorstel van de AI wordt daarbij begrensd, zodat het nooit absurd zwaar of licht is.',
      ),
    ],
  });

  out.push({
    title: T('How weights change', 'Hoe de gewichten veranderen'),
    text: [
      T(
        'After every workout the app works out the next target for each exercise. A fixed rule does that (double progression), never the AI:',
        'Na elke training berekent de app per oefening het volgende doel. Dat doet een vaste rekenregel (double progression), nooit de AI:',
      ),
    ],
    bullets: [
      T(
        'Reach the top of the range in all sets without going to failure and the weight goes up one step (two if it was clearly too light). You then build up again from the bottom of the range.',
        'Haal je in alle sets de bovenkant van de range zonder tot falen te gaan, dan gaat het gewicht één stap omhoog (twee bij ruim te licht). Je bouwt daarna weer op vanaf de onderkant.',
      ),
      T('Not there yet? The weight stays and you aim for one more rep per set.', 'Lukt dat nog niet, dan blijft het gewicht gelijk en mik je op één herhaling meer per set.'),
      T(
        'Below the minimum two sessions in a row, or clearly too heavy, and the weight drops by about 10%.',
        'Zit je twee trainingen op rij onder het minimum, of is het duidelijk te zwaar, dan gaat het gewicht ongeveer 10% omlaag.',
      ),
      T(
        `Weight steps follow your profile (for example ${formatKg(2.5, 'en')} for a barbell).`,
        `Gewichtsstappen volgen je profiel (bijvoorbeeld ${formatKg(2.5, 'nl')} voor een barbell).`,
      ),
    ],
  });

  out.push(
    program.deloadWeek
      ? {
          title: T('Deload week', 'Deloadweek'),
          text: [
            T(
              `Week ${program.deloadWeek} is a deload week: about 60% of the sets at 90% of your working weight, to recover. Those workouts do not change your targets; the week after, you continue where you were.`,
              `Week ${program.deloadWeek} is een deloadweek: ongeveer 60% van de sets op 90% van je werkgewicht, om te herstellen. Die trainingen veranderen je doelen niet; de week erna ga je verder waar je was.`,
            ),
          ],
        }
      : {
          title: T('Deload week', 'Deloadweek'),
          text: [
            T(
              'This block has no deload week. Beginners usually do not need one: the weights are still light enough to recover fully between sessions.',
              'Dit blok heeft geen deloadweek. Voor beginners is dat meestal niet nodig: de gewichten zijn nog licht genoeg om tussen trainingen volledig te herstellen.',
            ),
          ],
        },
  );

  out.push({
    title: T('After the block', 'Na het blok'),
    text: [
      T(
        `After ${program.weeks} weeks the block is done and you make the next one. The weights you built up carry over. Stalling exercises are flagged, and with AI the next block gets variations for them.`,
        `Na ${program.weeks} weken is het blok klaar en maak je het volgende. Je opgebouwde gewichten gaan mee. Stagnerende oefeningen worden gemeld, en met AI krijgt het volgende blok daar varianten voor.`,
      ),
    ],
  });

  return out;
}
