export interface EverhourProject {
  id: string;
  name: string;
  status: string;
}

export interface EverhourTask {
  id: string;
  name: string;
  projects: string[];
  section?: number;
  labels?: string[];
  position?: number;
  dueAt?: string;
  time?: {
    total?: number;
    users?: Record<string, number>;
  };
  estimate?: {
    total?: number;
    type?: string;
    users?: Record<string, number>;
  };
}

export interface WeeklyTask {
  id: string; // Internal management ID
  everhourId: string; // Everhour task ID
  name: string;
  createdAt?: number;
  originalTask?: EverhourTask; // Complete original task data
  pinned?: boolean; // Whether the task is pinned or not
}