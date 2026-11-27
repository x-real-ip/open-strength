// Explains in plain Dutch how a program was put together, using the same rules that
// built it (programTemplates.ts, the AI validation in programGenerator.ts and the
// progression engine), so the program screen can show "why" without guesswork.
import type { Goal, MovementPattern, Profile, Program, ProgramExplanation } from '../../shared/types.ts';
import { getExercise } from './exercises.ts';
import { exercisesPerSession, scheme, supersetRest, useSupersets } from './programTemplates.ts';

const GOAL: Record<Goal, string> = {
  hypertrophy: 'spiermassa',
  strength: 'kracht',
  conditioning: 'conditie',
  fat_loss: 'vetverlies met behoud van spieren',
};

const PATTERN: Record<MovementPattern, string> = {
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
};

const LEVEL: Record<Profile['level'], string> = { beginner: 'beginner', intermediate: 'gevorderd', advanced: 'ervaren' };

const rest = (s: number) => (s % 60 === 0 ? `${s / 60} min` : s > 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min` : `${s} s`);
const range = (s: { sets: number; repMin: number; repMax: number }) => `${s.sets} × ${s.repMin}–${s.repMax}`;

export function explainProgram(program: Program, profile: Profile | null): ProgramExplanation[] {
  const out: ProgramExplanation[] = [];
  const days = program.days;
  const hasSupersets = days.some((d) => d.exercises.some((e) => e.superset));

  out.push(
    program.source === 'ai'
      ? {
          title: 'Wie het heeft gemaakt',
          text: [
            'De AI heeft dit programma ontworpen. Die kreeg je profiel, je apparatuur, de lijst met oefeningen die de app kent, je laatste trainingen en oefeningen die stagneren.',
            'De app controleert het antwoord voordat het wordt opgeslagen: onbekende of niet-beschikbare oefeningen worden vervangen of geschrapt, elke rep-range krijgt minstens twee herhalingen speling, en supersets mogen alleen tussen oefeningen die naast elkaar staan. Is het antwoord onbruikbaar, dan komt er een regelgebaseerd programma.',
            ...(program.rationale ? [`Toelichting van de AI: ${program.rationale}`] : []),
          ],
        }
      : {
          title: 'Wie het heeft gemaakt',
          text: [
            'De app heeft dit programma met vaste regels opgebouwd uit je profiel (er is geen AI ingesteld, of het AI-antwoord was onbruikbaar). Dezelfde profielgegevens geven daardoor altijd hetzelfde programma.',
          ],
        },
  );

  out.push({
    title: 'Schema',
    text: [
      `${days.length} trainingsdag${days.length === 1 ? '' : 'en'}: ${days.map((d) => d.name).join(', ')}. Ze wisselen elkaar af; na ${days[days.length - 1]?.name ?? 'de laatste'} begin je weer bij ${days[0]?.name ?? 'de eerste'}.`,
      `Een week telt ${days.length} training${days.length === 1 ? '' : 'en'}, een blok duurt ${program.weeks} weken. De week gaat pas verder als je de trainingen echt gedaan hebt, dus een gemiste dag schuift het schema op in plaats van over te slaan.`,
    ],
  });

  if (profile) {
    const perSession = exercisesPerSession(profile.sessionMinutes);
    out.push({
      title: 'Oefeningen per training',
      text: [
        `Je hebt ${profile.sessionMinutes} minuten per training; daar passen ongeveer ${perSession} oefeningen in.` +
          (useSupersets(profile.sessionMinutes)
            ? ' Omdat de trainingen kort zijn, worden oefeningen die elkaar niet in de weg zitten gekoppeld tot supersets (duwen met trekken, benen met bovenlichaam): één set van elk, dan rust.'
            : ''),
        ...(program.source === 'template'
          ? [
              'Elke trainingsdag heeft een vaste volgorde van bewegingspatronen, de belangrijkste eerst. Per patroon kiest de app de eerste oefening uit de bibliotheek die met jouw apparatuur kan, en oefeningen met gewicht gaan voor oefeningen met lichaamsgewicht.',
            ]
          : []),
      ],
      bullets: days.map(
        (d) =>
          `${d.name}: ${d.exercises
            .map((e) => {
              const pattern = getExercise(e.exerciseId)?.pattern;
              return `${e.name}${pattern ? ` (${PATTERN[pattern]})` : ''}`;
            })
            .join(', ')}`,
      ),
    });

    const compound = scheme(profile.goal, true, profile.level);
    const isolation = scheme(profile.goal, false, profile.level);
    out.push({
      title: 'Sets, herhalingen en rust',
      text: [
        `Je doel is ${GOAL[profile.goal]}, je niveau ${LEVEL[profile.level]}. ${
          program.source === 'template' ? 'Daarbij horen deze voorschriften:' : 'Als richtlijn gebruikt de app bij dat doel:'
        }`,
      ],
      bullets: [
        `Samengestelde oefeningen (meerdere gewrichten, zoals squat en bankdrukken): ${range(compound)} herhalingen, ${rest(compound.restSeconds)} rust.`,
        `Isolatie-oefeningen (één gewricht, zoals een curl): ${range(isolation)} herhalingen, ${rest(isolation.restSeconds)} rust.`,
        ...(hasSupersets ? [`In een superset geldt de rust na de hele ronde: ${rest(supersetRest(profile.goal))}.`] : []),
        'Elke rep-range heeft speling (bijvoorbeeld 8–12): zo kun je eerst herhalingen toevoegen en pas daarna gewicht.',
      ],
    });
  }

  out.push({
    title: 'Startgewichten',
    text: ['Het eerste gewicht per oefening komt uit de beste bron die er is, in deze volgorde:'],
    bullets: [
      'Je vorige programma, als je deze oefening daar met dezelfde herhalingen deed: het opgebouwde gewicht gaat mee.',
      'Je laatste training met deze oefening, omgerekend via je geschatte 1RM naar de nieuwe herhalingen.',
      'Anders een voorzichtige schatting op basis van lichaamsgewicht en niveau. Een voorstel van de AI wordt daarbij begrensd, zodat het nooit absurd zwaar of licht is.',
    ],
  });

  out.push({
    title: 'Hoe de gewichten veranderen',
    text: ['Na elke training berekent de app per oefening het volgende doel. Dat doet een vaste rekenregel (double progression), nooit de AI:'],
    bullets: [
      'Haal je in alle sets de bovenkant van de range zonder tot falen te gaan, dan gaat het gewicht één stap omhoog (twee bij ruim te licht). Je bouwt daarna weer op vanaf de onderkant.',
      'Lukt dat nog niet, dan blijft het gewicht gelijk en mik je op één herhaling meer per set.',
      'Zit je twee trainingen op rij onder het minimum, of is het duidelijk te zwaar, dan gaat het gewicht ongeveer 10% omlaag.',
      'Gewichtsstappen volgen je profiel (bijvoorbeeld 2,5 kg voor een barbell).',
    ],
  });

  out.push(
    program.deloadWeek
      ? {
          title: 'Deloadweek',
          text: [
            `Week ${program.deloadWeek} is een deloadweek: ongeveer 60% van de sets op 90% van je werkgewicht, om te herstellen. Die trainingen veranderen je doelen niet; de week erna ga je verder waar je was.`,
          ],
        }
      : {
          title: 'Deloadweek',
          text: ['Dit blok heeft geen deloadweek. Voor beginners is dat meestal niet nodig: de gewichten zijn nog licht genoeg om tussen trainingen volledig te herstellen.'],
        },
  );

  out.push({
    title: 'Na het blok',
    text: [
      `Na ${program.weeks} weken is het blok klaar en maak je het volgende. Je opgebouwde gewichten gaan mee. Stagnerende oefeningen worden gemeld, en met AI krijgt het volgende blok daar varianten voor.`,
    ],
  });

  return out;
}
