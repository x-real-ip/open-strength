import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UserError } from '../i18n.ts';
import { getExercise } from '../services/exercises.ts';
import { getPreferences, loadPrefs, setPreference } from '../services/exercisePrefs.ts';
import { getProfile } from '../services/profile.ts';
import { generateProgram } from '../services/programGenerator.ts';
import { explainProgram } from '../services/programExplain.ts';
import { activeProgramId, exerciseAlternatives, getProgramExercise, loadProgram, replaceExercise, saveProgram, setTargetWeight } from '../services/programs.ts';
import { all } from '../db.ts';

async function requireProfile() {
  const profile = await getProfile();
  if (!profile) throw new UserError(409, 'Create your profile first', 'Maak eerst je profiel aan');
  return profile;
}

export async function programRoutes(app: FastifyInstance) {
  app.get('/api/programs/active', async () => {
    const id = await activeProgramId();
    const profile = await getProfile();
    const program = id ? await loadProgram(id, profile) : null;
    return { program, explanation: program ? explainProgram(program, profile) : [] };
  });

  app.get('/api/programs', async () => ({
    programs: await all('SELECT id, name, rounds, source, status, created_at AS "createdAt" FROM programs ORDER BY id DESC'),
  }));

  app.get('/api/programs/:id', async (req) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
    const program = await loadProgram(id, await getProfile());
    if (!program) throw new UserError(404, 'Program not found', 'Programma niet gevonden');
    return { program };
  });

  // Generate a new program (AI if configured, otherwise rule-based) and make it active.
  // Passing instructions turns this into "adjust my current program".
  app.post('/api/programs/generate', async (req) => {
    const body = z
      .object({ instructions: z.string().max(2000).optional(), useAi: z.boolean().optional(), basedOnCurrent: z.boolean().optional() })
      .parse(req.body ?? {});
    const profile = await requireProfile();
    const currentId = await activeProgramId();
    const current = body.basedOnCurrent && currentId ? await loadProgram(currentId, profile) : null;
    const { draft, notice } = await generateProgram(profile, { current, instructions: body.instructions, useAi: body.useAi });
    const id = await saveProgram(draft, profile);
    return { program: await loadProgram(id, profile), notice };
  });

  app.get('/api/exercise-preferences', async () => getPreferences());

  app.put('/api/exercise-preferences', async (req) => {
    const { exerciseId, preference } = z
      .object({ exerciseId: z.string().min(1).max(200), preference: z.enum(['favorite', 'excluded']).nullable() })
      .strict()
      .parse(req.body);
    return setPreference(exerciseId, preference, await getProfile());
  });

  app.get('/api/program-exercises/:id/alternatives', async (req) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
    return { alternatives: await exerciseAlternatives(id, await requireProfile(), await loadPrefs()) };
  });

  app.post('/api/program-exercises/:id/replace', async (req) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
    const { exerciseId } = z.object({ exerciseId: z.string() }).parse(req.body);
    if (!getExercise(exerciseId)) throw new UserError(400, 'Unknown exercise', 'Onbekende oefening');
    if ((await loadPrefs()).excluded.has(exerciseId)) throw new UserError(400, 'This exercise is set to "never use"', 'Deze oefening staat op "niet gebruiken"');
    const profile = await requireProfile();
    await replaceExercise(id, exerciseId, profile);
    const pe = (await getProgramExercise(id))!;
    return { program: await loadProgram(pe.program_id, profile) };
  });

  app.put('/api/program-exercises/:id/weight', async (req) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(req.params);
    const { weight } = z.object({ weight: z.number().min(0).max(1000) }).parse(req.body);
    const pe = await getProgramExercise(id);
    if (!pe) throw new UserError(404, 'Exercise not found', 'Oefening niet gevonden');
    await setTargetWeight(id, weight);
    return { program: await loadProgram(pe.program_id, await getProfile()) };
  });
}
