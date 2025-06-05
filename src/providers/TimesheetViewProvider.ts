// 1. TimesheetViewProvider.ts (Main provider - coordenador)
import * as vscode from 'vscode';
import { TimesheetState } from './TimesheetState';
import { TimesheetHtmlGenerator } from './TimesheetHtmlGenerator';
import { TimesheetMessageHandler } from './TimesheetMessageHandler';
import { WeeklyTaskManager } from './WeeklyTaskManager';
import { EverhourAPI } from '../utils/api';

export class TimesheetViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'follow55-everhour.timesheetView';
  
  private _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private readonly _api: EverhourAPI;
  private _htmlGenerator?: TimesheetHtmlGenerator;
  
  // Make these public read-only
  public readonly state: TimesheetState;
  public readonly weeklyTaskManager: WeeklyTaskManager;
  public readonly messageHandler: TimesheetMessageHandler;
  
  // Add event emitter for task changes
  private readonly _onTasksChanged = new vscode.EventEmitter<void>();
  public readonly onTasksChanged = this._onTasksChanged.event;
  
  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this._extensionUri = context.extensionUri;
    
    // Initialize managers and state
    this._api = new EverhourAPI(context);
    this.weeklyTaskManager = new WeeklyTaskManager(context);
    this.state = new TimesheetState(this.weeklyTaskManager);
    
    // Set up project selection callback
    this.state.setProjectSelectedCallback(async (projectId: string) => {
      await this.fetchTasks(projectId);
    });
    
    this.messageHandler = new TimesheetMessageHandler(
      this._api,
      this.weeklyTaskManager,
      this.state,
      () => this.updateView()
    );
  }
  
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    console.log('Resolving webview view');
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    
    // Create the HTML generator with the webview
    this._htmlGenerator = new TimesheetHtmlGenerator(
      this.weeklyTaskManager,
      this.state,
      webviewView.webview,
      this._context
    );
    
    this.updateView();

    // Set up message handling
    webviewView.webview.onDidReceiveMessage(async message => {
      console.log('Received message:', message);
      await this.messageHandler.handleMessage(message);
    });

    // Load initial data
    this.loadInitialData();
  }
  
  private async loadInitialData() {
    try {
      console.log('Loading initial data');
      const projects = await this._api.fetchProjects();
      console.log('Fetched projects:', projects);
      this.state.setProjects(projects);
      
      // Load workspace project if exists
      const workspaceProjectId = this.state.getWorkspaceProjectId();
      if (workspaceProjectId && projects.some(p => p.id === workspaceProjectId)) {
        await this.state.loadWorkspaceProject();
      } else if (projects.length > 0) {
        await this.fetchTasks(projects[0].id);
      }
      
      await this.checkCurrentTimer();
    } catch (error) {
      console.error('Failed to load initial data:', error);
      vscode.window.showErrorMessage('Failed to load Everhour data. Please check your token and try again.');
    }
  }
  
  private async fetchTasks(projectId: string) {
    try {
      console.log('Fetching tasks for project:', projectId);
      const data = await this._api.fetchTasks(projectId);
      console.log('Fetched tasks:', data);
      this.state.setTasks(data);
      this.updateView();
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      vscode.window.showErrorMessage('Failed to fetch tasks');
    }
  }
  
  private async checkCurrentTimer() {
    try {
      console.log('Checking current timer');
      const timer = await this._api.checkCurrentTimer();
      console.log('Current timer:', timer);
      this.state.setCurrentTimer(timer);
      this.updateView();
    } catch (error) {
      console.error('Failed to check current timer:', error);
    }
  }
  
  public updateView() {
    if (this._view && this._htmlGenerator) {
      console.log('Updating view');
      this._view.webview.html = this._htmlGenerator.generateHtml();
      this._onTasksChanged.fire(); // Emit event when tasks are updated
    } else {
      console.log('Cannot update view - view or HTML generator not initialized');
    }
  }
  
  // Método para limpeza
  public dispose() {
    this._view = undefined;
  }
}