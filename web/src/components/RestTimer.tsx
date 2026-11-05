import { useEffect, useRef, useState } from 'react';
import { clock } from '../format.ts';

export interface RestState {
  endsAt: number;
  duration: number;
}

const KEY = 'overload.rest';

export function loadRest(): RestState | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return r && typeof r.endsAt === 'number' ? r : null;
  } catch {
    return null;
  }
}

export function saveRest(r: RestState | null) {
  try {
    if (r) localStorage.setItem(KEY, JSON.stringify(r));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

let audio: AudioContext | null = null;

/** Must be called from a user gesture once so the beep can play later. */
export function primeAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    audio = null;
  }
}

function beep() {
  if (!audio) return;
  const t = audio.currentTime;
  [0, 0.22].forEach((offset) => {
    const osc = audio!.createOscillator();
    const gain = audio!.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t + offset);
    gain.gain.exponentialRampToValueAtTime(0.3, t + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.18);
    osc.connect(gain).connect(audio!.destination);
    osc.start(t + offset);
    osc.stop(t + offset + 0.2);
  });
}

export function RestTimer({ rest, onChange }: { rest: RestState; onChange: (r: RestState | null) => void }) {
  const [now, setNow] = useState(Date.now());
  const alerted = useRef(false);

  useEffect(() => {
    alerted.current = Date.now() >= rest.endsAt;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [rest.endsAt]);

  const remaining = (rest.endsAt - now) / 1000;
  const over = remaining <= 0;

  useEffect(() => {
    if (over && !alerted.current) {
      alerted.current = true;
      beep();
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [over]);

  // Hide the timer a few minutes after it ran out.
  useEffect(() => {
    if (remaining < -300) onChange(null);
  }, [remaining, onChange]);

  const pct = over ? 100 : Math.min(100, Math.max(0, 100 - (remaining / rest.duration) * 100));
  const adjust = (delta: number) => onChange({ endsAt: Math.max(Date.now(), rest.endsAt + delta * 1000), duration: Math.max(1, rest.duration + delta) });

  return (
    <div className={`rest ${over ? 'over' : ''}`} role="timer" aria-label="Rest timer">
      <div className="fill" style={{ width: `${pct}%` }} />
      <span className="time">{over ? `+${clock(-remaining)}` : clock(remaining)}</span>
      <span className="small muted">{over ? 'Rest done' : 'Rest'}</span>
      {!over && (
        <button type="button" onClick={() => adjust(15)} aria-label="Add 15 seconds">
          +15s
        </button>
      )}
      <button type="button" onClick={() => onChange(null)}>
        {over ? 'Hide' : 'Skip'}
      </button>
    </div>
  );
}
