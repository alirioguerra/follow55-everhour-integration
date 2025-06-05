import * as vscode from 'vscode';
import { TimesheetViewProvider } from './providers/TimesheetViewProvider';
import { StatusBarManager } from './providers/StatusBarManager';

export function activate(context: vscode.ExtensionContext) {
  // Register the Timesheet view
  const timesheetProvider = new TimesheetViewProvider(context);
  const statusBarManager = new StatusBarManager(timesheetProvider.weeklyTaskManager, timesheetProvider.state);

  // Register the webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TimesheetViewProvider.viewType,
      timesheetProvider
    )
  );
  
  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('follow55-everhour.toggleTimer', async (taskId: string) => {
      const isRunning = timesheetProvider.state.isTaskRunning(taskId);
      if (isRunning) {
        await timesheetProvider.messageHandler.handleMessage({ command: 'stopTimer' });
      } else {
        await timesheetProvider.messageHandler.handleMessage({ command: 'startTimer', taskId });
      }
      statusBarManager.updatePinnedTasks();
    }),
    
    vscode.commands.registerCommand('follow55-everhour-integration.setToken', async () => {
      const token = await vscode.window.showInputBox({
        prompt: 'Enter your Everhour API token',
        password: true
      });
      
      if (token) {
        context.globalState.update('everhourToken', token);
        vscode.window.showInformationMessage('Everhour token saved successfully!');
        timesheetProvider.updateView();
      }
    }),

    vscode.commands.registerCommand('everhour.clearToken', () => {
      context.globalState.update('everhourToken', undefined);
      vscode.window.showInformationMessage('Everhour token cleared');
      timesheetProvider.updateView();
    }),

    vscode.commands.registerCommand('follow55-everhour-integration.linkProject', async () => {
      // Get all projects
      const projects = timesheetProvider.state.projects;
      if (!projects.length) {
        vscode.window.showErrorMessage('No Everhour projects found. Please check your token and try again.');
        return;
      }

      // Show quick pick to select project
      const projectItems = projects.map(p => ({
        label: p.name,
        description: p.id,
        project: p
      }));

      const selectedItem = await vscode.window.showQuickPick(projectItems, {
        placeHolder: 'Select an Everhour project to link with this workspace'
      });

      if (selectedItem) {
        try {
          await timesheetProvider.state.linkWorkspaceToProject(selectedItem.project.id);
          vscode.window.showInformationMessage(`Workspace linked to Everhour project: ${selectedItem.project.name}`);
          timesheetProvider.updateView();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to link project: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    })
  );

  // Update status bar when tasks are pinned/unpinned
  timesheetProvider.onTasksChanged(() => {
    statusBarManager.updatePinnedTasks();
  });

  // Add statusBarManager to subscriptions for cleanup
  context.subscriptions.push({
    dispose: () => statusBarManager.dispose()
  });
}

export function deactivate() {}