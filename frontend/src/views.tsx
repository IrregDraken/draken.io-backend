import { useEffect, useState, type FormEvent } from 'react';
import * as api from './api';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PanelHeading,
  Principle,
  Toolbar,
} from './components';
import type { Notice as NoticeType, View } from './types';
import {
  CompanyInbox,
  CompanyShowcase,
  DecisionLog,
  TrainingCenter,
  WorkerWorkspace,
} from './workerViews';

export function ViewContent({
  view,
  companyId,
  companyName,
}: {
  view: View;
  companyId: string;
  companyName: string;
}) {
  if (view === 'overview') return <Overview companyId={companyId} companyName={companyName} />;
  if (view === 'missions') return <Missions companyId={companyId} />;
  if (view === 'tasks') return <Tasks companyId={companyId} />;
  if (view === 'agents') return <Agents companyId={companyId} />;
  if (view === 'workers') return <WorkerWorkspace companyId={companyId} />;
  if (view === 'training') return <TrainingCenter companyId={companyId} />;
  if (view === 'departments') return <Departments companyId={companyId} />;
  if (view === 'activity') return <Activity companyId={companyId} />;
  if (view === 'inbox') return <CompanyInbox companyId={companyId} />;
  if (view === 'decisions') return <DecisionLog companyId={companyId} />;
  if (view === 'integrations') return <Integrations />;
  if (view === 'settings') return <Settings />;
  if (view === 'showcase') return <CompanyShowcase companyId={companyId} />;
  return <CommandCenter companyId={companyId} />;
}

export function Overview({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [data, setData] = useState<api.Summary | null>(null);
  const [failure, setFailure] = useState('');
  useEffect(() => {
    api
      .summary(companyId)
      .then((result) => setData(result.summary))
      .catch((reason) =>
        setFailure(reason instanceof Error ? reason.message : 'Could not load summary'),
      );
  }, [companyId]);
  if (failure) return <ErrorState message={failure} />;
  if (!data) return <LoadingState />;
  const cards = [
    ['MISSIONS', data.counts.missions ?? 0, 'Tracked company objectives'],
    ['TASKS', data.counts.tasks ?? 0, 'Backend-owned work items'],
    ['AI EMPLOYEES', data.counts.employees ?? 0, 'Configured agent identities'],
    ['ACTIVE RUNS', data.counts.activeOrchestrations ?? 0, 'Orchestration in flight'],
  ];
  return (
    <div className="page-body">
      <section className="hero-strip">
        <div>
          <p className="eyebrow">COMPANY CONTROL PLANE</p>
          <h2>{companyName} is quiet by design.</h2>
          <p className="muted">
            This view reflects persisted backend state. Empty means no records have been created
            yet.
          </p>
        </div>
        <div className="hero-stamp">
          {data.counts.missions === 0 ? 'READY / NO MISSIONS' : 'OPERATING'}
        </div>
      </section>
      <div className="metric-grid">
        {cards.map(([label, value, detail]) => (
          <article className="metric-card" key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
            <span>{detail}</span>
          </article>
        ))}
      </div>
      <div className="two-column">
        <section className="panel">
          <PanelHeading eyebrow="EVENT STREAM" title="Recent activity" />
          <div className="activity-list">
            {data.recentEvents.length === 0 ? (
              <EmptyState
                title="No events yet"
                detail="Mission, task, agent, and system events will appear here once real work begins."
              />
            ) : (
              data.recentEvents.map((event) => (
                <div className="activity-row" key={event.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{event.eventType}</strong>
                    <small>{new Date(event.occurredAt).toLocaleString()}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        <section className="panel">
          <PanelHeading eyebrow="SYSTEM PRINCIPLES" title="What is real" />
          <div className="principle-list">
            <Principle
              title="Private by default"
              text="JWT authentication and company membership are required before data is visible."
            />
            <Principle
              title="No fake activity"
              text="Zero records stay zero. Unconfigured systems surface as unavailable."
            />
            <Principle
              title="Agents are identities"
              text="Provider, employee, role, tools, and assignments remain separate objects."
            />
          </div>
        </section>
      </div>
    </div>
  );
}

export function Missions({ companyId }: { companyId: string }) {
  const [missions, setMissions] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(true);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState<NoticeType>(null);
  const [showForm, setShowForm] = useState(false);
  const reload = () => {
    setBusy(true);
    api
      .listMissions(companyId)
      .then((result) => setMissions(result.missions))
      .catch((reason) =>
        setFailure(reason instanceof Error ? reason.message : 'Could not load missions'),
      )
      .finally(() => setBusy(false));
  };
  useEffect(reload, [companyId]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setNotice(null);
    try {
      await api.createMission(companyId, {
        title: String(form.get('title')),
        description: String(form.get('description') || ''),
        objective: String(form.get('objective') || ''),
        priority: Number(form.get('priority') || 3),
        assignedAgentIds: [],
      });
      setNotice({ kind: 'success', text: 'Mission created in the backend.' });
      event.currentTarget.reset();
      setShowForm(false);
      reload();
    } catch (reason) {
      setNotice({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Mission creation failed',
      });
    }
  }
  return (
    <div className="page-body">
      <Toolbar
        eyebrow="MISSION SYSTEM"
        title="Objectives with a lifecycle"
        action={
          <button className="primary-button compact" onClick={() => setShowForm(!showForm)}>
            + New mission
          </button>
        }
      />
      {notice && <Notice notice={notice} />}
      {showForm && (
        <form className="panel form-grid" onSubmit={create}>
          <label>
            Title
            <input name="title" required />
          </label>
          <label>
            Priority
            <select name="priority" defaultValue="3">
              <option value="1">1 / Critical</option>
              <option value="2">2 / High</option>
              <option value="3">3 / Standard</option>
              <option value="4">4 / Low</option>
              <option value="5">5 / Minimal</option>
            </select>
          </label>
          <label className="wide">
            Objective
            <textarea name="objective" rows={3} />
          </label>
          <label className="wide">
            Description
            <textarea name="description" rows={3} />
          </label>
          <button className="primary-button compact">Create mission</button>
        </form>
      )}
      {failure ? (
        <ErrorState message={failure} />
      ) : busy ? (
        <LoadingState />
      ) : missions.length === 0 ? (
        <EmptyState
          title="No missions created"
          detail="Create the first objective to move the company from ready to executing."
        />
      ) : (
        <div className="record-grid">
          {missions.map((mission) => (
            <article className="record-card" key={String(mission.id)}>
              <div className="record-top">
                <span className="status-chip">{String(mission.stage ?? mission.status)}</span>
                <span className="record-id">{String(mission.id).slice(0, 8)}</span>
              </div>
              <h3>{String(mission.title ?? mission.name)}</h3>
              <p>{String(mission.objective ?? mission.description ?? 'No objective provided.')}</p>
              <div className="progress">
                <span style={{ width: `${Number(mission.progress ?? 0)}%` }} />
              </div>
              <div className="record-meta">
                <span>{Number(mission.progress ?? 0)}% progress</span>
                <span>{Number(mission.taskCount ?? 0)} tasks</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function Tasks({ companyId }: { companyId: string }) {
  const [tasks, setTasks] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(true);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState<NoticeType>(null);
  const [showForm, setShowForm] = useState(false);
  const reload = () => {
    setBusy(true);
    api
      .listTasks(companyId)
      .then((result) => setTasks(result.tasks))
      .catch((reason) =>
        setFailure(reason instanceof Error ? reason.message : 'Could not load tasks'),
      )
      .finally(() => setBusy(false));
  };
  useEffect(reload, [companyId]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.createTask(companyId, {
        title: String(form.get('title')),
        description: String(form.get('description') || ''),
        priority: Number(form.get('priority') || 3),
        retryLimit: Number(form.get('retryLimit') || 0),
      });
      setNotice({ kind: 'success', text: 'Task created in the backend.' });
      event.currentTarget.reset();
      setShowForm(false);
      reload();
    } catch (reason) {
      setNotice({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Task creation failed',
      });
    }
  }
  return (
    <div className="page-body">
      <Toolbar
        eyebrow="TASK ENGINE"
        title="Execution, retries, and failure states"
        action={
          <button className="primary-button compact" onClick={() => setShowForm(!showForm)}>
            + New task
          </button>
        }
      />
      {notice && <Notice notice={notice} />}
      {showForm && (
        <form className="panel form-grid" onSubmit={create}>
          <label className="wide">
            Title
            <input name="title" required />
          </label>
          <label>
            Priority
            <select name="priority" defaultValue="3">
              <option value="1">Critical</option>
              <option value="2">High</option>
              <option value="3">Standard</option>
              <option value="4">Low</option>
              <option value="5">Minimal</option>
            </select>
          </label>
          <label>
            Retry limit
            <input name="retryLimit" type="number" min="0" max="20" defaultValue="0" />
          </label>
          <label className="wide">
            Description
            <textarea name="description" rows={3} />
          </label>
          <button className="primary-button compact">Create task</button>
        </form>
      )}
      {failure ? (
        <ErrorState message={failure} />
      ) : busy ? (
        <LoadingState />
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No tasks created"
          detail="Tasks are persisted in the backend and can be attached to missions when available."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Retries</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={String(task.id)}>
                  <td>
                    <strong>{String(task.title)}</strong>
                    <small>{String(task.id).slice(0, 8)}</small>
                  </td>
                  <td>
                    <span className="status-chip">{String(task.status)}</span>
                  </td>
                  <td>P{String(task.priority)}</td>
                  <td>
                    {String(task.retryCount)} / {String(task.retryLimit)}
                  </td>
                  <td>{task.dueAt ? new Date(String(task.dueAt)).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function Agents({ companyId }: { companyId: string }) {
  const [agents, setAgents] = useState<Array<Record<string, unknown>>>([]);
  const [failure, setFailure] = useState('');
  useEffect(() => {
    api
      .listAgents(companyId)
      .then((result) => setAgents(result.agents))
      .catch((reason) =>
        setFailure(reason instanceof Error ? reason.message : 'Could not load agents'),
      );
  }, [companyId]);
  return (
    <div className="page-body">
      <Toolbar eyebrow="AI EMPLOYEES" title="Identity before intelligence" />
      {failure ? (
        <ErrorState message={failure} />
      ) : agents.length === 0 ? (
        <EmptyState
          title="No AI employees configured"
          detail="Agents are explicit identities with roles, providers, capabilities, tools, and assignments. Nothing is seeded here."
        />
      ) : (
        <div className="record-grid">
          {agents.map((agent) => (
            <article className="record-card" key={String(agent.id)}>
              <div className="record-top">
                <span className="status-chip">{String(agent.status)}</span>
                <span className="record-id">{String(agent.id).slice(0, 8)}</span>
              </div>
              <h3>{String(agent.displayName)}</h3>
              <p>{String(agent.description ?? 'No description provided.')}</p>
              <div className="record-meta">
                <span>{String(agent.currentAssignment ?? 'No assignment')}</span>
                <span>{String(agent.departmentId ?? 'No department')}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function Departments({ companyId }: { companyId: string }) {
  const [departments, setDepartments] = useState<Array<Record<string, unknown>>>([]);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<NoticeType>(null);
  const reload = () => {
    api
      .listDepartments(companyId)
      .then((result) => setDepartments(result.departments))
      .catch((reason) =>
        setNotice({
          kind: 'error',
          text: reason instanceof Error ? reason.message : 'Could not load departments',
        }),
      );
  };
  useEffect(reload, [companyId]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.createDepartment(companyId, {
        name: String(form.get('name')),
        description: String(form.get('description') || ''),
      });
      setNotice({ kind: 'success', text: 'Department created.' });
      setShowForm(false);
      event.currentTarget.reset();
      reload();
    } catch (reason) {
      setNotice({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Department creation failed',
      });
    }
  }
  return (
    <div className="page-body">
      <Toolbar
        eyebrow="ORGANIZATION"
        title="Departments that scale with the company"
        action={
          <button className="primary-button compact" onClick={() => setShowForm(!showForm)}>
            + Add department
          </button>
        }
      />
      {notice && <Notice notice={notice} />}
      {showForm && (
        <form className="panel form-grid" onSubmit={create}>
          <label>
            Name
            <input name="name" required />
          </label>
          <label className="wide">
            Description
            <textarea name="description" rows={3} />
          </label>
          <button className="primary-button compact">Create department</button>
        </form>
      )}
      {departments.length === 0 ? (
        <EmptyState
          title="No departments yet"
          detail="Create departments such as Engineering, Research, or Operations when the organization is ready."
        />
      ) : (
        <div className="record-grid">
          {departments.map((department) => (
            <article className="record-card compact-card" key={String(department.id)}>
              <span className="department-glyph">/</span>
              <h3>{String(department.name)}</h3>
              <p>{String(department.description ?? 'No description provided.')}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function Activity({ companyId }: { companyId: string }) {
  const [activity, setActivity] = useState<Array<Record<string, unknown>>>([]);
  const [failure, setFailure] = useState('');
  useEffect(() => {
    api
      .listActivity(companyId)
      .then((result) => setActivity(result.activity))
      .catch((reason) =>
        setFailure(reason instanceof Error ? reason.message : 'Could not load activity'),
      );
  }, [companyId]);
  return (
    <div className="page-body">
      <Toolbar eyebrow="OBSERVABILITY" title="A trace of company work" />
      {failure ? (
        <ErrorState message={failure} />
      ) : activity.length === 0 ? (
        <EmptyState
          title="No activity recorded"
          detail="The event stream and activity log will populate from real mission, task, agent, and tool actions."
        />
      ) : (
        <section className="panel activity-list">
          {activity.map((item) => (
            <div className="activity-row" key={String(item.id)}>
              <span className="timeline-dot" />
              <div>
                <strong>{String(item.message)}</strong>
                <small>
                  {String(item.activityType)} · {new Date(String(item.createdAt)).toLocaleString()}
                </small>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export function Integrations() {
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [failure, setFailure] = useState('');
  useEffect(() => {
    api
      .health()
      .then((value) => setReport(value as Record<string, unknown>))
      .catch((reason) =>
        setFailure(reason instanceof Error ? reason.message : 'Could not load health'),
      );
  }, []);
  const components = Object.entries(
    (report?.components ?? {}) as Record<string, { status?: string; detail?: string }>,
  );
  return (
    <div className="page-body">
      <Toolbar eyebrow="SYSTEM HEALTH" title="Connected only when verified" />
      {failure ? (
        <ErrorState message={failure} />
      ) : !report ? (
        <LoadingState />
      ) : (
        <>
          <section className="health-banner">
            <div className={`health-orb ${report.status === 'ok' ? 'good' : 'warn'}`} />
            <div>
              <p className="eyebrow">READINESS</p>
              <h2>{String(report.status).toUpperCase()}</h2>
              <p className="muted">
                Last checked {new Date(String(report.checkedAt)).toLocaleString()}
              </p>
            </div>
          </section>
          <div className="health-grid">
            {components.map(([name, component]) => (
              <article className="health-card" key={name}>
                <div className="health-card-top">
                  <strong>{name}</strong>
                  <span className={`status-chip ${component.status === 'ok' ? 'success' : ''}`}>
                    {component.status}
                  </span>
                </div>
                <p>{component.detail ?? 'No detail provided.'}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Settings() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [notice, setNotice] = useState<NoticeType>(null);
  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      await api.updateProfile({ displayName, username });
      setNotice({ kind: 'success', text: 'Profile updated.' });
    } catch (reason) {
      setNotice({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Profile update failed',
      });
    }
  }
  return (
    <div className="page-body">
      <Toolbar eyebrow="ACCOUNT & COMPANY" title="Settings with clear boundaries" />
      {notice && <Notice notice={notice} />}
      <form className="panel form-grid narrow" onSubmit={save}>
        <div className="section-heading">
          <p className="eyebrow">PROFILE</p>
          <h2>Operator identity</h2>
          <p className="muted">
            Only your profile is editable here. Company administration belongs to authorized owners
            and administrators.
          </p>
        </div>
        <label>
          Display name
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label>
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            pattern="[A-Za-z0-9_-]+"
          />
        </label>
        <button className="primary-button compact">Save profile</button>
      </form>
    </div>
  );
}

export function CommandCenter({ companyId }: { companyId: string }) {
  const [command, setCommand] = useState('');
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o-mini');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeType>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const result = await api.executeCommand(companyId, { command, provider, model });
      setNotice({
        kind: 'success',
        text: `Mission ${String(result.mission.title ?? result.mission.name)} created. It is unassigned until an agent is explicitly selected.`,
      });
      setCommand('');
    } catch (reason) {
      setNotice({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Command planning failed',
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-body">
      <section className="command-hero">
        <div>
          <p className="eyebrow">NATURAL LANGUAGE CONTROL</p>
          <h2>Tell the company what needs to happen.</h2>
          <p className="muted">
            Commands will become missions, plans, tasks, and events through the orchestrator. The
            system will never claim execution without a connected provider and permitted tools.
          </p>
        </div>
        <span className="command-mark">⌁</span>
      </section>
      {notice && <Notice notice={notice} />}
      <form className="command-form" onSubmit={submit}>
        <textarea
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder="Create a mission to…"
          rows={4}
          required
        />
        <div className="command-footer">
          <span>Company scope: {companyId.slice(0, 8)}…</span>
          <div className="command-options">
            <select
              aria-label="AI provider"
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google-gemini">Gemini</option>
            </select>
            <input
              aria-label="AI model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
            <button className="primary-button" disabled={!command.trim() || busy}>
              {busy ? 'Planning…' : 'Send command'} <span>↗</span>
            </button>
          </div>
        </div>
      </form>
      <div className="two-column">
        <section className="panel">
          <PanelHeading eyebrow="PIPELINE" title="How a command moves" />
          <div className="pipeline">
            {[
              'Command',
              'Mission engine',
              'Agent selection',
              'Task engine',
              'Tool execution',
              'Event stream',
            ].map((step, index) => (
              <div key={step} className="pipeline-step">
                <span>{String(index + 1).padStart(2, '0')}</span>
                {step}
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <PanelHeading eyebrow="CONSTRAINTS" title="What is required" />
          <ul className="constraint-list">
            <li>Authenticated user with active company membership</li>
            <li>Configured AI provider and model</li>
            <li>Explicitly assigned tools and permissions</li>
            <li>Persisted event and task state</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
