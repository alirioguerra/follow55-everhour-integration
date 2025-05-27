import * as vscode from 'vscode';
import { TimesheetViewProvider } from './TimesheetViewProvider';

export async function activate(context: vscode.ExtensionContext) {
  console.log('Follow55 - Everhour integration active!');

  const tokenKey = 'everhourToken';

  const timesheetViewProvider = new TimesheetViewProvider(context);
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TimesheetViewProvider.viewType,
      timesheetViewProvider
    ),
    
    vscode.commands.registerCommand('follow55-everhour-integration.setToken', async () => {
      const newToken = await vscode.window.showInputBox({
        placeHolder: 'Insira seu token da API do Everhour',
        prompt: 'Configure seu token Everhour',
        ignoreFocusOut: true,
        password: true,
        validateInput: (value) => {
          if (!value || value.length < 10) {
            return 'O token parece inválido.';
          }
          return null;
        }
      });

      if (newToken) {
        await context.globalState.update(tokenKey, newToken);
        vscode.window.showInformationMessage('Token Everhour salvo/atualizado com sucesso!');
        timesheetViewProvider.updateView();
      }
    })
  );
}

export function deactivate() {}