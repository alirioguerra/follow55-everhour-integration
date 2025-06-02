import * as vscode from 'vscode';
import { TimesheetViewProvider } from './providers/TimesheetViewProvider';

export function activate(context: vscode.ExtensionContext) {
  // Register the Timesheet view
  const timesheetProvider = new TimesheetViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TimesheetViewProvider.viewType,
      timesheetProvider
    )
  );
  
  // Register commands
  context.subscriptions.push(
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
}

export function deactivate() {}