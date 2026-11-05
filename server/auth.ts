// Authentication. One user owns the data; these modes only decide who may get in.
//   none     open (fine behind a VPN)
//   password single shared password, signed session cookie
//   proxy    a forward-auth / reverse proxy (Authentik proxy outpost) sets the user header
//   oidc     native OpenID Connect login (Authentik OAuth2/OpenID provider)
import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import * as oidc from 'openid-client';
import { config } from './config.ts';
import { ensureSetting } from './db.ts';

export const SESSION_COOKIE = 'overload_session';
const OIDC_COOKIE = 'overload_oidc';

export interface SessionUser {
  username: string;
  email?: string;
  name?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser | null;
  }
}

let secret = '';

/** Loads SESSION_SECRET or a generated secret stored in the database (shared by all replicas). */
export async function initAuth() {
  secret = config.auth.sessionSecret || (await ensureSetting('session_secret', crypto.randomBytes(32).toString('hex')));
  if (config.auth.mode === 'oidc') {
    const missing = ['oidcIssuer', 'oidcClientId'].filter((k) => !config.auth[k as 'oidcIssuer' | 'oidcClientId']);
    if (missing.length) throw new Error(`AUTH_MODE=oidc requires OIDC_ISSUER and OIDC_CLIENT_ID`);
  }
  if (config.auth.mode === 'password' && !config.auth.password) throw new Error('AUTH_MODE=password requires APP_PASSWORD');
}

// ---------- Signed cookies ----------

const passwordFingerprint = () => crypto.createHash('sha256').update(config.auth.password).digest('hex').slice(0, 16);

function sign(payload: string): string {
  // In password mode, changing the password invalidates existing sessions.
  const extra = config.auth.mode === 'password' ? passwordFingerprint() : config.auth.mode;
  return crypto.createHmac('sha256', secret).update(`${payload}.${extra}`).digest('base64url');
}

export function seal(data: object, maxAgeSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + maxAgeSeconds * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function unseal<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof data.exp === 'number' && data.exp > Date.now() ? (data as T) : null;
  } catch {
    return null;
  }
}

function setSession(req: FastifyRequest, reply: FastifyReply, user: SessionUser) {
  const maxAge = config.auth.sessionDays * 86_400;
  reply.setCookie(SESSION_COOKIE, seal({ u: user }, maxAge), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: req.protocol === 'https',
    maxAge,
  });
}

// ---------- Authorisation ----------

export function isAllowed(user: SessionUser, groups: string[]): boolean {
  const { allowedUsers, allowedGroups } = config.auth;
  if (!allowedUsers.length && !allowedGroups.length) return true;
  const names = [user.username, user.email].filter(Boolean).map((n) => n!.toLowerCase());
  if (allowedUsers.some((u) => names.includes(u))) return true;
  return allowedGroups.some((g) => groups.includes(g));
}

/** Resolves the current user for this request, or null when not signed in. */
export function resolveUser(req: FastifyRequest): SessionUser | null {
  switch (config.auth.mode) {
    case 'none':
      return { username: 'local' };
    case 'proxy': {
      const header = (name: string) => {
        const v = req.headers[name];
        return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
      };
      const username = header(config.auth.proxyUserHeader);
      if (!username) return null;
      const user = { username, email: header(config.auth.proxyEmailHeader) };
      // Authentik separates groups with "|".
      const groups = (header(config.auth.proxyGroupsHeader) ?? '').split(/[|,]/).map((g) => g.trim()).filter(Boolean);
      return isAllowed(user, groups) ? user : null;
    }
    default:
      return unseal<{ u: SessionUser }>(req.cookies[SESSION_COOKIE])?.u ?? null;
  }
}

const OPEN_PATHS = new Set(['/api/health', '/api/ready', '/api/info', '/api/auth/login', '/api/auth/logout', '/api/auth/oidc/login', '/api/auth/oidc/callback']);

export async function authHook(req: FastifyRequest, reply: FastifyReply) {
  req.user = resolveUser(req);
  if (!req.url.startsWith('/api/')) return;
  if (OPEN_PATHS.has(req.url.split('?')[0])) return;
  if (!req.user) return reply.code(401).send({ error: 'Sign in required' });
}

// ---------- Password mode ----------

export function checkPassword(input: string): boolean {
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(config.auth.password).digest();
  return crypto.timingSafeEqual(a, b);
}

export function passwordLogin(req: FastifyRequest, reply: FastifyReply) {
  setSession(req, reply, { username: 'owner' });
}

// Small in-memory brake on password guessing (per replica).
const attempts = new Map<string, { count: number; until: number }>();
export function loginAllowed(ip: string): boolean {
  const a = attempts.get(ip);
  return !a || a.until < Date.now() || a.count < 5;
}
export function recordFailure(ip: string) {
  const a = attempts.get(ip);
  const fresh = !a || a.until < Date.now();
  attempts.set(ip, { count: fresh ? 1 : a.count + 1, until: Date.now() + 15 * 60_000 });
}
export function clearFailures(ip: string) {
  attempts.delete(ip);
}

// ---------- OIDC mode ----------

let oidcConfig: Promise<oidc.Configuration> | null = null;

function getOidcConfig(): Promise<oidc.Configuration> {
  oidcConfig ??= oidc
    .discovery(new URL(config.auth.oidcIssuer), config.auth.oidcClientId, config.auth.oidcClientSecret || undefined, undefined, {
      execute: config.auth.oidcAllowInsecure ? [oidc.allowInsecureRequests] : [],
    })
    .catch((err) => {
      oidcConfig = null; // retry discovery on the next attempt
      throw Object.assign(new Error(`OIDC discovery failed: ${err.message}`), { status: 502 });
    });
  return oidcConfig;
}

function baseUrl(req: FastifyRequest): string {
  return config.publicUrl || `${req.protocol}://${req.host}`;
}

const redirectUri = (req: FastifyRequest) => `${baseUrl(req)}/api/auth/oidc/callback`;

export async function oidcLoginRedirect(req: FastifyRequest, reply: FastifyReply) {
  const cfg = await getOidcConfig();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const url = oidc.buildAuthorizationUrl(cfg, {
    redirect_uri: redirectUri(req),
    scope: config.auth.oidcScopes,
    code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
    code_challenge_method: 'S256',
    state,
    nonce,
  });
  reply.setCookie(OIDC_COOKIE, seal({ codeVerifier, state, nonce }, 600), {
    path: '/api/auth/oidc',
    httpOnly: true,
    sameSite: 'lax',
    secure: req.protocol === 'https',
    maxAge: 600,
  });
  return reply.redirect(url.href);
}

export async function oidcCallback(req: FastifyRequest, reply: FastifyReply) {
  const pending = unseal<{ codeVerifier: string; state: string; nonce: string }>(req.cookies[OIDC_COOKIE]);
  reply.clearCookie(OIDC_COOKIE, { path: '/api/auth/oidc' });
  if (!pending) return reply.redirect('/?login_error=expired');

  const cfg = await getOidcConfig();
  const current = new URL(req.url, baseUrl(req));
  let claims: oidc.IDToken | undefined;
  let idToken: string | undefined;
  try {
    const tokens = await oidc.authorizationCodeGrant(cfg, current, {
      pkceCodeVerifier: pending.codeVerifier,
      expectedState: pending.state,
      expectedNonce: pending.nonce,
      idTokenExpected: true,
    });
    claims = tokens.claims();
    idToken = tokens.id_token;
  } catch (err) {
    req.log.warn({ err }, 'OIDC callback failed');
    return reply.redirect('/?login_error=failed');
  }
  if (!claims) return reply.redirect('/?login_error=failed');

  const user: SessionUser = {
    username: String(claims.preferred_username ?? claims.email ?? claims.sub),
    email: typeof claims.email === 'string' ? claims.email : undefined,
    name: typeof claims.name === 'string' ? claims.name : undefined,
  };
  const groups = Array.isArray(claims.groups) ? claims.groups.map(String) : [];
  if (!isAllowed(user, groups)) return reply.redirect('/?login_error=forbidden');

  setSession(req, reply, user);
  // Keep the id token briefly for RP-initiated logout at the provider.
  if (idToken) {
    reply.setCookie('overload_idt', idToken, { path: '/api/auth', httpOnly: true, sameSite: 'lax', secure: req.protocol === 'https', maxAge: config.auth.sessionDays * 86_400 });
  }
  return reply.redirect('/');
}

/** Clears the session; returns a URL to visit to also end the provider session, if any. */
export async function logout(req: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
  if (config.auth.mode === 'proxy') return config.auth.proxyLogoutUrl || null;
  if (config.auth.mode !== 'oidc') return null;
  const idToken = req.cookies.overload_idt;
  reply.clearCookie('overload_idt', { path: '/api/auth' });
  try {
    const cfg = await getOidcConfig();
    if (!cfg.serverMetadata().end_session_endpoint) return null;
    return oidc.buildEndSessionUrl(cfg, { post_logout_redirect_uri: `${baseUrl(req)}/`, ...(idToken ? { id_token_hint: idToken } : {}) }).href;
  } catch {
    return null;
  }
}
