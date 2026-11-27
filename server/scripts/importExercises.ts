// Imports the exercise list from the free-exercise-db fork and pins it to one commit:
//   npm run import:exercises            (latest commit on main)
//   npm run import:exercises -- <ref>   (branch, tag or commit)
// The result, server/data/free-exercise-db.json, is committed. The app never fetches the list
// at runtime; only the photos of these exercises are loaded from the fork, at the same commit.
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'x-real-ip/free-exercise-db';
const ref = process.argv[2] ?? 'main';
const out = path.resolve(import.meta.dirname, '../data/free-exercise-db.json');

async function get(url: string): Promise<any> {
  const res = await fetch(url, { headers: { 'user-agent': 'open-strength-import' } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

const commit = (await get(`https://api.github.com/repos/${REPO}/commits/${encodeURIComponent(ref)}`)).sha as string;
const exercises = (await get(`https://raw.githubusercontent.com/${REPO}/${commit}/dist/exercises.json`)) as { id: string }[];
exercises.sort((a, b) => a.id.localeCompare(b.id));

// One exercise per line keeps diffs of later imports readable.
const lines = exercises.map((e) => '    ' + JSON.stringify(e));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `{\n  "repo": "${REPO}",\n  "commit": "${commit}",\n  "exercises": [\n${lines.join(',\n')}\n  ]\n}\n`);
console.log(`Imported ${exercises.length} exercises from ${REPO}@${commit.slice(0, 7)}`);
