import { useState, type FormEvent } from 'react';
import type { AppInfo } from '@shared/types.ts';
import { api } from '../api.ts';

const LOGIN_ERRORS: Record<string, string> = {
  expired: 'The sign-in took too long. Try again.',
  failed: 'Sign-in failed. Try again, or check the server logs.',
  forbidden: 'Your account is not allowed to use this app.',
};

export default function LoginPage({ info, onSuccess }: { info: AppInfo; onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(() => {
    const code = new URLSearchParams(location.search).get('login_error');
    return code ? LOGIN_ERRORS[code] ?? 'Sign-in failed.' : null;
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page no-nav">
      <div className="center-screen">
        <div className="stack" style={{ width: '100%', maxWidth: 360 }}>
          <h1 style={{ fontSize: 56 }}>Overload</h1>

          {info.authMode === 'password' && (
            <form className="stack" onSubmit={submit}>
              <label className="field">
                <span>Password</span>
                <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              </label>
              {error && <p className="error">{error}</p>}
              <button className="btn primary big block" disabled={busy || !password}>
                Sign in
              </button>
            </form>
          )}

          {info.authMode === 'oidc' && (
            <>
              {error && <p className="error">{error}</p>}
              <a className="btn primary big block" href="/api/auth/oidc/login">
                Sign in with {info.oidcProviderName}
              </a>
            </>
          )}

          {info.authMode === 'proxy' && (
            <>
              <p className="muted">
                No signed-in user was passed by the sign-in proxy. Open the app through your {info.oidcProviderName} address, or check that your account is allowed.
              </p>
              <button className="btn block" onClick={() => location.reload()}>
                Try again
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
