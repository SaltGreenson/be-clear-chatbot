export interface ModerationLog {
  id: string;
  userId: number;
  chatId: number;
  username?: string;
  originalMessage: string;
  correctedMessage: string;
  analysis: {
    score: number;
    reasons: string[];
    categories: string[];
    tone: string;
  };
  action: 'replaced' | 'warned' | 'ignored' | 'deleted';
  timestamp: Date;
  messageId?: number;
  correctedMessageId?: number;
}

export class ModerationLogService {
  private logs: ModerationLog[] = [];
  private nextId = 1;

  addLog(log: Omit<ModerationLog, 'id' | 'timestamp'>): ModerationLog {
    const fullLog: ModerationLog = {
      ...log,
      id: `log_${this.nextId++}`,
      timestamp: new Date(),
    };

    this.logs.push(fullLog);
    this.saveToStorage();

    return fullLog;
  }

  getLogsByChat(chatId: number, limit: number = 100): ModerationLog[] {
    return this.logs
      .filter((log) => log.chatId === chatId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getLogsByUser(userId: number, chatId?: number): ModerationLog[] {
    return this.logs.filter((log) => {
      if (log.userId !== userId) return false;
      if (chatId && log.chatId !== chatId) return false;
      return true;
    });
  }

  getStats(chatId: number): {
    total: number;
    aggressive: number;
    replaced: number;
    warned: number;
    topUsers: Array<{ userId: number; count: number }>;
    recentActivity: Date | null;
  } {
    const chatLogs = this.logs.filter((log) => log.chatId === chatId);

    const userCounts: { [key: number]: number } = {};
    chatLogs.forEach((log) => {
      userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;
    });

    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId: parseInt(userId), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total: chatLogs.length,
      aggressive: chatLogs.filter((log) => log.analysis.score > 0.5).length,
      replaced: chatLogs.filter((log) => log.action === 'replaced').length,
      warned: chatLogs.filter((log) => log.action === 'warned').length,
      topUsers,
      recentActivity: chatLogs[0]?.timestamp || null,
    };
  }

  clearOldLogs(daysToKeep: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const initialLength = this.logs.length;
    this.logs = this.logs.filter((log) => log.timestamp > cutoffDate);

    this.saveToStorage();
    return initialLength - this.logs.length;
  }

  private saveToStorage(): void {
    // Здесь можно добавить сохранение в файл или базу данных
    // Пока просто храним в памяти
    console.log(`Сохранено ${this.logs.length} логов модерации`);
  }

  loadFromStorage(): void {
    // Здесь можно добавить загрузку из файла или базы данных
    console.log('Загрузка логов модерации...');
  }
}
