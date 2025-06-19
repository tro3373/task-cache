import type { APIClient, DateFilter, FetchTasksResult } from './api-clients';
import type { Task } from './indexeddb';

export class GoogleTasksAPIClient implements APIClient {
  private credentials: string;
  private proxyUrl?: string;

  constructor(credentials: string, proxyUrl?: string) {
    this.credentials = credentials;
    this.proxyUrl = proxyUrl;
  }

  private buildUrl(url: string): string {
    return this.proxyUrl ? `${this.proxyUrl}${encodeURIComponent(url)}` : url;
  }

  authenticate(): Promise<boolean> {
    // In a real implementation, this would handle OAuth2 flow
    // For now, we'll simulate authentication
    return Promise.resolve(true);
  }

  fetchTasks(
    _lastSyncAt?: Date,
    _startCursor?: string,
    _pageSize = 50,
    _dateFilter?: DateFilter,
  ): Promise<FetchTasksResult> {
    // Mock implementation - in reality, this would use Google Tasks API
    return Promise.resolve({
      tasks: [],
      hasMore: false,
    });
  }

  createTask(task: Partial<Task>): Promise<Task> {
    // Mock implementation
    return Promise.resolve({
      id: Date.now().toString(),
      sourceId: Date.now().toString(),
      title: task.title || '',
      description: task.description,
      completed: false,
      stocked: false,
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      source: 'google-tasks' as const,
    });
  }

  updateTask(task: Task): Promise<Task> {
    return Promise.resolve(task);
  }

  deleteTask(_id: string): Promise<void> {
    return Promise.resolve();
  }
}
