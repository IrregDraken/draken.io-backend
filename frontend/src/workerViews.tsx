import { useEffect, useState, type FormEvent } from 'react';
import * as api from './api';
import { EmptyState, ErrorState, LoadingState, Notice, PanelHeading, Toolbar } from './components';
import type { Notice as NoticeType } from './types';

export function WorkerWorkspace({ companyId }: { companyId: string }) {
  const [workers, setWorkers] = useState<api.Worker[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [performance, setPerformance] = useState<api.WorkerPerformance | null>(null);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(true);
  const [showHire, setShowHire] = useState(false);
  const [notice, setNotice] = useState<NoticeType>(null);

  const selectedWorker = workers.find((worker) => worker.id === selectedId) ?? workers[0];

  function reload() {
    setBusy(true);
    setFailure('');
    api
      .listWorkers(companyId)
      .then((result) => {
        setWorkers(result.workers);
        setSelectedId((current) => current || result.workers[0]?.id || '');
      })
      .catch((reason) =>
        setFailure(reason instanceof Error ? reason.message : 'Could not load workers'),
      )
      .finally(() => setBusy(false));
  }

  useEffect(reload, [companyId]);

  useEffect(() => {
    if (!selectedWorker) {
      setPerformance(null);
      return;
    }
    api
      .getWorkerPerformance(companyId, selectedWorker.id)
      .then((result) => setPerformance(result.performance))
      .catch(() => setPerformance(null));
  }, [companyId, selectedWorker?.id]);

  async function hire(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setNotice(null);
    try {
      await api.createWorker(companyId, {
        name: String(form.get('name')),
        title: String(form.get('title') || ''),
        role: String(form.get('role') || ''),
        description: String(form.get('description') || ''),
        autonomyLevel: 'observe',
      });
      event.currentTarget.reset();
      setShowHire(false);
      setNotice({
        kind: 'success',
        text: 'Worker identity created. Configure a provider before running it.',
      });
      reload();
    } catch (reason) {
      setNotice({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Worker creation failed',
      });
    }
  }

  return (
    <div className="page-body">
      <Toolbar
        eyebrow="WORKER OPERATING SYSTEM"
        title="Identity before intelligence"
        action={
          <button className="primary-button compact" onClick={() => setShowHire((value) => !value)}>
            + Hire worker
          </button>
        }
      />
      {notice && <Notice notice={notice} />}
      {showHire && (
        <form className="panel form-grid" onSubmit={hire}>
          <label>
            Name
            <input name="name" required placeholder="ATLAS" />
          </label>
          <label>
            Title
            <input name="title" placeholder="COO" />
          </label>
          <label>
            Role
            <input name="role" placeholder="Operations" />
          </label>
          <label className="wide">
            Description
            <textarea name="description" rows={3} />
          </label>
          <button className="primary-button compact">Create worker identity</button>
        </form>
      )}
      {failure ? (
        <ErrorState message={failure} />
      ) : busy ? (
        <LoadingState />
      ) : workers.length === 0 ? (
        <EmptyState
          title="No workers hired"
          detail="Hire a worker identity to create a persistent employee that can later be configured, trained, evaluated, and deployed."
        />
      ) : (
        <div className="two-column worker-layout">
          <section className="panel">
            <PanelHeading eyebrow="EMPLOYEE ROSTER" title="Persistent identities" />
            <div className="record-list">
              {workers.map((worker) => (
                <button
                  className={
                    worker.id === selectedWorker?.id ? 'record-row selected' : 'record-row'
                  }
                  key={worker.id}
                  onClick={() => setSelectedId(worker.id)}
                >
                  <span className="avatar">{worker.name.slice(0, 1).toUpperCase()}</span>
                  <span>
                    <strong>{worker.name}</strong>
                    <small>{worker.title ?? worker.role ?? 'Unassigned role'}</small>
                  </span>
                  <span className="status-chip">{worker.status}</span>
                </button>
              ))}
            </div>
          </section>
          {selectedWorker && (
            <section className="panel worker-profile-card">
              <div className="record-top">
                <span className="status-chip">{selectedWorker.status}</span>
                <span className="record-id">v{selectedWorker.version}</span>
              </div>
              <h2>{selectedWorker.name}</h2>
              <p className="muted">
                {selectedWorker.title ?? selectedWorker.role ?? 'Role not configured'}
              </p>
              <p>{selectedWorker.description ?? 'No description has been configured.'}</p>
              <div className="profile-grid">
                <ProfileField
                  label="Powered by"
                  value={`${selectedWorker.providerKey ?? 'Provider not configured'} / ${selectedWorker.model ?? 'model not configured'}`}
                />
                <ProfileField label="Autonomy" value={selectedWorker.autonomyLevel} />
                <ProfileField
                  label="Department"
                  value={selectedWorker.department ?? 'Not assigned'}
                />
                <ProfileField
                  label="Promotion"
                  value={selectedWorker.promotionLevel ?? 'Base level'}
                />
                <ProfileField label="Skills" value={String(selectedWorker.skills.length)} />
                <ProfileField
                  label="Last active"
                  value={
                    selectedWorker.lastActiveAt
                      ? new Date(selectedWorker.lastActiveAt).toLocaleString()
                      : 'No recorded run'
                  }
                />
              </div>
              <div className="tag-list">
                {selectedWorker.skills.length === 0 ? (
                  <span className="muted">No skills assigned.</span>
                ) : (
                  selectedWorker.skills.map((skill) => (
                    <span className="tag" key={skill.id}>
                      {skill.name} v{skill.version}
                    </span>
                  ))
                )}
              </div>
              <div className="metric-grid compact-grid">
                <Metric label="Missions" value={performance?.missionsCompleted} />
                <Metric label="Tasks" value={performance?.tasksCompleted} />
                <Metric
                  label="Evaluation"
                  value={
                    performance?.evaluationScore === undefined
                      ? undefined
                      : `${performance.evaluationScore.toFixed(0)}%`
                  }
                />
                <Metric label="Corrections" value={performance?.humanCorrections} />
              </div>
              <p className="muted small-copy">
                Worker identity remains stable when the provider or model changes. Versioned
                configuration and runtime records are the source of truth.
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export function TrainingCenter({ companyId }: { companyId: string }) {
  const [workers, setWorkers] = useState<api.Worker[]>([]);
  const [workerId, setWorkerId] = useState('');
  const [lessons, setLessons] = useState<api.TrainingLesson[]>([]);
  const [busy, setBusy] = useState(true);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState<NoticeType>(null);
  const [showForm, setShowForm] = useState(false);

  const selectedWorker = workers.find((worker) => worker.id === workerId) ?? workers[0];

  function loadWorkers() {
    return api.listWorkers(companyId).then((result) => {
      setWorkers(result.workers);
      setWorkerId((current) => current || result.workers[0]?.id || '');
      return result.workers[0]?.id ?? '';
    });
  }

  function loadLessons(id = selectedWorker?.id) {
    if (!id) {
      setLessons([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    api
      .listTraining(companyId, id)
      .then((result) => setLessons(result.lessons))
      .catch((reason) =>
        setFailure(reason instanceof Error ? reason.message : 'Could not load training'),
      )
      .finally(() => setBusy(false));
  }

  useEffect(() => {
    setBusy(true);
    loadWorkers()
      .then((id) => loadLessons(id))
      .catch((reason) => {
        setFailure(reason instanceof Error ? reason.message : 'Could not load workers');
        setBusy(false);
      });
  }, [companyId]);

  useEffect(() => {
    if (selectedWorker?.id) loadLessons(selectedWorker.id);
  }, [selectedWorker?.id]);

  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorker) return;
    const form = new FormData(event.currentTarget);
    try {
      await api.proposeTraining(companyId, selectedWorker.id, {
        title: String(form.get('title')),
        category: String(form.get('category')),
        lesson: String(form.get('lesson')),
        source: 'CEO feedback',
        correction: String(form.get('correction') || ''),
      });
      event.currentTarget.reset();
      setShowForm(false);
      setNotice({
        kind: 'success',
        text: 'Lesson proposed. It will not affect runtime behavior until approved and activated.',
      });
      loadLessons(selectedWorker.id);
    } catch (reason) {
      setNotice({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Lesson proposal failed',
      });
    }
  }

  async function review(lesson: api.TrainingLesson, decision: 'approve' | 'reject') {
    try {
      await api.reviewTraining(companyId, lesson.id, {
        decision,
        feedback: decision === 'approve' ? 'Approved by CEO for activation.' : 'Rejected by CEO.',
      });
      setNotice({
        kind: 'success',
        text: `Lesson ${decision === 'approve' ? 'approved' : 'rejected'}.`,
      });
      loadLessons(selectedWorker?.id);
    } catch (reason) {
      setNotice({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Training review failed',
      });
    }
  }

  async function activate(lesson: api.TrainingLesson) {
    try {
      await api.activateTraining(companyId, lesson.id);
      setNotice({ kind: 'success', text: 'Lesson activated in the worker training memory.' });
      loadLessons(selectedWorker?.id);
    } catch (reason) {
      setNotice({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Lesson activation failed',
      });
    }
  }

  return (
    <div className="page-body">
      <Toolbar
        eyebrow="TRAINING CENTER"
        title="Improve behavior with evidence"
        action={
          <button
            className="primary-button compact"
            onClick={() => setShowForm((value) => !value)}
            disabled={!selectedWorker}
          >
            + Propose lesson
          </button>
        }
      />
      {workers.length > 0 && (
        <label className="inline-select">
          Worker
          <select
            value={selectedWorker?.id ?? ''}
            onChange={(event) => setWorkerId(event.target.value)}
          >
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {notice && <Notice notice={notice} />}
      {showForm && selectedWorker && (
        <form className="panel form-grid" onSubmit={propose}>
          <label>
            <span>Title</span>
            <input name="title" required placeholder="Source verification" />
          </label>
          <label>
            <span>Category</span>
            <input name="category" required placeholder="Research" />
          </label>
          <label className="wide">
            <span>Lesson</span>
            <textarea
              name="lesson"
              rows={4}
              required
              placeholder="Challenge unsupported claims before accepting them."
            />
          </label>
          <label className="wide">
            <span>Correction</span>
            <textarea
              name="correction"
              rows={3}
              placeholder="Do not treat vendor claims as independently verified evidence."
            />
          </label>
          <button className="primary-button compact">Submit proposed lesson</button>
        </form>
      )}
      {failure ? (
        <ErrorState message={failure} />
      ) : busy ? (
        <LoadingState />
      ) : !selectedWorker ? (
        <EmptyState
          title="No worker selected"
          detail="Hire a worker before adding training lessons."
        />
      ) : lessons.length === 0 ? (
        <EmptyState
          title="No training history"
          detail="Proposed lessons, corrections, examples, and evaluations will appear here. Nothing is silently converted into permanent behavior."
        />
      ) : (
        <div className="record-grid">
          {lessons.map((lesson) => (
            <article className="record-card" key={lesson.id}>
              <div className="record-top">
                <span className="status-chip">{lesson.status}</span>
                <span className="record-id">v{lesson.version}</span>
              </div>
              <h3>{lesson.title}</h3>
              <p>{lesson.lesson}</p>
              <div className="record-meta">
                <span>{lesson.category}</span>
                <span>{lesson.source}</span>
                <span>{new Date(lesson.createdAt).toLocaleDateString()}</span>
              </div>
              {lesson.correction && <p className="muted">Correction: {lesson.correction}</p>}
              <div className="button-row">
                {lesson.status === 'proposed' || lesson.status === 'reviewing' ? (
                  <button
                    className="secondary-button compact"
                    onClick={() => void review(lesson, 'approve')}
                  >
                    Approve
                  </button>
                ) : null}
                {lesson.status === 'approved' ? (
                  <button className="primary-button compact" onClick={() => void activate(lesson)}>
                    Activate
                  </button>
                ) : null}
                {lesson.latestReview && (
                  <small>
                    {lesson.latestReview.decision}: {lesson.latestReview.feedback}
                  </small>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function CompanyShowcase({ companyId }: { companyId: string }) {
  const [showcase, setShowcase] = useState<api.CompanyShowcase | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState<NoticeType>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    api
      .getCompanyShowcase(companyId)
      .then((result) => {
        setShowcase(result.showcase);
        setEnabled(Boolean(result.showcase));
      })
      .catch((reason) =>
        setFailure(reason instanceof Error ? reason.message : 'Could not load showcase'),
      )
      .finally(() => setBusy(false));
  }, [companyId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.updateCompanyShowcase(companyId, {
        enabled,
        description: String(form.get('description') || ''),
        industry: String(form.get('industry') || ''),
        mission: String(form.get('mission') || ''),
      });
      const result = await api.getCompanyShowcase(companyId);
      setShowcase(result.showcase);
      setNotice({
        kind: 'success',
        text: enabled
          ? 'Showcase published with explicit public fields only.'
          : 'Showcase disabled.',
      });
    } catch (reason) {
      setNotice({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Showcase update failed',
      });
    }
  }

  if (failure)
    return (
      <div className="page-body">
        <ErrorState message={failure} />
      </div>
    );
  if (busy)
    return (
      <div className="page-body">
        <LoadingState />
      </div>
    );
  return (
    <div className="page-body">
      <Toolbar eyebrow="PUBLIC COMPANY PROFILE" title="Show the company, not its secrets" />
      <p className="muted">
        Public visibility is opt-in. Credentials, private memory, private conversations, and
        internal artifacts are never part of the showcase response.
      </p>
      {notice && <Notice notice={notice} />}
      <form className="panel form-grid" onSubmit={save}>
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />{' '}
          Publish showcase
        </label>
        <label>
          <span>Industry</span>
          <input name="industry" defaultValue={showcase?.industry ?? ''} />
        </label>
        <label>
          <span>Description</span>
          <textarea name="description" rows={3} defaultValue={showcase?.description ?? ''} />
        </label>
        <label className="wide">
          <span>Mission</span>
          <textarea name="mission" rows={3} defaultValue={showcase?.mission ?? ''} />
        </label>
        <button className="primary-button compact">Save public profile</button>
      </form>
      {showcase ? (
        <section className="panel showcase-preview">
          <PanelHeading eyebrow="SANITIZED PREVIEW" title={showcase.name} />
          <p>{showcase.description ?? 'No public description configured.'}</p>
          <div className="metric-grid">
            {Object.entries(showcase.metrics).map(([label, value]) => (
              <Metric key={label} label={label} value={String(value)} />
            ))}
          </div>
          <h3>Visible workers</h3>
          {showcase.workers.length === 0 ? (
            <p className="muted">No worker has been explicitly marked public.</p>
          ) : (
            <div className="record-grid">
              {showcase.workers.map((worker) => (
                <article className="record-card" key={worker.id}>
                  <div className="record-top">
                    <span className="status-chip">{worker.status}</span>
                    <span className="record-id">{worker.promotionLevel ?? 'Base'}</span>
                  </div>
                  <h3>{worker.name}</h3>
                  <p>{worker.title ?? worker.role ?? 'Role not configured'}</p>
                  <div className="tag-list">
                    {worker.skills.map((skill) => (
                      <span className="tag" key={`${worker.id}-${skill.name}`}>
                        {skill.name}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <EmptyState
          title="Showcase is private"
          detail="Enable publication only after selecting the company and worker fields that are safe to share."
        />
      )}
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-field">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong>{value ?? '—'}</strong>
    </article>
  );
}

export function CompanyInbox({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<api.CompanyInboxItem[]>([]);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    api
      .listInbox(companyId)
      .then((result) => setItems(result.items))
      .catch((reason) =>
        setFailure(reason instanceof Error ? reason.message : 'Could not load company inbox'),
      )
      .finally(() => setBusy(false));
  }, [companyId]);

  return (
    <div className="page-body">
      <Toolbar eyebrow="COMPANY INBOX" title="One queue for incoming work" />
      <p className="muted">
        CEO requests, integrations, webhooks, schedules, and worker submissions belong here before
        they become missions or tasks.
      </p>
      {failure ? (
        <ErrorState message={failure} />
      ) : busy ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState
          title="Inbox is clear"
          detail="No incoming work has been recorded. Empty means no event was fabricated."
        />
      ) : (
        <div className="record-grid">
          {items.map((item) => (
            <article className="record-card" key={item.id}>
              <div className="record-top">
                <span className="status-chip">{item.status}</span>
                <span className="record-id">{item.source}</span>
              </div>
              <h3>{item.subject}</h3>
              <p>{item.body}</p>
              <div className="record-meta">
                <span>
                  {item.assignedWorkerId
                    ? `Worker ${item.assignedWorkerId.slice(0, 8)}`
                    : 'Unassigned'}
                </span>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function DecisionLog({ companyId }: { companyId: string }) {
  const [decisions, setDecisions] = useState<api.Decision[]>([]);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    api
      .listDecisions(companyId)
      .then((result) => setDecisions(result.decisions))
      .catch((reason) =>
        setFailure(reason instanceof Error ? reason.message : 'Could not load decision log'),
      )
      .finally(() => setBusy(false));
  }, [companyId]);

  return (
    <div className="page-body">
      <Toolbar eyebrow="DECISION MEMORY" title="Why did we choose this?" />
      <p className="muted">
        Decisions retain the proposal, reason, alternatives, evidence, reviewers, and approval state
        that led to an outcome.
      </p>
      {failure ? (
        <ErrorState message={failure} />
      ) : busy ? (
        <LoadingState />
      ) : decisions.length === 0 ? (
        <EmptyState
          title="No decisions recorded"
          detail="Approved and proposed company decisions will appear here once the company makes a recorded choice."
        />
      ) : (
        <div className="record-grid">
          {decisions.map((decision) => (
            <article className="record-card" key={decision.id}>
              <div className="record-top">
                <span className="status-chip">{decision.status}</span>
                <span className="record-id">
                  {new Date(decision.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h3>{decision.decision}</h3>
              <p>{decision.reason || 'No reason recorded.'}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
