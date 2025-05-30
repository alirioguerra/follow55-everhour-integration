const fetch = require('node-fetch');
import * as vscode from 'vscode';
import { EverhourProject, EverhourTask } from '../models/interfaces';

export class EverhourAPI {
  private context: vscode.ExtensionContext;
  
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }
  
  private getToken(): string | undefined {
    return this.context.globalState.get('everhourToken');
  }
  
  public async fetchProjects(): Promise<EverhourProject[]> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Token not configured');
    }
    
    const response = await fetch('https://api.everhour.com/projects', {
      headers: {
        'X-Api-Key': token
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch projects');
    }
    
    return await response.json();
  }
  
  public async fetchTasks(projectId: string): Promise<EverhourTask[]> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Token not configured');
    }
    
    const response = await fetch(
      `https://api.everhour.com/projects/${projectId}/tasks?limit=250&excludeClosed=false`, 
      {
        headers: {
          'X-Api-Key': token,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP error ${response.status}`);
    }
    
    return await response.json();
  }

  public async startTimer(taskId: string): Promise<void> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Token not configured');
    }
    
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
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to start timer');
    }
  }
  
  public async stopTimer(): Promise<void> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Token not configured');
    }
    
    const response = await fetch(`https://api.everhour.com/timers/current`, {
      method: 'DELETE',
      headers: {
        'X-Api-Key': token
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to stop timer');
    }
  }
  
  public async logTime(taskId: string, minutes: number): Promise<void> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Token not configured');
    }
    
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
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to log time');
    }
  }
  
  public async checkCurrentTimer(): Promise<{taskId?: string, startTime?: number}> {
    const token = this.getToken();
    if (!token) {
      return {};
    }
    
    const response = await fetch('https://api.everhour.com/timers/current', {
      headers: {
        'X-Api-Key': token
      }
    });
    
    if (response.ok) {
      const timer = await response.json();
      if (timer && timer.task) {
        return {
          taskId: timer.task.id,
          startTime: new Date(timer.startedAt).getTime()
        };
      }
    }
    
    return {};
  }
}