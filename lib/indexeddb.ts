export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  stocked: boolean;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
  source: 'notion' | 'google-tasks';
  sourceId: string;
  tags?: string[];
  author?: string;
  imageUrl?: string;
  url?: string;
  iconUrl?: string;
  notionPageUrl?: string;
  ogpImageUrl?: string;
  syncedWithNotion: boolean;
}

export interface AppSettings {
  backendType: 'notion' | 'google-tasks' | null;
  notionApiKey?: string;
  notionDatabaseId?: string;
  googleTasksCredentials?: string;
  proxyServerUrl?: string;
  lastSyncAt?: Date;
  lastSyncCursor?: string;
  newestTaskCreatedAt?: Date;
  oldestTaskCreatedAt?: Date;
}

class IndexedDbManager {
  private dbName = 'TaskCacheDB';
  private version = 2;
  private db: IDBDatabase | null = null;

  getDb(): IDBDatabase | null {
    return this.db;
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction;

        this.createOrUpdateTasksStore(db, transaction);
        this.createSettingsStore(db);
      };
    });
  }

  private createOrUpdateTasksStore(
    db: IDBDatabase,
    transaction: IDBTransaction | null,
  ): void {
    if (!db.objectStoreNames.contains('tasks')) {
      this.createNewTasksStore(db);
      return;
    }

    if (transaction) {
      this.updateExistingTasksStore(transaction);
    }
  }

  private createNewTasksStore(db: IDBDatabase): void {
    const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
    taskStore.createIndex('source', 'source', { unique: false });
    taskStore.createIndex('completed', 'completed', { unique: false });
    taskStore.createIndex('stocked', 'stocked', { unique: false });
    taskStore.createIndex('read', 'read', { unique: false });
    taskStore.createIndex('createdAt', 'createdAt', { unique: false });
    taskStore.createIndex('syncedWithNotion', 'syncedWithNotion', {
      unique: false,
    });
  }

  private updateExistingTasksStore(transaction: IDBTransaction): void {
    const taskStore = transaction.objectStore('tasks');
    if (!taskStore.indexNames.contains('syncedWithNotion')) {
      taskStore.createIndex('syncedWithNotion', 'syncedWithNotion', {
        unique: false,
      });
    }
  }

  private createSettingsStore(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }
  }

  async persistStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      return await navigator.storage.persist();
    }
    return false;
  }

  async getTasks(): Promise<Task[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const db = this.db;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['tasks'], 'readonly');
      const store = transaction.objectStore('tasks');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedNotionTasks(): Promise<Task[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const db = this.db;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['tasks'], 'readonly');
      const store = transaction.objectStore('tasks');
      const request = store.getAll();

      request.onsuccess = () => {
        const unsyncedTasks = request.result.filter(
          (task) => task.source === 'notion' && task.syncedWithNotion === false,
        );
        resolve(unsyncedTasks);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async addTask(task: Task): Promise<void> {
    const existingTask = await this.getTaskById(task.id);
    if (existingTask) {
      return this.mergeAndUpdateTask(existingTask, task);
    }
    return this.insertNewTask(task);
  }

  private async getTaskById(id: string): Promise<Task | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const db = this.db;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['tasks'], 'readonly');
      const store = transaction.objectStore('tasks');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private mergeAndUpdateTask(existingTask: Task, newTask: Task): Promise<void> {
    const mergedTask = {
      ...newTask,
      read: existingTask.read,
      stocked: existingTask.stocked,
      syncedWithNotion: existingTask.syncedWithNotion,
    };
    return this.updateTask(mergedTask, false);
  }

  private async insertNewTask(task: Task): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const db = this.db;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['tasks'], 'readwrite');
      const store = transaction.objectStore('tasks');
      const request = store.add(task);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateTask(task: Task, markAsUnsynced = true): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (markAsUnsynced && task.source === 'notion') {
      task.syncedWithNotion = false;
    }

    const db = this.db;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['tasks'], 'readwrite');
      const store = transaction.objectStore('tasks');
      const request = store.put(task);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTask(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const db = this.db;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['tasks'], 'readwrite');
      const store = transaction.objectStore('tasks');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSettings(): Promise<AppSettings> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const db = this.db;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get('app-settings');

      request.onsuccess = () => {
        resolve(request.result?.value || { backendType: null });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const db = this.db;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key: 'app-settings', value: settings });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async syncTasksWithNotion(): Promise<{ success: number; failed: number }> {
    const unsyncedTasks = await this.getUnsyncedNotionTasks();
    const settings = await this.getSettings();

    if (
      !(settings.notionApiKey && settings.notionDatabaseId) ||
      unsyncedTasks.length === 0
    ) {
      return { success: 0, failed: 0 };
    }

    const notionClient = await import('./notion-api-client').then(
      (module) =>
        new module.NotionAPIClient(
          settings.notionApiKey!,
          settings.notionDatabaseId!,
          settings.proxyServerUrl,
        ),
    );

    let success = 0;
    let failed = 0;

    for (const task of unsyncedTasks) {
      try {
        await notionClient.updateTask(task);
        task.syncedWithNotion = true;
        await this.updateTask(task, false);
        success++;
      } catch (error) {
        console.error(`Failed to sync task ${task.id}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }
}

export const dbManager = new IndexedDbManager();
