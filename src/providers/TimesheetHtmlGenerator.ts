import * as vscode from 'vscode';
import { WeeklyTaskManager } from './WeeklyTaskManager';
import { TimesheetState } from './TimesheetState';
import { WeeklyTask, EverhourTask } from '../models/interfaces';
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
      <div class="project-selector">
      ${this.generateRecentProjectsHtml()}
        <select id="projectSelect" onchange="selectProject(this.value)" aria-label="Select project">
          ${data.projectsHtml}
        </select>
      </div>
      <input type="search" id="taskSearch" 
           placeholder="Search tasks..." 
           value="${data.searchTerm}"
           oninput="onSearchInput(this.value)"
           aria-label="Search tasks"/>
    </div>
    
    ${data.weeklyTasksHtml}
    
    <div class="tasks-header">
      <h2>Tasks in ${this.escapeHtml(
        this.state.projects.find(p => p.id === this.state.selectedProjectId)?.name || 'Project'
      )}</h2>
      <p class="task-count" role="status">
        ${this.state.filteredTasks.length} task${this.state.filteredTasks.length !== 1 ? 's' : ''}
      </p>
    </div>
    <div id="tasks" role="list">${data.tasksHtml}</div>

    <!-- Custom confirmation modal -->
    <div id="confirmModal" class="modal" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">Confirm Action</div>
        <div class="modal-body">
          <p id="confirmMessage">Are you sure?</p>
        </div>
        <div class="modal-footer">
          <button id="confirmCancel" class="btn-secondary">Cancel</button>
          <button id="confirmOk" class="btn-primary">OK</button>
        </div>
      </div>
    </div>
    
    <script>${data.scripts}</script>
  </body>
  </html>`;
  }
  
  private generateProjectsHtml(): string {
    return this.state.projects
    .map(p => `<option value="${p.id}" ${p.id === this.state.selectedProjectId ? 'selected' : ''}>
                  ${this.escapeHtml(p.name)}
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
      
      return `<div class="task ${isRunning ? 'active' : ''}" 
                 data-task-id="${task.id}"
                 role="listitem"
                 aria-label="${this.escapeHtml(task.name)}, ${TimeFormatter.formatTime(task.time?.total)}">
              <div class="task-name" title="${this.escapeHtml(task.name)}">${this.escapeHtml(task.name)}</div>
              <div class="task-details">
                <div class="task-time">${TimeFormatter.formatTime(task.time?.total)}</div>
                <div class="task-actions">
                    ${this.generateTaskActionButtons(task.id, isRunning, isInWeeklyList)}
                </div>
              </div>
          </div>`;
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
        onClick: 'showClearAllConfirmation()',
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
      
      const timerButton = isRunning
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
      });
      
      const pinButton = task.pinned
        ? this.createButton({
          onClick: `unpinTask('${task.id}')`,
          icon: '<path d="M17 4v7l2 3v2h-6v5l-1 1-1-1v-5H5v-2l2-3V4c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2z"/>',
          class: 'pin-button pinned',
          title: 'Unpin task'
        })
        : this.createButton({
          onClick: `pinTask('${task.id}')`,
          icon: '<path d="M17 4v7l2 3v2h-6v5l-1 1-1-1v-5H5v-2l2-3V4c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2zM9 4v7.75L7 15h10l-2-3.25V4H9z"/>',
          class: 'pin-button',
          title: 'Pin task'
        });
      
      // Get the most up-to-date time from the original task if available
      const baseTime = task.originalTask?.time?.total || 0;
      const elapsedTime = isRunning && this.state.currentTimer.startTime 
        ? Math.floor((Date.now() - this.state.currentTimer.startTime) / 1000)
        : 0;
      
      const totalTime = baseTime + elapsedTime;
      const elapsedMinutes = Math.floor(elapsedTime / 60);
      
      return `<div class="weekly-task ${isRunning ? 'running' : ''}" 
                   data-task-id="${task.id}" 
                   data-everhour-id="${task.everhourId}"
                   role="listitem">
          <div class="weekly-task-name">${this.escapeHtml(task.name)}</div>
          <div class="weekly-task-details">
            <div class="weekly-task-time" data-base-time="${baseTime}" data-total-time="${totalTime}">
              ${TimeFormatter.formatTime(baseTime)}${isRunning ? ` (+${elapsedMinutes}m)` : ''}
            </div>
            <div class="weekly-task-actions">
              ${pinButton}
              ${this.createButton({
                onClick: `removeFromWeeklyPlan('${task.everhourId}')`,
                icon: '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>',
                class: 'remove-task',
                title: 'Remove task'
              })}
              ${timerButton}
            </div>
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

    // Custom confirmation modal functionality
        let confirmCallback = null;
        
        function showConfirmModal(message, callback) {
          const modal = document.getElementById('confirmModal');
          const messageEl = document.getElementById('confirmMessage');
          const confirmOk = document.getElementById('confirmOk');
          const confirmCancel = document.getElementById('confirmCancel');
          
          messageEl.textContent = message;
          modal.style.display = 'flex';
          confirmCallback = callback;
          
          // Focus on cancel button by default
          confirmCancel.focus();
        }
        
        function hideConfirmModal() {
          const modal = document.getElementById('confirmModal');
          modal.style.display = 'none';
          confirmCallback = null;
        }
        
        // Modal event listeners
        document.addEventListener('DOMContentLoaded', () => {
          const confirmOk = document.getElementById('confirmOk');
          const confirmCancel = document.getElementById('confirmCancel');
          const modal = document.getElementById('confirmModal');
          
          confirmOk.addEventListener('click', () => {
            if (confirmCallback) {
              confirmCallback();
            }
            hideConfirmModal();
          });
          
          confirmCancel.addEventListener('click', () => {
            hideConfirmModal();
          });
          
          // Close modal when clicking outside
          modal.addEventListener('click', (e) => {
            if (e.target === modal) {
              hideConfirmModal();
            }
          });
          
          // Handle escape key
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
              hideConfirmModal();
            }
          });
        });
        
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
        
        function pinTask(taskId) {
          vscode.postMessage({ command: 'pinTask', taskId });
        }
        
        function unpinTask(taskId) {
          vscode.postMessage({ command: 'unpinTask', taskId });
        }
        
        function showClearAllConfirmation() {
          showConfirmModal('Are you sure you want to clear all weekly tasks?', () => {
            vscode.postMessage({ command: 'clearAllWeeklyTasks' });
          });
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
                const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
                const elapsedMinutes = Math.floor(elapsedSeconds / 60);
                const totalTime = baseTime + elapsedSeconds;
                timeElement.dataset.totalTime = totalTime.toString();
                timeElement.textContent = formatTime(baseTime) + ' (+' + elapsedMinutes + 'm)';
              };
              
              update();
              const interval = setInterval(() => {
                if (taskElement.classList.contains('running')) {
                  update();
                } else {
                  clearInterval(interval);
                }
              }, 1000); // Update every second
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
          // Procura na DOM se existe um elemento weekly-task com o everhour-id igual ao taskId
          return !!document.querySelector(\`.weekly-task[data-everhour-id="\${taskId}"]\`);
        }
        
        document.addEventListener('DOMContentLoaded', () => {
          updateRunningTimers();
          
          // Atualiza a cada minuto para tarefas que estão rodando
          setInterval(updateRunningTimers, 60000);
        });`;
  }

  private generateRecentProjectsHtml(): string {
    const recentProjects = this.state.recentProjects;
    if (recentProjects.length === 0) {
      return '';
    }

    return `
      <div class="recent-projects">
        <h2>Projects</h2>
        <span class="recent-label">Recent:</span>
        <div class="recent-projects-list">
          ${recentProjects.map(project => `
            <button 
              onclick="selectProject('${project.id}')"
              class="recent-project-btn ${project.id === this.state.selectedProjectId ? 'active' : ''}"
              title="${this.escapeHtml(project.name)}"
            >
              ${this.escapeHtml(project.name)}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }
}