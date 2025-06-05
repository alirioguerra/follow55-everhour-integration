import * as vscode from 'vscode';
import { EverhourTask, WeeklyTask } from '../models/interfaces';

export class WeeklyTaskManager {
  private static STORAGE_KEY = 'weeklyTasks';
  public readonly context: vscode.ExtensionContext;
  private weeklyTasks: WeeklyTask[] = [];
  
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadTasks();
  }
  
  // Add an Everhour task to the weekly list
  public addEverhourTask(everhourTask: EverhourTask): void {
    const existingTask = this.weeklyTasks.find(t => t.everhourId === everhourTask.id);
    
    if (existingTask) {
      // Update existing task if necessary
      existingTask.name = everhourTask.name;
    } else {
      // Create a new weekly task
      const newTask: WeeklyTask = {
        id: Date.now().toString(),
        everhourId: everhourTask.id,
        name: everhourTask.name,
        createdAt: Date.now(),
        originalTask: everhourTask
      };
      
      this.weeklyTasks.push(newTask);
    }
    
    this.saveTasks();
  }
  
  // Remove a task from the list
  public removeTask(taskId: string): void {
    this.weeklyTasks = this.weeklyTasks.filter(t => t.id !== taskId);
    this.saveTasks();
  }
  
  // Get all weekly tasks
  public getWeeklyTasks(): WeeklyTask[] {
    return [...this.weeklyTasks];
  }
  
  // Check if an Everhour task is already in the weekly list
  public isTaskInWeeklyList(everhourTaskId: string): boolean {
    return this.weeklyTasks.some(task => task.everhourId === everhourTaskId);
  }
  
  // Get a weekly task by its Everhour ID
  public getWeeklyTaskById(everhourTaskId: string): WeeklyTask | undefined {
    return this.weeklyTasks.find(task => task.everhourId === everhourTaskId);
  }
  
  // Clear all weekly tasks
  public clearAllTasks(): void {
    this.weeklyTasks = [];
    this.saveTasks();
  }
  
  // Pin a task
  public pinTask(taskId: string): void {
    // First unpin any currently pinned task
    const currentlyPinned = this.weeklyTasks.find(t => t.pinned);
    if (currentlyPinned) {
      currentlyPinned.pinned = false;
    }

    // Then pin the new task
    const task = this.weeklyTasks.find(t => t.id === taskId);
    if (task) {
      task.pinned = true;
      this.saveTasks();
    }
  }
  
  // Unpin a task
  public unpinTask(taskId: string): void {
    const task = this.weeklyTasks.find(t => t.id === taskId);
    if (task) {
      task.pinned = false;
      this.saveTasks();
    }
  }
  
  // Get all pinned tasks
  public getPinnedTasks(): WeeklyTask[] {
    return this.weeklyTasks.filter(task => task.pinned);
  }
  
  private loadTasks(): void {
    const savedTasks = this.context.globalState.get<WeeklyTask[]>(WeeklyTaskManager.STORAGE_KEY);
    this.weeklyTasks = savedTasks || [];
  }
  
  private saveTasks(): void {
    this.context.globalState.update(WeeklyTaskManager.STORAGE_KEY, this.weeklyTasks);
  }
}