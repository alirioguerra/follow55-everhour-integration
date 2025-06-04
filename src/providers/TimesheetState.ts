// 2. TimesheetState.ts (Gerenciamento de estado)
import { EverhourProject, EverhourTask } from '../models/interfaces';
import { TimeFormatter } from '../utils/timeFormatter';
import { WeeklyTaskManager } from './WeeklyTaskManager';

export class TimesheetState {
  private _projects: EverhourProject[] = [];
  private _tasks: EverhourTask[] = [];
  private _selectedProjectId: string | null = null;
  private _currentTimer: {taskId?: string, startTime?: number} = {};
  private _searchTerm: string = '';
  private _weeklyTaskManager: WeeklyTaskManager;
  
  constructor(weeklyTaskManager: WeeklyTaskManager) {
    this._weeklyTaskManager = weeklyTaskManager;
  }
  
  // Projects
  get projects(): EverhourProject[] {
    return this._projects;
  }
  
  setProjects(projects: EverhourProject[]) {
    this._projects = projects;
  }
  
  // Tasks
  get tasks(): EverhourTask[] {
    return this._tasks;
  }
  
  get filteredTasks(): EverhourTask[] {
    if (!this._searchTerm) {
      return this._tasks;
    }
    return this._tasks.filter(task => 
      task.name.toLowerCase().includes(this._searchTerm.toLowerCase())
    );
  }
  
  setTasks(rawTasks: any[]) {
    this._tasks = rawTasks.map(task => ({
      ...task,
      name: task.name || 'Unnamed task',
      status: task.status || 'open',
      projects: task.projects || [],
      time: {
        total: task.time?.total || 0,
        today: TimeFormatter.calculateTodayTime(task.time?.users)
      },
      dueAt: task.dueAt,
      labels: task.labels || []
    }));
  }
  
  getTaskById(taskId: string): EverhourTask | undefined {
    return this._tasks.find(t => t.id === taskId);
  }
  
  getTaskName(taskId: string): string {
    // First try to find in regular tasks
    const task = this.getTaskById(taskId);
    if (task) {
        return task.name;
    }
    
    // If not found in regular tasks, check weekly tasks
    const weeklyTask = this._weeklyTaskManager?.getWeeklyTaskById(taskId);
    if (weeklyTask) {
        return weeklyTask.name;
    }
    
    return 'Unknown task';
  }
  
  // Project selection
  get selectedProjectId(): string | null {
    return this._selectedProjectId;
  }
  
  setSelectedProject(projectId: string) {
    this._selectedProjectId = projectId;
  }
  
  // Timer
  get currentTimer() {
    return this._currentTimer;
  }
  
  setCurrentTimer(timer: {taskId?: string, startTime?: number}) {
    this._currentTimer = timer;
  }
  
  isTaskRunning(taskId: string): boolean {
    return this._currentTimer.taskId === taskId;
  }
  
  // Search
  get searchTerm(): string {
    return this._searchTerm;
  }
  
  setSearchTerm(term: string) {
    this._searchTerm = term.trim().toLowerCase();
  }
}