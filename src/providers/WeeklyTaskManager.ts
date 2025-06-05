import * as vscode from 'vscode';
import { EverhourTask, WeeklyTask } from '../models/interfaces';

export class WeeklyTaskManager {
  private static STORAGE_KEY = 'weeklyTasks';
  private context: vscode.ExtensionContext;
  private weeklyTasks: WeeklyTask[] = [];
  
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadTasks();
  }
  
  // Adiciona uma tarefa do Everhour para a lista semanal
  public addEverhourTask(everhourTask: EverhourTask): void {
    const existingTask = this.weeklyTasks.find(t => t.everhourId === everhourTask.id);
    
    if (existingTask) {
      // Atualiza a tarefa existente se necessário
      existingTask.name = everhourTask.name;
    } else {
      // Cria uma nova tarefa semanal
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
  
  // Remove uma tarefa da lista
  public removeTask(taskId: string): void {
    this.weeklyTasks = this.weeklyTasks.filter(t => t.id !== taskId);
    this.saveTasks();
  }
  
  // Obtém todas as tarefas da semana
  public getWeeklyTasks(): WeeklyTask[] {
    return [...this.weeklyTasks];
  }
  
  // Verifica se uma tarefa do Everhour já está na lista semanal
  public isTaskInWeeklyList(everhourTaskId: string): boolean {
    return this.weeklyTasks.some(task => task.everhourId === everhourTaskId);
  }
  
  // Get a weekly task by its Everhour ID
  public getWeeklyTaskById(everhourTaskId: string): WeeklyTask | undefined {
    return this.weeklyTasks.find(task => task.everhourId === everhourTaskId);
  }
  
  // Limpa todas as tarefas da semana
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