import { Task } from './indexeddb';

export interface FetchTasksResult {
  tasks: Task[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface APIClient {
  authenticate(): Promise<boolean>;
  fetchTasks(lastSyncAt?: Date, startCursor?: string, pageSize?: number): Promise<FetchTasksResult>;
  createTask(task: Partial<Task>): Promise<Task>;
  updateTask(task: Task): Promise<Task>;
  deleteTask(id: string): Promise<void>;
}

export class NotionAPIClient implements APIClient {
  constructor(
    private apiKey: string,
    private databaseId: string,
    private proxyUrl?: string
  ) {}

  private buildUrl(url: string): string {
    return this.proxyUrl ? `${this.proxyUrl}${encodeURIComponent(url)}` : url;
  }

  async authenticate(): Promise<boolean> {
    try {
      const url = this.buildUrl(`https://api.notion.com/v1/databases/${this.databaseId}`);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': '2022-06-28',
        },
      });
      return response.ok;
    } catch (error) {
      console.error('Notion authentication failed:', error);
      return false;
    }
  }

  async fetchTasks(lastSyncAt?: Date, startCursor?: string, pageSize: number = 50): Promise<FetchTasksResult> {
    try {
      const url = this.buildUrl(`https://api.notion.com/v1/databases/${this.databaseId}/query`);
      
      const requestBody: any = {
        sorts: [{ property: '作成日時', direction: 'descending' }],
        page_size: pageSize,
      };

      // Add start_cursor for pagination
      if (startCursor) {
        requestBody.start_cursor = startCursor;
      }

      // Add filter for incremental sync (created_time > lastSyncAt)
      if (lastSyncAt && !startCursor) {
        requestBody.filter = {
          property: '作成日時',
          created_time: {
            after: lastSyncAt.toISOString(),
          },
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Notion API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        tasks: data.results.map(this.mapNotionPageToTask.bind(this)),
        hasMore: data.has_more || false,
        nextCursor: data.next_cursor || undefined,
      };
    } catch (error) {
      console.error('Failed to fetch Notion tasks:', error);
      return {
        tasks: [],
        hasMore: false,
      };
    }
  }

  async createTask(task: Partial<Task>): Promise<Task> {
    const url = this.buildUrl('https://api.notion.com/v1/pages');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: this.databaseId },
        properties: {
          名前: {
            title: [{ text: { content: task.title || '' } }],
          },
          テキスト: {
            rich_text: [{ text: { content: task.description || '' } }],
          },
          Stock: {
            checkbox: task.stocked || false,
          },
          既読: {
            checkbox: task.read || false,
          },
        },
      }),
    });

    const data = await response.json();
    return this.mapNotionPageToTask(data);
  }

  async updateTask(task: Task): Promise<Task> {
    const url = this.buildUrl(`https://api.notion.com/v1/pages/${task.sourceId}`);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          名前: {
            title: [{ text: { content: task.title } }],
          },
          テキスト: {
            rich_text: [{ text: { content: task.description || '' } }],
          },
          Stock: {
            checkbox: task.stocked,
          },
          既読: {
            checkbox: task.read,
          },
        },
      }),
    });

    const data = await response.json();
    return this.mapNotionPageToTask(data);
  }

  async deleteTask(id: string): Promise<void> {
    const url = this.buildUrl(`https://api.notion.com/v1/pages/${id}`);
    await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        archived: true,
      }),
    });
  }

  private mapNotionPageToTask(page: any): Task {
    const task = {
      id: page.id,
      sourceId: page.id,
      title: page.properties.名前?.title?.[0]?.text?.content || 'Untitled',
      description: page.properties.テキスト?.rich_text?.[0]?.text?.content || '',
      completed: false, // No completion status in this database
      stocked: page.properties.Stock?.checkbox || false,
      read: page.properties.既読?.checkbox || false,
      createdAt: new Date(page.created_time),
      updatedAt: new Date(page.last_edited_time),
      source: 'notion' as const,
      author: page.created_by?.name || 'Unknown',
      tags: page.properties.タグ?.multi_select?.map((tag: any) => tag.name) || [],
      url: page.properties.URL?.url || undefined,
      iconUrl: page.icon?.external?.url || page.icon?.emoji || undefined,
      notionPageUrl: page.url,
    };
    
    console.log('Mapping Notion page to task:', {
      title: task.title,
      url: task.url,
      notionPageUrl: task.notionPageUrl,
      iconUrl: task.iconUrl,
      tags: task.tags
    });
    
    return task;
  }
}

export class GoogleTasksAPIClient implements APIClient {
  constructor(
    private credentials: string,
    private proxyUrl?: string
  ) {}

  private buildUrl(url: string): string {
    return this.proxyUrl ? `${this.proxyUrl}${encodeURIComponent(url)}` : url;
  }

  async authenticate(): Promise<boolean> {
    // In a real implementation, this would handle OAuth2 flow
    // For now, we'll simulate authentication
    return Promise.resolve(true);
  }

  async fetchTasks(lastSyncAt?: Date, startCursor?: string, pageSize: number = 50): Promise<FetchTasksResult> {
    // Mock implementation - in reality, this would use Google Tasks API
    return Promise.resolve({
      tasks: [],
      hasMore: false,
    });
  }

  async createTask(task: Partial<Task>): Promise<Task> {
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

  async updateTask(task: Task): Promise<Task> {
    return Promise.resolve(task);
  }

  async deleteTask(id: string): Promise<void> {
    return Promise.resolve();
  }
}
