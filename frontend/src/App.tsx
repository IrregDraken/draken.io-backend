import { useEffect, useState } from 'react';
import * as api from './api';
import { AuthScreen, OnboardingScreen } from './auth';
import { FullPageState } from './components';
import { Shell } from './layout';
import { ViewContent } from './views';
import type { View } from './types';
import './styles.css';

export default function App() {
  const [session, setSession] = useState<api.Session | null>(null);
  const [memberships, setMemberships] = useState<api.Membership[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [view, setView] = useState<View>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!api.getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((result) => {
        setSession({ access_token: api.getToken() ?? '', user: result.user });
        setMemberships(result.memberships);
        setCompanyId(result.memberships[0]?.companyId ?? null);
      })
      .catch((reason: unknown) => {
        window.localStorage.removeItem('draken_access_token');
        setError(reason instanceof Error ? reason.message : 'Session could not be restored');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <FullPageState title="Restoring secure session" detail="Checking your company memberships." />
    );
  if (!session)
    return (
      <AuthScreen
        onAuthenticated={(next) => {
          setSession(next);
          api.me().then((result) => {
            setMemberships(result.memberships);
            setCompanyId(result.memberships[0]?.companyId ?? null);
          });
        }}
        initialError={error}
      />
    );
  if (!companyId)
    return (
      <OnboardingScreen
        email={session.user.email}
        onSignOut={async () => {
          await api.signOut();
          setSession(null);
        }}
      />
    );

  const membership = memberships.find((item) => item.companyId === companyId) ?? memberships[0];
  return (
    <Shell
      view={view}
      setView={setView}
      email={session.user.email}
      memberships={memberships}
      companyId={companyId}
      setCompanyId={setCompanyId}
      onSignOut={async () => {
        await api.signOut();
        setSession(null);
      }}
    >
      <ViewContent
        view={view}
        companyId={companyId}
        companyName={membership?.companyName ?? 'Company'}
      />
    </Shell>
  );
}
