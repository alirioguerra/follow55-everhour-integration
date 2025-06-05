// Message handler for the timesheet view
import * as vscode from 'vscode';
import { EverhourAPI } from '../utils/api';
import { WeeklyTaskManager } from './WeeklyTaskManager';
import { TimesheetState } from './TimesheetState';

export class TimesheetMessageHandler {
  constructor(
    private api: EverhourAPI,
    private weeklyTaskManager: WeeklyTaskManager,
    private state: TimesheetState,
    private updateViewCallback: () => void
  ) {}
  
  public async handleMessage(message: any) {
    try {
      switch (message.command) {
        case 'selectProject':
          await this.handleSelectProject(message.projectId);
          break;
        case 'startTimer':
          await this.handleStartTimer(message.taskId);
          break;
        case 'stopTimer':
          await this.handleStopTimer();
          break;
        case 'addToWeeklyPlan':
          await this.handleAddToWeeklyPlan(message.taskId);
          break;
        case 'removeFromWeeklyPlan':
          await this.handleRemoveFromWeeklyPlan(message.taskId);
          break;
        case 'clearAllWeeklyTasks':
          await this.handleClearAllWeeklyTasks();
          break;
        case 'pinTask':
          await this.handlePinTask(message.taskId);
          break;
        case 'unpinTask':
          await this.handleUnpinTask(message.taskId);
          break;
        case 'searchTasks':
          this.handleSearchTasks(message.query);
          break;
        case 'refresh':
          await this.handleRefresh();
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
      vscode.window.showErrorMessage(
        `Operation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  private async handleRefresh() {
    // Implement refresh logic
    this.updateViewCallback();
  }
  
  private async handleSelectProject(projectId: string) {
    this.state.setSelectedProject(projectId);
    const data = await this.api.fetchTasks(projectId);
    this.state.setTasks(data);
    this.updateViewCallback();
  }
  
  private async handleStartTimer(taskId: string) {
    await this.api.startTimer(taskId);
    this.state.setCurrentTimer({
      taskId,
      startTime: Date.now()
    });
    this.updateViewCallback();
    vscode.window.showInformationMessage(
      `Timer started for task ${this.state.getTaskName(taskId)}`
    );
  }
  
  private async handleStopTimer() {
    await this.api.stopTimer();
    
    const taskId = this.state.currentTimer.taskId;
    const startTime = this.state.currentTimer.startTime;
    
    if (taskId && startTime) {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        
        // Update the task's time in both weekly and regular tasks
        const task = this.state.getTaskById(taskId);
        if (task && task.time) {
            task.time.total = (task.time.total || 0) + elapsedSeconds;
        }
        
        const weeklyTask = this.weeklyTaskManager.getWeeklyTaskById(taskId);
        if (weeklyTask && weeklyTask.originalTask?.time) {
            weeklyTask.originalTask.time.total = (weeklyTask.originalTask.time.total || 0) + elapsedSeconds;
        }
        
        const taskName = this.state.getTaskName(taskId);
        const elapsedMinutes = Math.floor(elapsedSeconds / 60);
        
        this.state.setCurrentTimer({});
        this.updateViewCallback();
        
        vscode.window.showInformationMessage(
            `Timer stopped for ${taskName}. Elapsed time: ${elapsedMinutes} minutes`
        );
    } else {
        this.state.setCurrentTimer({});
        this.updateViewCallback();
    }
  }
  
  private async handleLogTime(taskId: string, minutes: number) {
    await this.api.logTime(taskId, minutes);
    vscode.window.showInformationMessage('Time logged successfully!');
    
    if (this.state.selectedProjectId) {
      const data = await this.api.fetchTasks(this.state.selectedProjectId);
      this.state.setTasks(data);
      this.updateViewCallback();
    }
  }
  
  private handleSearchTasks(query: string) {
    this.state.setSearchTerm(query);
    this.updateViewCallback();
  }
  
  private async handleAddToWeeklyPlan(taskId: string) {
    const task = this.state.getTaskById(taskId);
    if (task) {
      this.weeklyTaskManager.addEverhourTask(task);
      this.updateViewCallback();
      vscode.window.showInformationMessage(`Task "${task.name}" added to weekly plan`);
    }
  }
  
  private async handleRemoveFromWeeklyPlan(taskId: string) {
    const weeklyTasks = this.weeklyTaskManager.getWeeklyTasks();
    const weeklyTask = weeklyTasks.find(wt => wt.everhourId === taskId);
    
    if (weeklyTask) {
      this.weeklyTaskManager.removeTask(weeklyTask.id);
      this.updateViewCallback();
      vscode.window.showInformationMessage(`Task removed from weekly plan`);
    }
  }
  
  private async handleClearAllWeeklyTasks() {
    this.weeklyTaskManager.clearAllTasks();
    this.updateViewCallback();
    vscode.window.showInformationMessage('All weekly tasks cleared');
  }

  private async handlePinTask(taskId: string) {
    // Get the task name before pinning
    const task = this.weeklyTaskManager.getWeeklyTasks().find(t => t.id === taskId);
    const taskName = task?.name || 'Task';

    // Get currently pinned task before pinning
    const currentlyPinned = this.weeklyTaskManager.getWeeklyTasks().find(t => t.pinned);
    
    this.weeklyTaskManager.pinTask(taskId);
    this.updateViewCallback();

    if (currentlyPinned) {
      vscode.window.showInformationMessage(`Unpinned "${currentlyPinned.name}" and pinned "${taskName}"`);
    } else {
      vscode.window.showInformationMessage(`Task "${taskName}" pinned`);
    }
  }

  private async handleUnpinTask(taskId: string) {
    const task = this.weeklyTaskManager.getWeeklyTasks().find(t => t.id === taskId);
    const taskName = task?.name || 'Task';

    this.weeklyTaskManager.unpinTask(taskId);
    this.updateViewCallback();
    vscode.window.showInformationMessage(`Task "${taskName}" unpinned`);
  }
}