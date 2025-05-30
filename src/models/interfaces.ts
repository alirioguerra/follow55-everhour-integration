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
  id: string; // ID interno para gerenciamento
  everhourId: string; // ID da tarefa no Everhour
  name: string;
  createdAt?: number;
  originalTask?: EverhourTask; // Dados completos da tarefa original
}