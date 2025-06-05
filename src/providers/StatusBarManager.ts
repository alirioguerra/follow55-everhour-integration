import * as vscode from 'vscode';
import { WeeklyTask } from '../models/interfaces';
import { WeeklyTaskManager } from './WeeklyTaskManager';
import { TimesheetState } from './TimesheetState';

export class StatusBarManager {
    private statusBarItems: Map<string, vscode.StatusBarItem> = new Map();
    private readonly weeklyTaskManager: WeeklyTaskManager;
    private readonly state: TimesheetState;

    constructor(weeklyTaskManager: WeeklyTaskManager, state: TimesheetState) {
        this.weeklyTaskManager = weeklyTaskManager;
        this.state = state;
    }

    public updatePinnedTasks(): void {
        // Clear existing status bar items
        this.clearStatusBarItems();

        // Get pinned tasks and create status bar items
        const pinnedTasks = this.weeklyTaskManager.getPinnedTasks();
        pinnedTasks.forEach((task, index) => {
            this.createStatusBarItem(task, index);
        });
    }

    private createStatusBarItem(task: WeeklyTask, index: number): void {
        const statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100 - index // Priority decreases as index increases
        );

        const isRunning = this.state.isTaskRunning(task.everhourId);
        
        // Set the text with an icon
        statusBarItem.text = `$(pin) ${task.name}`;
        
        // Set the tooltip
        statusBarItem.tooltip = `${task.name}\nClick to start/stop timer`;
        
        // Set the command
        statusBarItem.command = {
            title: 'Toggle Timer',
            command: 'follow55-everhour.toggleTimer',
            arguments: [task.everhourId]
        };

        // Add color if the task is running
        if (isRunning) {
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }

        // Show the status bar item
        statusBarItem.show();

        // Store the status bar item for later cleanup
        this.statusBarItems.set(task.id, statusBarItem);
    }

    public dispose(): void {
        this.clearStatusBarItems();
    }

    private clearStatusBarItems(): void {
        this.statusBarItems.forEach(item => item.dispose());
        this.statusBarItems.clear();
    }
} 