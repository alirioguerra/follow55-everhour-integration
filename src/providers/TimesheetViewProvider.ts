// 1. TimesheetViewProvider.ts (Main provider - coordenador)
import * as vscode from 'vscode';
import { EverhourAPI } from '../utils/api';
import { WeeklyTaskManager } from './WeeklyTaskManager';
import { TimesheetState } from './TimesheetState';
import { TimesheetHtmlGenerator } from './TimesheetHtmlGenerator';
import { TimesheetMessageHandler } from './TimesheetMessageHandler';

export class TimesheetViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'everhour.timesheetView';
  private _view?: vscode.WebviewView;
  
  private state: TimesheetState;
  private api: EverhourAPI;
  private weeklyTaskManager: WeeklyTaskManager;
  private htmlGenerator: TimesheetHtmlGenerator;
  private messageHandler: TimesheetMessageHandler;
  
  constructor(private readonly context: vscode.ExtensionContext) {
    this.api = new EverhourAPI(context);
    this.weeklyTaskManager = new WeeklyTaskManager(context);
    this.state = new TimesheetState();
    this.htmlGenerator = new TimesheetHtmlGenerator(this.weeklyTaskManager, this.state);
    this.messageHandler = new TimesheetMessageHandler(
      this.api,
      this.weeklyTaskManager,
      this.state,
      () => this.updateView()
    );
  }
  
  public async resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };
    
    webviewView.webview.html = this.htmlGenerator.generateHtml(webviewView.webview, this.context);
    
    webviewView.webview.onDidReceiveMessage(async message => {
      await this.messageHandler.handleMessage(message);
    });
    
    await this.loadInitialData();
  }
  
  private async loadInitialData() {
    try {
      const projects = await this.api.fetchProjects();
      this.state.setProjects(projects);
      
      if (projects.length > 0 && !this.state.selectedProjectId) {
        await this.selectProject(projects[0].id);
      }
      
      await this.checkCurrentTimer();
    } catch (error) {
      console.error('Error loading initial data:', error);
      vscode.window.showErrorMessage(
        `Failed to load data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  private async selectProject(projectId: string) {
    this.state.setSelectedProject(projectId);
    await this.fetchTasks(projectId);
  }
  
  private async fetchTasks(projectId: string) {
    try {
      const data = await this.api.fetchTasks(projectId);
      this.state.setTasks(data);
      this.updateView();
    } catch (error) {
      console.error('Error fetching tasks:', error);
      vscode.window.showErrorMessage(
        `Failed to fetch tasks: ${error instanceof Error ? error.message : String(error)}`
      );
      this.state.setTasks([]);
      this.updateView();
    }
  }
  
  private async checkCurrentTimer() {
    try {
      const timer = await this.api.checkCurrentTimer();
      this.state.setCurrentTimer(timer);
      this.updateView();
    } catch (error) {
      console.error('Error checking current timer:', error);
    }
  }
  
  public updateView() {
    if (this._view) {
      this._view.webview.html = this.htmlGenerator.generateHtml(this._view.webview, this.context);
    }
  }
}
