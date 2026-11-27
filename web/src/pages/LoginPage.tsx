import { useState, type FormEvent } from 'react';
import type { AppInfo } from '@shared/types.ts';
import { api } from '../api.ts';

const LOGIN_ERRORS: Record<string, string> = {
  expired: 'Het inloggen duurde te lang. Probeer het opnieuw.',
  failed: 'Inloggen is mislukt. Probeer het opnieuw, of kijk in de serverlogs.',
  forbidden: 'Je account heeft geen toegang tot deze app.',
};

export default function LoginPage({ info, onSuccess }: { info: AppInfo; onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(() => {
    const code = new URLSearchParams(location.search).get('login_error');
    return code ? LOGIN_ERRORS[code] ?? 'Inloggen is mislukt.' : null;
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
                <span>Wachtwoord</span>
                <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              </label>
              {error && <p className="error">{error}</p>}
              <button className="btn primary big block" disabled={busy || !password}>
                Inloggen
              </button>
            </form>
          )}

          {info.authMode === 'oidc' && (
            <>
              {error && <p className="error">{error}</p>}
              <a className="btn primary big block" href="/api/auth/oidc/login">
                Inloggen met {info.oidcProviderName}
              </a>
            </>
          )}

          {info.authMode === 'proxy' && (
            <>
              <p className="muted">
                De inlogproxy gaf geen ingelogde gebruiker door. Open de app via je {info.oidcProviderName}-adres, of controleer of je account toegang heeft.
              </p>
              <button className="btn block" onClick={() => location.reload()}>
                Opnieuw proberen
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
