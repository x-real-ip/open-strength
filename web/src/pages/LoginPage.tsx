import { useState, type FormEvent } from 'react';
import type { AppInfo } from '@shared/types.ts';
import { api } from '../api.ts';
import { t } from '../i18n.ts';

function loginError(code: string): string {
  switch (code) {
    case 'expired':
      return t('Signing in took too long. Try again.', 'Het inloggen duurde te lang. Probeer het opnieuw.');
    case 'failed':
      return t('Signing in failed. Try again, or check the server logs.', 'Inloggen is mislukt. Probeer het opnieuw, of kijk in de serverlogs.');
    case 'forbidden':
      return t('Your account has no access to this app.', 'Je account heeft geen toegang tot deze app.');
    default:
      return t('Signing in failed.', 'Inloggen is mislukt.');
  }
}

export default function LoginPage({ info, onSuccess }: { info: AppInfo; onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(() => {
    const code = new URLSearchParams(location.search).get('login_error');
    return code ? loginError(code) : null;
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
          <h1 style={{ fontSize: 56 }}>Open Strength</h1>

          {info.authMode === 'password' && (
            <form className="stack" onSubmit={submit}>
              <label className="field">
                <span>{t('Password', 'Wachtwoord')}</span>
                <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              </label>
              {error && <p className="error">{error}</p>}
              <button className="btn primary big block" disabled={busy || !password}>
                {t('Sign in', 'Inloggen')}
              </button>
            </form>
          )}

          {info.authMode === 'oidc' && (
            <>
              {error && <p className="error">{error}</p>}
              <a className="btn primary big block" href="/api/auth/oidc/login">
                {t(`Sign in with ${info.oidcProviderName}`, `Inloggen met ${info.oidcProviderName}`)}
              </a>
            </>
          )}

          {info.authMode === 'proxy' && (
            <>
              <p className="muted">
                {t(
                  `The login proxy did not pass on a signed-in user. Open the app through your ${info.oidcProviderName} address, or check that your account has access.`,
                  `De inlogproxy gaf geen ingelogde gebruiker door. Open de app via je ${info.oidcProviderName}-adres, of controleer of je account toegang heeft.`,
                )}
              </p>
              <button className="btn block" onClick={() => location.reload()}>
                {t('Try again', 'Opnieuw proberen')}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
