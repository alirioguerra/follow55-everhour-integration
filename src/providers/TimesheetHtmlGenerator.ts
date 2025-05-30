import * as vscode from 'vscode';
import { WeeklyTaskManager } from './WeeklyTaskManager';
import { TimesheetState } from './TimesheetState';
import { WeeklyTask, EverhourTask, EverhourProject } from '../models/interfaces';
import { TimeFormatter } from '../utils/timeFormatter';

interface TemplateData {
  projectsHtml: string;
  tasksHtml: string;
  weeklyTasksHtml: string;
  styles: string;
  scripts: string;
  searchTerm: string;
}

export class TimesheetHtmlGenerator {
  constructor(
    private readonly weeklyTaskManager: WeeklyTaskManager,
    private readonly state: TimesheetState,
    private readonly webview: vscode.Webview,
    private readonly context: vscode.ExtensionContext
  ) {}
  
  public generateHtml(): string {
    const templateData: TemplateData = {
      projectsHtml: this.generateProjectsHtml(),
      tasksHtml: this.generateTasksHtml(),
      weeklyTasksHtml: this.generateWeeklyTasksHtml(),
      styles: this.getStyles(),
      scripts: this.getScripts(),
      searchTerm: this.escapeHtml(this.state.searchTerm)
    };
    
    return this.renderTemplate(templateData);
  }
  
  private renderTemplate(data: TemplateData): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Everhour Tasks</title>
    <style>${data.styles}</style>
</head>
<body>
    <div class="header">
        <select id="projectSelect" onchange="selectProject(this.value)" aria-label="Select project">
            ${data.projectsHtml}
        </select>
         <input type="search" id="taskSearch" 
               placeholder="Search tasks..." 
               value="${data.searchTerm}"
               oninput="onSearchInput(this.value)"
               aria-label="Search tasks"/>
        <button onclick="refresh()" aria-label="Refresh data">Refresh</button>
    </div>
    
    ${data.weeklyTasksHtml}
    
    <div id="tasks" role="list">${data.tasksHtml}</div>
    
    <script>${data.scripts}</script>
</body>
</html>`;
  }
  
  private generateProjectsHtml(): string {
    return this.state.projects
    .map(p => `<option value="${p.id}" ${p.id === this.state.selectedProjectId ? 'selected' : ''}>
                  ${this.escapeHtml(p.name)} ${p.status ? `(${p.status})` : ''}
                </option>`)
      .join('\n');
    }
    
    private generateTasksHtml(): string {
      if (this.state.filteredTasks.length === 0) {
        return `<div class="no-tasks" role="alert">No tasks found</div>`;
      }
      
      return this.state.filteredTasks
      .map(task => this.generateTaskHtml(task))
      .join('');
    }
    
    private generateTaskHtml(task: EverhourTask): string {
      const isRunning = this.state.isTaskRunning(task.id);
      const isInWeeklyList = this.weeklyTaskManager.isTaskInWeeklyList(task.id);
      
      // Prepara os dados completos da tarefa para o atributo data
      const taskData = {
        id: task.id,
        name: task.name,
        projects: task.projects,
        section: task.section,
        time: task.time,
        estimate: task.estimate,
        dueAt: task.dueAt
      };
      
      // Formata informações adicionais
      const projectInfo = task.projects && task.projects.length > 0 ? 
      `<span class="task-project">${this.getProjectName(task.projects[0])}</span>` : '';
      
      const dueInfo = task.dueAt ? 
      `<span class="task-due ${this.isOverdue(task.dueAt) ? 'overdue' : ''}">
        (due: ${new Date(task.dueAt).toLocaleDateString()})
      </span>` : '';
      
      return `<div class="task ${isRunning ? 'active' : ''}" 
                 data-task-id="${task.id}"
                 data-task-data='${this.escapeHtml(JSON.stringify(taskData))}'
                 role="listitem"
                 aria-label="${this.escapeHtml(task.name)}">
              <div class="task-info">
                <div class="task-name" title="${this.escapeHtml(task.name)}">
                  ${this.escapeHtml(task.name)}
                </div>
                <div class="task-meta">
                  ${projectInfo}
                  ${dueInfo}
                </div>
              </div>
              <div class="task-time">
                ${this.formatTaskTime(task)}
              </div>
              <div class="task-actions">
                  ${this.generateTaskActionButtons(task.id, isRunning, isInWeeklyList)}
              </div>
          </div>`;
    }
    
    private getProjectName(projectId: string): string {
      const project = this.state.projects.find(p => p.id === projectId);
      return project ? this.escapeHtml(project.name) : '';
    }
    
    private isOverdue(dueAt: string): boolean {
      try {
        const dueDate = new Date(dueAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return dueDate < today;
      } catch {
        return false;
      }
    }
    
    private formatTaskTime(task: EverhourTask): string {
      const timeLogged = task.time?.total ? TimeFormatter.formatTime(task.time.total) : '0h 0m';
      
      if (task.estimate?.total) {
        const estimate = TimeFormatter.formatTime(task.estimate.total);
        return `<div class="time-logged">${timeLogged}</div>
              <div class="time-estimate">/ ${estimate}</div>`;
      }
      
      return `<div class="time-logged">${timeLogged}</div>`;
    }
    
    private generateTaskActionButtons(taskId: string, isRunning: boolean, isInWeeklyList: boolean): string {
      const timerButton = isRunning
      ? this.createButton({
        onClick: 'stopTimer()',
        icon: '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>',
        class: 'activity-status pause',
        title: 'Stop timer'
      })
      : this.createButton({
        onClick: `startTimer('${taskId}')`,
        icon: '<path d="M8 5v14l11-7z"/>',
        class: 'activity-status play',
        title: 'Start timer'
      });
      
      const weeklyButton = isInWeeklyList
      ? this.createButton({
        onClick: `removeFromWeeklyPlan('${taskId}')`,
        icon: '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>',
        class: 'remove-weekly',
        title: 'Remove from weekly plan'
      })
      : this.createButton({
        onClick: `addToWeeklyPlan('${taskId}')`,
        icon: '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>',
        class: 'add-weekly',
        title: 'Add to weekly plan'
      });
      
      return timerButton + weeklyButton;
    }
    
    private generateWeeklyTasksHtml(): string {
      const weeklyTasks = this.weeklyTaskManager.getWeeklyTasks();
      if (weeklyTasks.length === 0) {return '';}
      
      const clearAllButton = this.createButton({
        onClick: 'clearAllWeeklyTasks()',
        icon: '<path d="M6 2l2-2h8l2 2h5v2H1V2h5zM3 6v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6H3zm5 12V8h2v10H8zm6 0V8h2v10h-2z"/>',
        class: 'clear-all-btn',
        title: 'Clear all weekly tasks'
      });
      
      return `<div class="weekly-tasks-container" role="region" aria-label="Weekly tasks">
              <div class="weekly-header">
                  <h3>Weekly tasks</h3>
                  ${clearAllButton}
              </div>
              <div class="weekly-tasks-list" role="list">
                  ${weeklyTasks.map(task => this.generateWeeklyTaskHtml(task)).join('')}
              </div>
          </div>`;
    }
    
    private generateWeeklyTaskHtml(task: WeeklyTask): string {
      const isRunning = this.state.isTaskRunning(task.everhourId);
      const originalTask = task.originalTask;
      
      // Se temos a tarefa original, usamos esses dados
      const taskName = originalTask?.name || task.name;
      const projectName = originalTask?.projects?.[0] ? 
      ` (${this.getProjectName(originalTask.projects[0])})` : '';
      
      const baseTime = originalTask?.time?.total || 0;
      const elapsedTime = isRunning && this.state.currentTimer.startTime 
      ? Math.floor((Date.now() - this.state.currentTimer.startTime) / 60000)
      : 0;
      
      return `<div class="weekly-task ${isRunning ? 'running' : ''}" 
                   data-task-id="${task.id}" 
                   data-everhour-id="${task.everhourId}"
                   role="listitem">
          <div class="weekly-task-content">
            <div class="weekly-task-info">
              <div class="weekly-task-name">${this.escapeHtml(taskName)}${projectName}</div>
              ${originalTask?.dueAt ? 
      `<div class="weekly-task-due ${this.isOverdue(originalTask.dueAt) ? 'overdue' : ''}">
                  due: ${new Date(originalTask.dueAt).toLocaleDateString()}
                </div>` : ''}
            </div>
            <div class="weekly-task-actions">
              ${this.createButton({
      onClick: `removeFromWeeklyPlan('${task.everhourId}')`,
      icon: '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>',
      class: 'remove-task',
      title: 'Remove task'
    })}
              ${isRunning
    ? this.createButton({
      onClick: 'stopTimer()',
      icon: '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>',
      class: 'activity-status pause',
      title: 'Stop timer'
    })
    : this.createButton({
      onClick: `startTimer('${task.everhourId}')`,
      icon: '<path d="M8 5v14l11-7z"/>',
      class: 'activity-status play',
      title: 'Start timer'
    })}
            </div>
          </div>
          <div class="weekly-task-time" data-base-time="${baseTime}">
            ${TimeFormatter.formatTime(baseTime)}${elapsedTime > 0 ? ` (+${elapsedTime}m)` : ''}
          </div>
        </div>`;
  }
  
  private createButton(options: {
    onClick: string;
    icon: string;
    class?: string;
    title?: string;
  }): string {
    return `<button class="${options.class || ''}" 
                   onclick="${options.onClick}"
                   title="${options.title || ''}"
                   aria-label="${options.title || ''}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                ${options.icon}
              </svg>
            </button>`;
  }
  
  private escapeHtml(text: string): string {
    if (!text) {return '';}
    return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  }
  
  private getStylesUri(): vscode.Uri {
    const cssPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'timesheet.css');
    return this.webview.asWebviewUri(cssPath);
  }
  
  private getStyles(): string {
    return `@import url('${this.getStylesUri()}');`;
  }
  
  private getScripts(): string {
    return `const vscode = acquireVsCodeApi();
        
        function refresh() {
          vscode.postMessage({ command: 'refresh' });
        }
        
        function selectProject(projectId) {
          vscode.postMessage({ command: 'selectProject', projectId });
        }
        
        function startTimer(taskId) {
          const taskElement = document.querySelector(\`.task[data-task-id="\${taskId}"]\`);
          let taskData = null;
          
          if (taskElement) {
            taskData = JSON.parse(taskElement.dataset.taskData);
          }
          
          // Só adiciona à weekly se não estiver
          if (!isTaskInWeeklyPlan(taskId)) {
            addToWeeklyPlan(taskId);
          }
          
          vscode.postMessage({ 
            command: 'startTimer', 
            taskId, 
            autoAddToWeekly: true,
            taskData: taskData
          });
        }
        
        function stopTimer() {
          vscode.postMessage({ command: 'stopTimer' });
        }
        
        function addToWeeklyPlan(taskId) {
          const taskElement = document.querySelector(\`.task[data-task-id="\${taskId}"]\`);
          if (taskElement) {
            const taskData = JSON.parse(taskElement.dataset.taskData);
            vscode.postMessage({ 
              command: 'addToWeeklyPlan', 
              taskData: taskData
            });
          }
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
        
        function updateRunningTimers() {
          const runningTasks = document.querySelectorAll('.weekly-task.running');
          
          runningTasks.forEach(taskElement => {
            const timeElement = taskElement.querySelector('.weekly-task-time');
            const baseTime = parseInt(timeElement.dataset.baseTime) || 0;
            const startTime = ${this.state.currentTimer.startTime || 0};
            
            if (startTime && timeElement) {
              const update = () => {
                const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
                const formattedBaseTime = formatTime(baseTime);
                timeElement.textContent = \`\${formattedBaseTime} (+\${elapsedMinutes}m)\`;
              };
              
              update();
              const interval = setInterval(() => {
                // Verifica se a task ainda está rodando
                if (taskElement.classList.contains('running')) {
                  update();
                } else {
                  clearInterval(interval);
                }
              }, 60000);
            }
          });
        }
        
        function formatTime(totalSeconds) {
          if (!totalSeconds) return '0h 0m';
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          return \`\${hours}h \${minutes}m\`;
        }
    
        function isTaskInWeeklyPlan(taskId) {
          return !!document.querySelector(\`.weekly-task[data-everhour-id="\${taskId}"]\`);
        }
        
        document.addEventListener('DOMContentLoaded', () => {
          updateRunningTimers();
          
          // Atualiza a cada minuto para tarefas que estão rodando
          setInterval(updateRunningTimers, 60000);
        });`;
  }
}