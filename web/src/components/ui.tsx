import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import type { Decision } from '@shared/types.ts';
import { decisionLabel, versionLabel } from '../format.ts';
import { t } from '../i18n.ts';
import { IconCoach, IconExercises, IconProfile, IconProgram, IconProgress, IconToday } from './Icons.tsx';

/** Bottom tab bar on phones; a sidebar with the logo and version on wide screens (see styles.css). */
export function BottomNav({ version }: { version: string }) {
  const items = [
    { to: '/', label: t('Today', 'Vandaag'), icon: <IconToday /> },
    { to: '/program', label: t('Program', 'Programma'), icon: <IconProgram /> },
    { to: '/exercises', label: t('Exercises', 'Oefeningen'), icon: <IconExercises /> },
    { to: '/progress', label: t('Progress', 'Voortgang'), icon: <IconProgress /> },
    { to: '/coach', label: t('Coach', 'Coach'), icon: <IconCoach /> },
    { to: '/profile', label: t('Profile', 'Profiel'), icon: <IconProfile /> },
  ];
  return (
    <nav className="nav" aria-label={t('Main menu', 'Hoofdmenu')}>
      <div className="nav-brand" aria-hidden="true">
        OVERLOAD <span className="version">{versionLabel(version)}</span>
      </div>
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          {i.icon}
          {i.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function DecisionTag({ decision }: { decision: Decision }) {
  return <span className={`tag ${decision}`}>{decisionLabel(decision)}</span>;
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="grip" />
        {children}
      </div>
    </div>
  );
}

export function Loading() {
  return (
    <div className="center-screen">
      <div className="spinner" role="status" aria-label={t('Loading', 'Laden')} />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="center-screen">
      <div className="stack" style={{ justifyItems: 'center' }}>
        <p className="error">{message}</p>
        {onRetry && (
          <button className="btn" onClick={onRetry}>
            {t('Try again', 'Opnieuw proberen')}
          </button>
        )}
      </div>
    </div>
  );
}

let toastListener: ((msg: string) => void) | null = null;
export function toast(msg: string) {
  toastListener?.(msg);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    toastListener = (m) => {
      setMsg(m);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMsg(null), 2800);
    };
    return () => {
      toastListener = null;
      window.clearTimeout(timer);
    };
  }, []);
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}

/** Minimal data hook: load on mount, expose reload. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = () => {
    setLoading(true);
    setError(null);
    return loader()
      .then((d) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error, loading, reload, setData };
}
