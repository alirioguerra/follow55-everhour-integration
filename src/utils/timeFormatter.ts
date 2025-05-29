export class TimeFormatter {
  public static formatTime(seconds?: number): string {
    if (seconds === undefined || seconds === null || isNaN(seconds)) {
      return "0h 0m";
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
  
  public static calculateTodayTime(users?: Record<string, number>): number {
    if (!users) { return 0; }
    return Object.values(users).reduce((sum, time) => sum + time, 0);
  }
}