import type { ReactNode } from 'react';
import * as api from './api';
import { pageTitle } from './components';
import type { View } from './types';

export function Shell({
  view,
  setView,
  email,
  memberships,
  companyId,
  setCompanyId,
  onSignOut,
  children,
}: {
  view: View;
  setView: (view: View) => void;
  email?: string;
  memberships: api.Membership[];
  companyId: string;
  setCompanyId: (id: string) => void;
  onSignOut: () => Promise<void>;
  children: ReactNode;
}) {
  const nav: Array<{ id: View; label: string; group: string }> = [
    { id: 'overview', label: 'Overview', group: 'Command' },
    { id: 'command', label: 'Command center', group: 'Command' },
    { id: 'missions', label: 'Missions', group: 'Work' },
    { id: 'tasks', label: 'Tasks', group: 'Work' },
    { id: 'agents', label: 'AI employees', group: 'Company' },
    { id: 'departments', label: 'Departments', group: 'Company' },
    { id: 'activity', label: 'Activity', group: 'Company' },
    { id: 'integrations', label: 'Integrations', group: 'System' },
    { id: 'settings', label: 'Settings', group: 'System' },
  ];
  const grouped = [...new Set(nav.map((item) => item.group))];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small">
            D<span>/</span>
          </div>
          <div>
            <strong>DRAKEN</strong>
            <small>INDUSTRIES</small>
          </div>
        </div>
        <div className="company-switcher">
          <span className="status-dot" />{' '}
          <select
            aria-label="Active company"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
          >
            {memberships.map((item) => (
              <option key={item.companyId} value={item.companyId}>
                {item.companyName}
              </option>
            ))}
          </select>
        </div>
        <nav>
          {grouped.map((group) => (
            <div className="nav-group" key={group}>
              <p>{group}</p>
              {nav
                .filter((item) => item.group === group)
                .map((item) => (
                  <button
                    key={item.id}
                    className={view === item.id ? 'nav-item active' : 'nav-item'}
                    onClick={() => setView(item.id)}
                  >
                    <span className={`nav-icon icon-${item.id}`} />
                    {item.label}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{(email?.[0] ?? 'O').toUpperCase()}</div>
          <div className="operator">
            <strong>{email ?? 'Operator'}</strong>
            <small>Authenticated</small>
          </div>
          <button className="icon-button" aria-label="Sign out" onClick={() => void onSignOut()}>
            ↗
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">DRAKEN / {view.toUpperCase()}</p>
            <h1>{pageTitle(view)}</h1>
          </div>
          <div className="topbar-actions">
            <span className="live-pill">
              <span className="signal-dot" /> LIVE BACKEND
            </span>
            <button className="icon-button">⌘K</button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
