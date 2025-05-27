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
                vscode.window.showErrorMessage(`Erro ao buscar projetos: ${error.message}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage('Falha na conexão com o Everhour');
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
            vscode.window.showErrorMessage('Token ou ID do projeto não configurado');
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
                throw new Error(error.message || `Erro HTTP ${response.status}`);
            }

            const data: EverhourTask[] = await response.json();
            
            this._tasks = data.map(task => ({
                id: task.id,
                name: task.name || 'Tarefa sem nome',
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
            console.error('Erro ao buscar tarefas:', error);
            vscode.window.showErrorMessage(`Falha: ${error.message}`);
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
            console.error('Erro ao verificar timer atual:', error);
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
                vscode.window.showInformationMessage(`Timer iniciado para tarefa ${this.getTaskName(taskId)}`);
            } else {
                const error = await response.json();
                vscode.window.showErrorMessage(`Erro ao iniciar timer: ${error.message}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage('Erro ao iniciar timer');
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
                    `Timer parado para ${taskName}. Tempo decorrido: ${elapsedMinutes} minutos`
                );
            } else {
                const error = await response.json();
                vscode.window.showErrorMessage(`Erro ao parar timer: ${error.message}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage('Erro ao parar timer');
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
                vscode.window.showInformationMessage('Tempo registrado com sucesso!');
                if (this._selectedProjectId) {
                    await this.fetchTasks(this._selectedProjectId);
                }
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Erro ao registrar tempo');
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Falha: ${error.message}`);
        }
    }

    private getTaskName(taskId: string): string {
        const task = this._tasks.find(t => t.id === taskId);
        return task ? task.name : 'Tarefa desconhecida';
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
            all: 'Todos',
            open: 'Aberto',
            closed: 'Fechado',
            in_progress: 'Em Progresso',
            completed: 'Concluído',
        };

        // Projetos HTML
        const projectsHtml = this._projects
            .map(p => `<option value="${p.id}" ${p.id === this._selectedProjectId ? 'selected' : ''}>${p.name}</option>`)
            .join('\n');

        // Status filter HTML
        const statusFilterHtml = `
            <select id="statusFilter" onchange="changeStatusFilter(this.value)">
                ${statusOptions.map(s => `<option value="${s}" ${s === this._taskStatusFilter ? 'selected' : ''}>${statusLabels[s]}</option>`).join('')}
            </select>
        `;

        // Filtrar tarefas por status
        const filteredTasks = this._taskStatusFilter === 'all'
            ? this._tasks
            : this._tasks.filter(task => task.status === this._taskStatusFilter);

        // Filtrar tarefas por busca (nome)
        const searchTerm = this._searchTerm;
        const searchFilteredTasks = searchTerm
            ? filteredTasks.filter(task => task.name.toLowerCase().includes(searchTerm))
            : filteredTasks;

        const tasksHtml = searchFilteredTasks.length > 0
            ? searchFilteredTasks.map(task => {
                const isRunning = this._currentTimer.taskId === task.id;
                return `
                    <div class="task">
                        <div class="task-name">${task.name}</div>
                        <div>${this.formatTime(task.time?.total)}</div>
                        ${isRunning
                            ? `<button onclick="stopTimer()">⏹️</button>`
                            : `<button onclick="startTimer('${task.id}')">▶️</button>`
                        }
                    </div>
                `;
            }).join('')
            : `<div class="no-tasks">Nenhuma tarefa encontrada com este filtro</div>`;

        const searchValueEscaped = searchTerm.replace(/"/g, '&quot;');

        return `
            <!DOCTYPE html>
            <html lang="pt-BR">
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
                        border-bottom: 1px solid var(--vscode-editorGroup-border);
                    }
                    .task-name {
                        flex: 1 1 auto;
                        margin-right: 8px;
                        word-break: break-word;
                    }
                    button {
                        background-color: var(--vscode-button-background);
                        border: none;
                        border-radius: 3px;
                        padding: 4px 8px;
                        cursor: pointer;
                        color: var(--vscode-button-foreground);
                    }
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    .no-tasks {
                        padding: 12px;
                        color: var(--vscode-descriptionForeground);
                        font-style: italic;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <input 
                        type="search" 
                        id="taskSearch" 
                        placeholder="Buscar tarefas..." 
                        value="${searchValueEscaped}"
                        oninput="onSearchInput(this.value)"
                    />
                    <select id="projectSelect" onchange="selectProject(this.value)">
                        ${projectsHtml}
                    </select>
                    ${statusFilterHtml}
                    <button onclick="refresh()">🔄</button>
                </div>
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
                </script>
            </body>
            </html>
        `;
    }

    private updateView() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }
}