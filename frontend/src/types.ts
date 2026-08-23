export type View =
  | 'overview'
  | 'missions'
  | 'tasks'
  | 'agents'
  | 'departments'
  | 'activity'
  | 'command'
  | 'integrations'
  | 'settings';

export type Notice = { kind: 'success' | 'error'; text: string } | null;
