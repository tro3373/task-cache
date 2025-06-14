import { Task } from './indexeddb';

export interface APIClient {
  authenticate(): Promise<boolean>;
  fetchTasks(): Promise<Task[]>;
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

  async fetchTasks(): Promise<Task[]> {
    try {
      const url = this.buildUrl(`https://api.notion.com/v1/databases/${this.databaseId}/query`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sorts: [{ property: 'Created', direction: 'descending' }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Notion API error: ${response.status}`);
      }

      const data = await response.json();
      return data.results.map(this.mapNotionPageToTask);
    } catch (error) {
      console.error('Failed to fetch Notion tasks:', error);
      return [];
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
          Title: {
            title: [{ text: { content: task.title || '' } }],
          },
          Completed: {
            checkbox: task.completed || false,
          },
          Description: {
            rich_text: [{ text: { content: task.description || '' } }],
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
          Title: {
            title: [{ text: { content: task.title } }],
          },
          Completed: {
            checkbox: task.completed,
          },
          Description: {
            rich_text: [{ text: { content: task.description || '' } }],
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
    return {
      id: page.id,
      sourceId: page.id,
      title: page.properties.Title?.title?.[0]?.text?.content || 'Untitled',
      description: page.properties.Description?.rich_text?.[0]?.text?.content || '',
      completed: page.properties.Completed?.checkbox || false,
      stocked: false,
      read: false,
      createdAt: new Date(page.created_time),
      updatedAt: new Date(page.last_edited_time),
      source: 'notion' as const,
      author: page.created_by?.name || 'Unknown',
    };
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

  async fetchTasks(): Promise<Task[]> {
    // Mock implementation - in reality, this would use Google Tasks API
    return Promise.resolve([]);
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
