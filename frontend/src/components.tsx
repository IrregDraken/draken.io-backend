import type { ReactNode } from 'react';
import type { Notice as NoticeType, View } from './types';

export function Toolbar({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="toolbar">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function PanelHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="panel-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
  );
}

export function Principle({ title, text }: { title: string; text: string }) {
  return (
    <div className="principle">
      <span className="principle-bar" />
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

export function Notice({ notice }: { notice: Exclude<NoticeType, null> }) {
  return <div className={`notice ${notice.kind}`}>{notice.text}</div>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="empty-panel">
      <div className="empty-glyph">∅</div>
      <h2>{title}</h2>
      <p>{detail}</p>
    </section>
  );
}

export function LoadingState() {
  return (
    <section className="empty-panel">
      <div className="loader" />
      <h2>Loading verified state</h2>
      <p>Reading from the backend.</p>
    </section>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <section className="empty-panel error-state">
      <div className="empty-glyph">!</div>
      <h2>Could not load this view</h2>
      <p>{message}</p>
    </section>
  );
}

export function FullPageState({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="auth-page">
      <section className="empty-panel onboarding">
        <div className="loader" />
        <h2>{title}</h2>
        <p>{detail}</p>
      </section>
    </main>
  );
}

export function pageTitle(view: View): string {
  return {
    overview: 'Company overview',
    command: 'Command center',
    missions: 'Missions',
    tasks: 'Tasks',
    agents: 'AI employees',
    workers: 'Worker workspace',
    training: 'Training center',
    departments: 'Departments',
    activity: 'Activity',
    inbox: 'Company inbox',
    decisions: 'Decision log',
    integrations: 'System health',
    settings: 'Settings',
    showcase: 'Company showcase',
  }[view];
}
