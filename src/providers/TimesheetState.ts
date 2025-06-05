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
  private _recentProjects: string[] = []; // Store recent project IDs
  private static readonly MAX_RECENT_PROJECTS = 3;
  
  constructor(weeklyTaskManager: WeeklyTaskManager) {
    this._weeklyTaskManager = weeklyTaskManager;
    this.loadRecentProjects();
  }
  
  // Projects
  get projects(): EverhourProject[] {
    return this._projects;
  }
  
  get recentProjects(): EverhourProject[] {
    return this._recentProjects
      .map(id => this._projects.find(p => p.id === id))
      .filter((p): p is EverhourProject => p !== undefined);
  }
  
  setProjects(projects: EverhourProject[]) {
    this._projects = projects;
  }
  
  private loadRecentProjects() {
    const saved = this._weeklyTaskManager.context.globalState.get<string[]>('recentProjects');
    if (saved) {
      this._recentProjects = saved;
    }
  }
  
  private saveRecentProjects() {
    this._weeklyTaskManager.context.globalState.update('recentProjects', this._recentProjects);
  }
  
  private addToRecentProjects(projectId: string) {
    // Remove if already exists
    this._recentProjects = this._recentProjects.filter(id => id !== projectId);
    
    // Add to the beginning
    this._recentProjects.unshift(projectId);
    
    // Keep only the last MAX_RECENT_PROJECTS
    if (this._recentProjects.length > TimesheetState.MAX_RECENT_PROJECTS) {
      this._recentProjects = this._recentProjects.slice(0, TimesheetState.MAX_RECENT_PROJECTS);
    }
    
    this.saveRecentProjects();
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
    this.addToRecentProjects(projectId);
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