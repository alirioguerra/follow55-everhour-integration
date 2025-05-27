import * as vscode from 'vscode';
const fetch = require('node-fetch');

interface EverhourProject {
    id: string;
    name: string;
    status: string;
}

interface EverhourTask {
    id: string;
    name: string;
    status: 'open' | 'closed' | 'in_progress' | 'completed';
    projects: string[];
    section?: number;
    labels?: string[];
    position?: number;
    dueAt?: string;
    time?: {
        total?: number;
        users?: Record<string, number>;
    };
    estimate?: {
        total?: number;
        type?: string;
        users?: Record<string, number>;
    };
}

export class TimesheetViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'everhour.timesheetView';
    private _view?: vscode.WebviewView;
    private _projects: EverhourProject[] = [];
    private _tasks: EverhourTask[] = [];
    private _selectedProjectId: string | null = null;
    private _currentTimer: {taskId?: string, startTime?: number} = {};
    private _taskStatusFilter: 'all' | 'open' | 'closed' | 'in_progress' | 'completed' = 'all';
    private _searchTerm: string = '';
    
    constructor(private readonly context: vscode.ExtensionContext) {}
    
    public async resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };
        
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        
        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'refresh':
                    await this.loadData();
                    break;
                case 'selectProject':
                    await this.selectProject(message.projectId);
                    break;
                case 'startTimer':
                    await this.startTimer(message.taskId);
                    break;
                case 'stopTimer':
                    await this.stopTimer();
                    break;
                case 'logTime':
                    await this.logTime(message.taskId, message.time);
                    break;
                case 'changeStatusFilter':
                    this._taskStatusFilter = message.status;
                    this.updateView();
                    break;
                case 'searchTasks':
                    this._searchTerm = message.query.trim().toLowerCase();
                    this.updateView();
                    break;
            }
        });
        
        await this.loadData();
        await this.checkCurrentTimer();
    }
    
    private async loadData() {
        await this.fetchProjects();
        if (this._projects.length > 0 && !this._selectedProjectId) {
            await this.selectProject(this._projects[0].id);
        }
    }
    
    private async fetchProjects() {
        const token = this.context.globalState.get('everhourToken');
        if (!token) {
            this.updateView();
            return;
        }
        
        try {
            const response = await fetch('https://api.everhour.com/projects', {
                headers: {
                    'X-Api-Key': token
                }
            });
            
            if (response.ok) {
                this._projects = await response.json();
                this.updateView();
            } else {
                const error = await response.json();
                vscode.window.showErrorMessage(`Error fetching projects: ${error.message}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage('Failed to connect to Everhour');
            console.error(error);
        }
    }
    
    private async selectProject(projectId: string) {
        this._selectedProjectId = projectId;
        await this.fetchTasks(projectId);
    }
    
    private async fetchTasks(projectId: string) {
        const token = this.context.globalState.get('everhourToken');
        if (!token || !projectId) {
            vscode.window.showErrorMessage('Token or project ID not configured');
            return;
        }
        
        try {
            const response = await fetch(`https://api.everhour.com/projects/${projectId}/tasks?limit=250&excludeClosed=false`, {
                headers: {
                    'X-Api-Key': token,
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `HTTP error ${response.status}`);
            }
            
            const data: EverhourTask[] = await response.json();
            
            this._tasks = data.map(task => ({
                id: task.id,
                name: task.name || 'Unnamed task',
                status: task.status || 'open',
                projects: task.projects || [],
                time: {
                    total: task.time?.total || 0,
                    today: this.calculateTodayTime(task.time?.users)
                },
                dueAt: task.dueAt,
                labels: task.labels || []
            }));
            
            this.updateView();
        } catch (error: any) {
            console.error('Error fetching tasks:', error);
            vscode.window.showErrorMessage(`Failed: ${error.message}`);
            this._tasks = [];
            this.updateView();
        }
    }
    
    private calculateTodayTime(users?: Record<string, number>): number {
        if (!users) {return 0;}
        return Object.values(users).reduce((sum, time) => sum + time, 0);
    }
    
    private async checkCurrentTimer() {
        const token = this.context.globalState.get('everhourToken');
        if (!token) {return;}
        
        try {
            const response = await fetch('https://api.everhour.com/timers/current', {
                headers: {
                    'X-Api-Key': token
                }
            });
            
            if (response.ok) {
                const timer = await response.json();
                if (timer && timer.task) {
                    this._currentTimer = {
                        taskId: timer.task.id,
                        startTime: new Date(timer.startedAt).getTime()
                    };
                    this.updateView();
                }
            }
        } catch (error) {
            console.error('Error checking current timer:', error);
        }
    }
    
    private async startTimer(taskId: string) {
        const token = this.context.globalState.get('everhourToken');
        if (!token) {return;}
        
        try {
            const response = await fetch(`https://api.everhour.com/timers`, {
                method: 'POST',
                headers: {
                    'X-Api-Key': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    task: taskId
                })
            });
            
            if (response.ok) {
                this._currentTimer = {
                    taskId,
                    startTime: Date.now()
                };
                this.updateView();
                vscode.window.showInformationMessage(`Timer started for task ${this.getTaskName(taskId)}`);
            } else {
                const error = await response.json();
                vscode.window.showErrorMessage(`Error starting timer: ${error.message}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage('Error starting timer');
            console.error(error);
        }
    }
    
    private async stopTimer() {
        const token = this.context.globalState.get('everhourToken');
        if (!token || !this._currentTimer.taskId) {return;}
        
        try {
            const response = await fetch(`https://api.everhour.com/timers/current`, {
                method: 'DELETE',
                headers: {
                    'X-Api-Key': token
                }
            });
            
            if (response.ok) {
                const elapsedMinutes = this._currentTimer.startTime 
                    ? Math.floor((Date.now() - this._currentTimer.startTime) / 60000)
                    : 0;
                
                const taskName = this.getTaskName(this._currentTimer.taskId);
                this._currentTimer = {};
                this.updateView();
                
                vscode.window.showInformationMessage(
                    `Timer stopped for ${taskName}. Elapsed time: ${elapsedMinutes} minutes`
                );
            } else {
                const error = await response.json();
                vscode.window.showErrorMessage(`Error stopping timer: ${error.message}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage('Error stopping timer');
            console.error(error);
        }
    }
    
    private async logTime(taskId: string, minutes: number) {
        const token = this.context.globalState.get('everhourToken');
        if (!token) {return;}
        
        try {
            const response = await fetch(`https://api.everhour.com/tasks/${taskId}/time`, {
                method: 'POST',
                headers: {
                    'X-Api-Key': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    time: minutes * 60,
                    date: new Date().toISOString().split('T')[0]
                })
            });
            
            if (response.ok) {
                vscode.window.showInformationMessage('Time logged successfully!');
                if (this._selectedProjectId) {
                    await this.fetchTasks(this._selectedProjectId);
                }
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Error logging time');
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed: ${error.message}`);
        }
    }
    
    private getTaskName(taskId: string): string {
        const task = this._tasks.find(t => t.id === taskId);
        return task ? task.name : 'Unknown task';
    }
    
    private formatTime(seconds?: number): string {
        if (seconds === undefined || seconds === null || isNaN(seconds)) {
            return "0h 0m";
        }
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
    
    private _getHtmlForWebview(webview: vscode.Webview): string {
        const token = this.context.globalState.get('everhourToken');
        
        const statusOptions = ['all', 'open', 'closed', 'in_progress', 'completed'];
        const statusLabels: Record<string, string> = {
            all: 'All',
            open: 'Open',
            closed: 'Closed',
            in_progress: 'In Progress',
            completed: 'Completed',
        };
        
        // Projects HTML
        const projectsHtml = this._projects
            .map(p => `<option value="${p.id}" ${p.id === this._selectedProjectId ? 'selected' : ''}>${p.name}</option>`)
            .join('\n');
        
        // Status filter HTML
        const statusFilterHtml = `
            <select id="statusFilter" onchange="changeStatusFilter(this.value)">
                ${statusOptions.map(s => `<option value="${s}" ${s === this._taskStatusFilter ? 'selected' : ''}>${statusLabels[s]}</option>`).join('')}
            </select>
        `;
        
        // Filter tasks by status
        const filteredTasks = this._taskStatusFilter === 'all'
            ? this._tasks
            : this._tasks.filter(task => task.status === this._taskStatusFilter);
        
        // Filter tasks by search term
        const searchTerm = this._searchTerm;
        const searchFilteredTasks = searchTerm
            ? filteredTasks.filter(task => task.name.toLowerCase().includes(searchTerm))
            : filteredTasks;
        
        // Active task section
        const activeTask = this._currentTimer.taskId 
            ? this._tasks.find(t => t.id === this._currentTimer.taskId)
            : null;
        
        const activeTaskHtml = activeTask ? `
            <div class="active-task-container">
                <div class="active-task-header">ACTIVE TASK</div>
                <div class="active-task">
                    <div class="task-name">${activeTask.name}</div>
                    <div class="active-task-time">
                        ${this.formatTime(activeTask.time?.total)}
                        ${this._currentTimer.startTime 
                            ? ` (${Math.floor((Date.now() - this._currentTimer.startTime) / 60000)}m)`
                            : ''}
                    </div>
                    <button class="activity-status pause" onclick="stopTimer()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 5h4v14H6zm8 0h4v14h-4z"/>
                        </svg>
                    </button>
                </div>
            </div>
        ` : '';
        
        // Tasks list HTML
        const tasksHtml = searchFilteredTasks.length > 0
            ? searchFilteredTasks.map(task => {
                const isRunning = this._currentTimer.taskId === task.id;
                return `
                    <div class="task ${isRunning ? 'active' : ''}">
                        <div class="task-name">${task.name}</div>
                        <div>${this.formatTime(task.time?.total)}</div>
                        ${isRunning
                            ? `<button class="activity-status pause" onclick="stopTimer()">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6 5h4v14H6zm8 0h4v14h-4z"/>
                                </svg>
                                </button>`
                            : `<button class="activity-status play" onclick="startTimer('${task.id}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8 5v14l11-7z"/>
                                </svg>
                            </button>`}
                    </div>
                `;
            }).join('')
            : `<div class="no-tasks">No tasks found with this filter</div>`;
        
        const searchValueEscaped = searchTerm.replace(/"/g, '&quot;');
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <title>Everhour Tasks</title>
                <style>
                    body {
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
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
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
                </style>
            </head>
            <body>
                <div class="header">
                    <input 
                        type="search" 
                        id="taskSearch" 
                        placeholder="Search tasks..." 
                        value="${searchValueEscaped}"
                        oninput="onSearchInput(this.value)"
                    />
                    <select id="projectSelect" onchange="selectProject(this.value)">
                        ${projectsHtml}
                    </select>
                    ${statusFilterHtml}
                    <button onclick="refresh()">Refresh</button>
                </div>
                
                ${activeTaskHtml}
                
                <div id="tasks">${tasksHtml}</div>
                
                <script>
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
        
                    function changeStatusFilter(status) {
                        vscode.postMessage({ command: 'changeStatusFilter', status });
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
                            const startTime = ${this._currentTimer.startTime || 0};
                            if (startTime) {
                                const update = () => {
                                    const minutes = Math.floor((Date.now() - startTime) / 60000);
                                    activeTaskElement.textContent = \`${this.formatTime(activeTask?.time?.total || 0)} (\${minutes}m)\`;
                                };
                                update();
                                setInterval(update, 60000); // Update every minute
                            }
                        }
                    }
        
                    // Initialize when page loads
                    window.addEventListener('load', updateActiveTimer);
                </script>
            </body>
            </html>
        `;
    }

    public updateView() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }
}