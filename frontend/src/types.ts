export type View =
  | 'overview'
  | 'missions'
  | 'tasks'
  | 'agents'
  | 'workers'
  | 'training'
  | 'departments'
  | 'activity'
  | 'inbox'
  | 'decisions'
  | 'command'
  | 'integrations'
  | 'settings'
  | 'showcase';

export type Notice = { kind: 'success' | 'error'; text: string } | null;
