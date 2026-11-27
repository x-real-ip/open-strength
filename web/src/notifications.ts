// Rest notifications through Web Push. While the app is open the rest timer beeps by itself; when
// you switch away during a rest, the server is asked to push a notification when the rest ends
// (a web app gets no timers in the background). Coming back cancels that push.
import { useEffect } from 'react';
import { api } from './api.ts';

// Keeps the name from before the rename to Open Strength, so data already on devices survives.
const ENDPOINT_KEY = 'overload-push-endpoint';

export type PushSupport = 'supported' | 'unsupported' | 'install-first';

/** iPhone and iPad only allow web push for an app added to the home screen. */
export function pushSupport(): PushSupport {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !standalone) return 'install-first';
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window ? 'supported' : 'unsupported';
}

function storedEndpoint(): string | null {
  try {
    return localStorage.getItem(ENDPOINT_KEY);
  } catch {
    return null;
  }
}

function storeEndpoint(endpoint: string | null) {
  try {
    if (endpoint) localStorage.setItem(ENDPOINT_KEY, endpoint);
    else localStorage.removeItem(ENDPOINT_KEY);
  } catch {
    // The server still has the subscription; this device just forgets it is on.
  }
}

/** Whether this device has rest notifications on. */
export function notificationsOn(): boolean {
  return pushSupport() === 'supported' && Notification.permission === 'granted' && storedEndpoint() !== null;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Ask permission (must run from a tap) and register this device. Returns false when refused. */
export async function enableNotifications(): Promise<boolean> {
  if ((await Notification.requestPermission()) !== 'granted') return false;
  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await api.pushKey();
  const sub =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  await api.pushSubscribe(sub.toJSON());
  storeEndpoint(sub.endpoint);
  return true;
}

export async function disableNotifications(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.getSubscription();
  if (sub) {
    await api.pushUnsubscribe(sub.endpoint);
    await sub.unsubscribe();
  }
  storeEndpoint(null);
}

/** Fire-and-forget that survives the page being hidden or frozen right after. */
function send(method: 'POST' | 'DELETE', body?: unknown) {
  void fetch('/api/push/rest', {
    method,
    keepalive: true,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => undefined);
}

/**
 * While a rest runs: when the app goes to the background, schedule a push for the end of the rest;
 * when it comes back (or the rest ends or is skipped), cancel it.
 */
export function useRestNotification(endsAt: number | null, next?: string) {
  useEffect(() => {
    if (endsAt === null || !notificationsOn()) return;
    let scheduled = false;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && endsAt - Date.now() > 3000) {
        send('POST', { endsAt, next });
        scheduled = true;
      } else if (document.visibilityState === 'visible' && scheduled) {
        send('DELETE');
        scheduled = false;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (scheduled) send('DELETE');
    };
  }, [endsAt, next]);
}
