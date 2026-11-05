import type { CoachMessage, Profile } from '../../shared/types.ts';
import { aiConfigured } from '../config.ts';
import { all, nowIso, one, run } from '../db.ts';
import { complete } from './ai.ts';
import { activeProgramId, loadProgram } from './programs.ts';
import { detectStalls, getStats, historyDigest } from './stats.ts';
import { formatKg } from './weights.ts';

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

/** Facts computed from logged data. Used as AI context and as the offline answer. */
export async function trainingFacts(profile: Profile | null): Promise<string> {
  const stats = await getStats(8);
  const pid = await activeProgramId();
  const program = pid ? await loadProgram(pid, profile) : null;
  const stalls = await detectStalls();
  const recentWeeks = stats.weekly.slice(-4);
  const avgPerWeek = recentWeeks.reduce((a, w) => a + w.workouts, 0) / recentWeeks.length;
  const lines: string[] = [];

  lines.push(`Completed workouts: ${stats.totals.workouts}; sets: ${stats.totals.sets}; total volume: ${stats.totals.volumeKg} kg.`);
  lines.push(`Average workouts per week (last 4 weeks): ${avgPerWeek.toFixed(1)}${profile ? ` (planned: ${profile.daysPerWeek})` : ''}.`);
  lines.push(`Weekly volume (kg), oldest to newest: ${stats.weekly.map((w) => w.volumeKg).join(', ')}.`);
  if (stats.muscles.length) {
    lines.push(`Sets per week per muscle group, last 4 weeks (previous 4 weeks): ${stats.muscles.map((m) => `${m.muscle} ${m.setsPerWeekRecent} (${m.setsPerWeekPrevious})`).join(', ')}.`);
  }
  if (program) {
    lines.push(`Active program: "${program.name}", week ${program.currentWeek} of ${program.weeks}${program.deloadWeek ? `, deload in week ${program.deloadWeek}` : ''}${program.isComplete ? ' (completed)' : ''}.`);
    for (const d of program.days) {
      lines.push(`  ${d.name}: ${d.exercises.map((e) => `${e.name} ${e.sets}x${e.repMin}-${e.repMax}${e.target ? ` next ${e.loadType === 'bodyweight' ? 'bodyweight' : formatKg(e.target.weight)} (${e.target.decision})` : ''}`).join('; ')}`);
    }
  }
  lines.push(stalls.length ? `Stalling exercises: ${stalls.map((s) => `${s.name} (no improvement for ${s.sessions} sessions)`).join(', ')}.` : 'No stalling exercises detected.');
  return lines.join('\n');
}

async function systemPrompt(profile: Profile | null): Promise<string> {
  return `You are a knowledgeable, direct strength coach inside a training app. You analyse the user's logged training data and give practical advice about progression, training load, recovery and program design.

Rules:
- Base every statement about the user's progress on the data below. If the data is insufficient, say so instead of guessing.
- You do not set training weights. Next-session weights are calculated by the app's progression engine from logged sets (double progression). Explain those recommendations when asked, but never invent different numbers.
- If the program should change (exercise swaps, volume, split), say what you would change and why, and tell the user they can tap "Adjust program" to have the app rebuild it with that request.
- Keep answers concise and structured for a phone screen: short paragraphs or a few bullets.
- Not a medical professional: for pain or injury, advise seeing a physiotherapist or doctor.
- Reply in the same language as the user's latest message.

USER PROFILE
${profile ? `Age ${profile.age}, ${profile.heightCm} cm, ${profile.weightKg} kg, ${profile.level}, goal: ${profile.goal}, ${profile.daysPerWeek} days/week, ${profile.sessionMinutes} min/session. Limitations: ${profile.limitations || 'none'}.` : 'No profile yet.'}

TRAINING SUMMARY
${await trainingFacts(profile)}

RECENT SESSIONS PER EXERCISE (weight x reps)
${await historyDigest(5)}`;
}

async function offlineAnswer(profile: Profile | null): Promise<string> {
  return `AI coaching is not configured on the server, so here are the facts from your logged training:\n\n${await trainingFacts(profile)}\n\nAdd an AI API key to get a written analysis and answers to your questions.`;
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
      reply = await complete({ system: await systemPrompt(profile), messages: history, maxTokens: 1500 });
    } catch (err) {
      // Remove the unanswered question so a retry does not leave two user turns in a row.
      await run('DELETE FROM coach_messages WHERE id = $1', [user.id]);
      throw err;
    }
  }
  const assistant = await addMessage('assistant', reply.trim());
  return [user, assistant];
}
