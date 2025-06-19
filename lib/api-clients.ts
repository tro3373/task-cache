import type { Task } from './indexeddb';

export interface FetchTasksResult {
  tasks: Task[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface DateFilter {
  type: 'after' | 'before' | 'on_or_after' | 'on_or_before';
  date: Date;
}

export interface APIClient {
  authenticate(): Promise<boolean>;
  fetchTasks(
    lastSyncAt?: Date,
    startCursor?: string,
    pageSize?: number,
    dateFilter?: DateFilter,
  ): Promise<FetchTasksResult>;
  createTask(task: Partial<Task>): Promise<Task>;
  updateTask(task: Task): Promise<Task>;
  deleteTask(id: string): Promise<void>;
}
