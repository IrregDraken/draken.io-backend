import { useState, type FormEvent } from 'react';
import * as api from './api';
import { Notice } from './components';
import type { Notice as NoticeType } from './types';

export function AuthScreen({
  onAuthenticated,
  initialError,
}: {
  onAuthenticated: (session: api.Session) => void;
  initialError: string;
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeType>(
    initialError ? { kind: 'error', text: initialError } : null,
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === 'login') {
        onAuthenticated(await api.signIn(email, password));
      } else {
        const created = await api.signUp(email, password, displayName, username);
        if (created) onAuthenticated(created);
        else
          setNotice({
            kind: 'success',
            text: 'Account created. Confirm your email, then sign in.',
          });
      }
    } catch (reason) {
      setNotice({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Authentication failed',
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-grid">
        <section className="auth-intro">
          <div className="brand-mark">
            D<span>/</span>
          </div>
          <p className="eyebrow">DRK / OPERATING SYSTEM</p>
          <h1>
            Run the company.
            <br />
            <em>Not the dashboard.</em>
          </h1>
          <p className="lede">
            A private operating layer for missions, agents, tasks, and the work between them.
          </p>
          <div className="signal-row">
            <span className="signal-dot" /> Secure company access <span className="signal-line" />{' '}
            Live backend state
          </div>
        </section>
        <section className="auth-card">
          <p className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'NEW COMPANY USER'}</p>
          <h2>{mode === 'login' ? 'Enter the command room.' : 'Create your operator profile.'}</h2>
          <p className="muted">
            {mode === 'login'
              ? 'Authenticate to access private company data.'
              : 'Your account will not see company data until an owner grants membership.'}
          </p>
          {notice && <Notice notice={notice} />}
          <form onSubmit={submit} className="form-stack">
            {mode === 'signup' && (
              <>
                <label>
                  Display name
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Username
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                    pattern="[A-Za-z0-9_-]+"
                  />
                </label>
              </>
            )}
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>
            <button className="primary-button" disabled={busy}>
              {busy ? 'Authenticating…' : mode === 'login' ? 'Sign in' : 'Create account'}
              <span>↗</span>
            </button>
          </form>
          <button
            className="text-button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setNotice(null);
            }}
          >
            {mode === 'login' ? 'Need an account? Create one' : 'Already registered? Sign in'}
          </button>
        </section>
      </div>
    </main>
  );
}

export function OnboardingScreen({
  email,
  onSignOut,
}: {
  email?: string;
  onSignOut: () => Promise<void>;
}) {
  return (
    <main className="auth-page">
      <section className="empty-panel onboarding">
        <div className="brand-mark">
          D<span>/</span>
        </div>
        <p className="eyebrow">ACCESS PENDING</p>
        <h1>
          Your account is ready.
          <br />
          <em>Your company is next.</em>
        </h1>
        <p className="lede">
          {email ?? 'This account'} is authenticated, but has no active company membership yet. Ask
          a company owner to invite you.
        </p>
        <button className="secondary-button" onClick={() => void onSignOut()}>
          Sign out
        </button>
      </section>
    </main>
  );
}
