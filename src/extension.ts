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