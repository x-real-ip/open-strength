// Web Push for the rest timer. A web app gets no timers while it is in the background (iOS stops it
// altogether), so when you switch away during a rest the app asks the server to push a notification
// at the moment the rest ends. Coming back first cancels it; the page then beeps by itself.
//
// The timer lives in memory: one replica, and a restart only loses a pending rest notification.
import webpush, { type PushSubscription } from 'web-push';
import type { Language } from '../../shared/types.ts';
import { config } from '../config.ts';
import { all, ensureSetting, nowIso, run } from '../db.ts';

interface Vapid {
  publicKey: string;
  privateKey: string;
}

/** Sends one push; replaceable in tests. Resolves with the HTTP status of the push service. */
export type PushSender = (subscription: PushSubscription, payload: string) => Promise<number>;

let vapid: Vapid | null = null;
let sender: PushSender = async (subscription, payload) => {
  const res = await webpush.sendNotification(subscription, payload, { TTL: 120, urgency: 'high' });
  return res.statusCode;
};

export function setPushSender(fn: PushSender) {
  sender = fn;
}

/** VAPID keys are made once and kept in the settings table; loaded on first use. */
async function ensurePush(): Promise<Vapid> {
  if (vapid) return vapid;
  const fresh = webpush.generateVAPIDKeys();
  vapid = JSON.parse(await ensureSetting('vapid', JSON.stringify(fresh))) as Vapid;
  // The subject identifies the sender to push services: the app's URL, or a mailto fallback.
  const subject = config.publicUrl.startsWith('https://') ? config.publicUrl : 'mailto:overload@localhost';
  webpush.setVapidDetails(subject, vapid.publicKey, vapid.privateKey);
  return vapid;
}

export async function publicKey(): Promise<string> {
  return (await ensurePush()).publicKey;
}

export async function saveSubscription(sub: PushSubscription): Promise<void> {
  await run(
    `INSERT INTO push_subscriptions (endpoint, keys, created_at) VALUES ($1, $2, $3)
     ON CONFLICT (endpoint) DO UPDATE SET keys = excluded.keys`,
    [sub.endpoint, JSON.stringify(sub.keys), nowIso()],
  );
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  await run('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

/** Push to every registered device; subscriptions the push service no longer knows are removed. */
export async function pushAll(message: { title: string; body: string; tag: string }): Promise<number> {
  await ensurePush();
  const subs = await all<{ endpoint: string; keys: PushSubscription['keys'] }>('SELECT endpoint, keys FROM push_subscriptions');
  let sent = 0;
  for (const s of subs) {
    try {
      await sender({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(message));
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await deleteSubscription(s.endpoint);
      else console.error('Push failed:', (err as Error).message);
    }
  }
  return sent;
}

let restTimer: NodeJS.Timeout | null = null;

/** Longest rest we schedule a push for; anything longer is not a rest timer. */
const MAX_REST_MS = 15 * 60 * 1000;

export function scheduleRest(endsAt: number, lang: Language, next?: string): boolean {
  cancelRest();
  const delay = endsAt - Date.now();
  if (delay > MAX_REST_MS) return false;
  restTimer = setTimeout(
    () => {
      restTimer = null;
      void pushAll({
        title: lang === 'nl' ? 'Rust voorbij' : 'Rest is over',
        body: next ? (lang === 'nl' ? `Volgende: ${next}` : `Next: ${next}`) : lang === 'nl' ? 'Tijd voor je volgende set.' : 'Time for your next set.',
        tag: 'rest',
      });
    },
    Math.max(0, delay),
  );
  return true;
}

export function cancelRest(): void {
  if (restTimer) clearTimeout(restTimer);
  restTimer = null;
}

export function restPending(): boolean {
  return restTimer !== null;
}
