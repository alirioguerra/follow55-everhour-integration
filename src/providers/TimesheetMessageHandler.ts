// 3. TimesheetMessageHandler.ts (Handler de mensagens)
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
  
  async handleMessage(message: any) {
    try {
      switch (message.command) {
        case 'refresh':
        await this.handleRefresh();
        break;
        case 'selectProject':
        await this.handleSelectProject(message.projectId);
        break;
        case 'startTimer':
        await this.handleStartTimer(message.taskId);
        break;
        case 'stopTimer':
        await this.handleStopTimer();
        break;
        case 'logTime':
        await this.handleLogTime(message.taskId, message.time);
        break;
        case 'searchTasks':
        this.handleSearchTasks(message.query);
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
      }
    } catch (error) {
      console.error('Error handling message:', error);
      vscode.window.showErrorMessage(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  private async handleRefresh() {
    // Implementar refresh logic
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
    
    const elapsedMinutes = this.state.currentTimer.startTime 
    ? Math.floor((Date.now() - this.state.currentTimer.startTime) / 60000)
    : 0;
    
    const taskName = this.state.getTaskName(this.state.currentTimer.taskId || '');
    this.state.setCurrentTimer({});
    this.updateViewCallback();
    
    vscode.window.showInformationMessage(
      `Timer stopped for ${taskName}. Elapsed time: ${elapsedMinutes} minutes`
    );
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
}