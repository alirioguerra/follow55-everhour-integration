// 2. TimesheetState.ts (Gerenciamento de estado)
import { EverhourProject, EverhourTask } from '../models/interfaces';
import { TimeFormatter } from '../utils/timeFormatter';
import { WeeklyTaskManager } from './WeeklyTaskManager';
import * as vscode from 'vscode';

export class TimesheetState {
  private _projects: EverhourProject[] = [];
  private _tasks: EverhourTask[] = [];
  private _selectedProjectId: string | null = null;
  private _currentTimer: {taskId?: string, startTime?: number} = {};
  private _searchTerm: string = '';
  private _weeklyTaskManager: WeeklyTaskManager;
  private _recentProjects: string[] = []; // Store recent project IDs
  private static readonly MAX_RECENT_PROJECTS = 3;
  private static readonly WORKSPACE_PROJECT_KEY = 'everhourWorkspaceProject';
  private _onProjectSelected: ((projectId: string) => Promise<void>) | undefined;
  
  constructor(weeklyTaskManager: WeeklyTaskManager) {
    this._weeklyTaskManager = weeklyTaskManager;
    this.loadRecentProjects();
  }
  
  public setProjectSelectedCallback(callback: (projectId: string) => Promise<void>) {
    this._onProjectSelected = callback;
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
    
    const searchTerm = this._searchTerm.toLowerCase();
    return this._tasks.filter(task => 
      task.name.toLowerCase().includes(searchTerm)
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
    this._onProjectSelected?.(projectId);
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
  
  setSearchTerm(term: string | undefined) {
    this._searchTerm = term || '';
  }

  public async loadWorkspaceProject() {
    const workspaceProjectId = this.getWorkspaceProjectId();
    if (workspaceProjectId) {
      this.setSelectedProject(workspaceProjectId);
    }
  }

  public getWorkspaceProjectId(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return undefined;
    }
    
    const workspaceState = this._weeklyTaskManager.context.workspaceState;
    return workspaceState.get<string>(TimesheetState.WORKSPACE_PROJECT_KEY);
  }

  public async linkWorkspaceToProject(projectId: string): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder is open');
    }

    const project = this._projects.find(p => p.id === projectId);
    if (!project) {
      throw new Error('Invalid project ID');
    }

    const workspaceState = this._weeklyTaskManager.context.workspaceState;
    await workspaceState.update(TimesheetState.WORKSPACE_PROJECT_KEY, projectId);
    this.setSelectedProject(projectId);
  }

  public async unlinkWorkspaceProject(): Promise<void> {
    const workspaceState = this._weeklyTaskManager.context.workspaceState;
    await workspaceState.update(TimesheetState.WORKSPACE_PROJECT_KEY, undefined);
  }
}