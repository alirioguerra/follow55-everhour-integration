import * as vscode from 'vscode';
import { WeeklyTaskManager } from './WeeklyTaskManager';
import { TimesheetState } from './TimesheetState';
import { WeeklyTask, EverhourTask } from '../models/interfaces';
import { TimeFormatter } from '../utils/timeFormatter';

export class TimesheetHtmlGenerator {
  constructor(
    private weeklyTaskManager: WeeklyTaskManager,
    private state: TimesheetState
  ) {}
  
  generateHtml(webview: vscode.Webview, context: vscode.ExtensionContext): string {
    const projectsHtml = this.generateProjectsHtml();
    const activeTaskHtml = this.generateActiveTaskHtml();
    const tasksHtml = this.generateTasksHtml();
    const weeklyTasksHtml = this.generateWeeklyTasksHtml();
    
    return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <title>Everhour Tasks</title>
                <style>${this.getStyles()}</style>
            </head>
            <body>
                <div class="header">
                    <input 
                        type="search" 
                        id="taskSearch" 
                        placeholder="Search tasks..." 
                        value="${this.escapeHtml(this.state.searchTerm)}"
                        oninput="onSearchInput(this.value)"
                    />
                    <select id="projectSelect" onchange="selectProject(this.value)">
                        ${projectsHtml}
                    </select>
                    <button onclick="refresh()">Refresh</button>
                </div>
                
                ${weeklyTasksHtml}
                ${activeTaskHtml}
                
                <div id="tasks">${tasksHtml}</div>
                
                <script>${this.getScripts()}</script>
            </body>
            </html>
        `;
  }
  
  private generateProjectsHtml(): string {
    return this.state.projects
    .map(p => `<option value="${p.id}" ${p.id === this.state.selectedProjectId ? 'selected' : ''}>${p.name}</option>`)
    .join('\n');
  }
  
  private generateActiveTaskHtml(): string {
    const activeTask = this.state.activeTask;
    if (!activeTask) {return '';}
    
    return `
            <div class="active-task-container">
                <div class="active-task-header">ACTIVE TASK</div>
                <div class="active-task">
                    <div class="task-name">${activeTask.name}</div>
                    <div class="active-task-time">
                        ${TimeFormatter.formatTime(activeTask.time?.total)}
                        ${this.state.currentTimer.startTime 
    ? ` (${Math.floor((Date.now() - this.state.currentTimer.startTime) / 60000)}m)`
    : ''}
                    </div>
                    <button class="activity-status pause" onclick="stopTimer()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 5h4v14H6zm8 0h4v14h-4z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
  }
  
  private generateTasksHtml(): string {
    const tasks = this.state.filteredTasks;
    
    if (tasks.length === 0) {
      return `<div class="no-tasks">No tasks found</div>`;
    }
    
    return tasks.map(task => this.generateTaskHtml(task)).join('');
  }
  
  private generateTaskHtml(task: EverhourTask): string {
    const isRunning = this.state.isTaskRunning(task.id);
    const isInWeeklyList = this.weeklyTaskManager.isTaskInWeeklyList(task.id);
    
    return `
            <div class="task ${isRunning ? 'active' : ''}" data-task-id="${task.id}">
                <div class="task-name">${task.name}</div>
                <div>${TimeFormatter.formatTime(task.time?.total)}</div>
                <div class="task-actions">
                    ${this.generateTaskActionButtons(task.id, isRunning, isInWeeklyList)}
                </div>
            </div>
        `;
  }
  
  private generateTaskActionButtons(taskId: string, isRunning: boolean, isInWeeklyList: boolean): string {
    const timerButton = isRunning
    ? `<button class="activity-status pause" onclick="stopTimer()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 5h4v14H6zm8 0h4v14h-4z"/>
                </svg>
                </button>`
    : `<button class="activity-status play" onclick="startTimer('${taskId}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5v14l11-7z"/>
                </svg>
            </button>`;
    
    const weeklyButton = isInWeeklyList 
    ? `<button class="remove-weekly" onclick="removeFromWeeklyPlan('${taskId}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>`
    : `<button class="add-weekly" onclick="addToWeeklyPlan('${taskId}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
            </button>`;
    
    return timerButton + weeklyButton;
  }
  
  private generateWeeklyTasksHtml(): string {
    const weeklyTasks = this.weeklyTaskManager.getWeeklyTasks();
    if (weeklyTasks.length === 0) {return '';}
    
    return `
            <div class="weekly-tasks-container">
                <div class="weekly-header">
                    <h3>Weekly tasks</h3>
                    <button class="clear-all-btn" onclick="clearAllWeeklyTasks()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 2l2-2h8l2 2h5v2H1V2h5zM3 6v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6H3zm5 12V8h2v10H8zm6 0V8h2v10h-2z"/>
                        </svg>
                    </button>
                </div>
                <div class="weekly-tasks-list">
                    ${weeklyTasks.map(task => this.generateWeeklyTaskHtml(task)).join('')}
                </div>
            </div>
        `;
  }
  
  private generateWeeklyTaskHtml(task: WeeklyTask): string {
    return `
            <div class="weekly-task" data-task-id="${task.id}">
                <div class="weekly-task-name">${task.name}</div>
                <div class="weekly-task-actions">
                    <button class="remove-task" onclick="removeFromWeeklyPlan('${task.everhourId}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
  }
  
  private escapeHtml(text: string): string {
    return text.replace(/"/g, '&quot;');
  }
  
  private getStyles(): string {
    // Move all CSS styles here (same as original)
    return `body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                margin: 0;
                padding: 8px;
            }
            .header {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 8px;
            }
            select, input[type=search] {
                background-color: var(--vscode-dropdown-background);
                color: var(--vscode-dropdown-foreground);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 3px;
                font-size: 13px;
                padding: 3px 6px;
            }
            .task {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 4px;
                gap: 8px;
                border-bottom: 1px solid var(--vscode-editorGroup-border);
            }
            .task.active {
                background-color: var(--vscode-editor-selectionHighlightBackground);
                border-left: 3px solid var(--vscode-button-background);
                padding-left: 8px;
            }
            .task-name {
                flex: 1 1 80px;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .task-actions {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .activity-status {
                border: none;
                cursor: pointer;
                color: white;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background-color 0.2s ease;
            }
            .activity-status.play {
                background-color: green;
            }
            .activity-status.play:hover {
                background-color: darkgreen;
            }
            .activity-status.pause {
                background-color: red;
            }
            .activity-status.pause:hover {
                background-color: darkred;
            }
            .activity-status svg {
                flex-shrink: 0;
                width: 13px;
                height: 13px;
                fill: currentColor;
            }
            button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 3px;
                padding: 4px 8px;
                cursor: pointer;
            }
            .no-tasks {
                padding: 12px;
                color: var(--vscode-descriptionForeground);
                font-style: italic;
            }
            .active-task-container {
                background-color: var(--vscode-editor-selectionBackground);
                border-radius: 4px;
                margin-bottom: 12px;
                padding: 8px;
                animation: pulse 2s infinite;
            }
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.8; }
                100% { opacity: 1; }
            }
            .active-task-header {
                font-size: 0.8em;
                font-weight: bold;
                margin-bottom: 4px;
                color: var(--vscode-foreground);
                opacity: 0.8;
            }
            .active-task {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .active-task .task-name {
                font-weight: bold;
                flex-grow: 1;
            }
            .active-task-time {
                font-family: monospace;
                font-size: 0.9em;
            }
            .weekly-tasks-container {
                margin-bottom: 16px;
                background-color: var(--vscode-sideBar-background);
                border-radius: 4px;
                padding: 8px;
                border: 1px solid var(--vscode-panel-border);
            }
            .weekly-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            .weekly-header h3 {
                margin: 0;
                font-size: 1.1em;
                color: var(--vscode-foreground);
            }
            .clear-all-btn {
                background-color: var(--vscode-errorForeground);
                color: white;
                border: none;
                border-radius: 3px;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 0.8em;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .clear-all-btn:hover {
                opacity: 0.8;
            }
            .weekly-tasks-list {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .weekly-task {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px;
                background-color: var(--vscode-editor-background);
                border-radius: 3px;
                border: 1px solid var(--vscode-editorGroup-border);
            }
            .weekly-task-name {
                flex-grow: 1;
                font-size: 0.9em;
            }
            .weekly-task-actions {
                display: flex;
                gap: 4px;
                align-items: center;
            }
            .remove-task, .remove-weekly, .add-weekly {
                cursor: pointer;
                padding: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 3px;
                transition: background-color 0.2s ease;
            }
            .remove-task, .remove-weekly {
                color: var(--vscode-errorForeground);
                background-color: var(--vscode-errorBackground);
            }
            .add-weekly {
                color: var(--vscode-successForeground);
                background-color: var(--vscode-successBackground);
            }
    `;
  }
  
  private getScripts(): string {
    return `
            const vscode = acquireVsCodeApi();
            
            function refresh() {
                vscode.postMessage({ command: 'refresh' });
            }
            
            function selectProject(projectId) {
                vscode.postMessage({ command: 'selectProject', projectId });
            }
            
            function startTimer(taskId) {
                vscode.postMessage({ command: 'startTimer', taskId });
            }
            
            function stopTimer() {
                vscode.postMessage({ command: 'stopTimer' });
            }
            
            function addToWeeklyPlan(taskId) {
                vscode.postMessage({ command: 'addToWeeklyPlan', taskId });
            }
            
            function removeFromWeeklyPlan(taskId) {
                vscode.postMessage({ command: 'removeFromWeeklyPlan', taskId });
            }
            
            function clearAllWeeklyTasks() {
                if (confirm('Are you sure you want to clear all weekly tasks?')) {
                    vscode.postMessage({ command: 'clearAllWeeklyTasks' });
                }
            }
            
            let searchTimeout;
            function onSearchInput(value) {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    vscode.postMessage({ command: 'searchTasks', query: value });
                }, 300);
            }
            
            function updateActiveTimer() {
                const activeTaskElement = document.querySelector('.active-task-time');
                if (activeTaskElement) {
                    const startTime = ${this.state.currentTimer.startTime || 0};
                    if (startTime) {
                        const update = () => {
                            const minutes = Math.floor((Date.now() - startTime) / 60000);
                            const activeTask = ${JSON.stringify(this.state.activeTask)};
                            if (activeTask) {
                                activeTaskElement.textContent = \`${TimeFormatter.formatTime(this.state.activeTask?.time?.total || 0)} (\${minutes}m)\`;
                            }
                        };
                        update();
                        setInterval(update, 60000);
                    }
                }
            }
            
            window.addEventListener('load', () => {
                updateActiveTimer();
            });
        `;
  }
}