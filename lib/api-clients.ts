import type { Task } from './indexeddb';

export interface FetchTasksResult {
  tasks: Task[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface APIClient {
  authenticate(): Promise<boolean>;
  fetchTasks(
    lastSyncAt?: Date,
    startCursor?: string,
    pageSize?: number,
  ): Promise<FetchTasksResult>;
  createTask(task: Partial<Task>): Promise<Task>;
  updateTask(task: Task): Promise<Task>;
  deleteTask(id: string): Promise<void>;
}

export class NotionAPIClient implements APIClient {
  private apiKey: string;
  private databaseId: string;
  private proxyUrl?: string;

  constructor(apiKey: string, databaseId: string, proxyUrl?: string) {
    this.apiKey = apiKey;
    this.databaseId = databaseId;
    this.proxyUrl = proxyUrl;
  }

  private buildUrl(url: string): string {
    return this.proxyUrl ? `${this.proxyUrl}${encodeURIComponent(url)}` : url;
  }

  private async fetchOGPData(
    url: string,
  ): Promise<{ title?: string; description?: string; image?: string }> {
    if (!(this.proxyUrl && url)) {
      return {};
    }

    try {
      // Extract base URL from proxy URL using URL object
      // Input: https://cors-proxy-coral.vercel.app/api/?url=
      // Output: https://cors-proxy-coral.vercel.app
      const proxyUrlObj = new URL(this.proxyUrl);
      const baseUrl = `${proxyUrlObj.protocol}//${proxyUrlObj.host}`;

      // Use direct OGP endpoint (not through proxy)
      const ogpUrl = `${baseUrl}/api/ogp?url=${encodeURIComponent(url)}`;

      console.log('Original proxy URL:', this.proxyUrl);
      console.log('Extracted base URL:', baseUrl);
      console.log('Fetching OGP data from:', ogpUrl);

      const response = await fetch(ogpUrl);
      if (!response.ok) {
        console.log('OGP fetch failed:', response.status, response.statusText);
        return {};
      }

      const data = await response.json();
      console.log('OGP response:', data);

      return {
        title: data.title,
        description: data.description,
        image: data.image,
      };
    } catch (error) {
      console.error('Failed to fetch OGP data:', error);
      return {};
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      const url = this.buildUrl(
        `https://api.notion.com/v1/databases/${this.databaseId}`,
      );
      const response = await fetch(url, {
        headers: {
          // biome-ignore lint/style/useNamingConvention: HTTP header name
          Authorization: `Bearer ${this.apiKey}`,
          'Notion-Version': '2022-06-28',
        },
      });
      return response.ok;
    } catch (error) {
      console.error('Notion authentication failed:', error);
      return false;
    }
  }

  async fetchTasks(
    lastSyncAt?: Date,
    startCursor?: string,
    pageSize = 50,
  ): Promise<FetchTasksResult> {
    try {
      const url = this.buildUrl(
        `https://api.notion.com/v1/databases/${this.databaseId}/query`,
      );

      // biome-ignore lint/suspicious/noExplicitAny: Notion API request body
      const requestBody: any = {
        sorts: [{ property: '作成日時', direction: 'descending' }],
        // biome-ignore lint/style/useNamingConvention: Notion API field
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
          // biome-ignore lint/style/useNamingConvention: Notion API field
          created_time: {
            after: lastSyncAt.toISOString(),
          },
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          // biome-ignore lint/style/useNamingConvention: HTTP header name
          Authorization: `Bearer ${this.apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Notion API error: ${response.status}`);
      }

      const data = await response.json();

      // Map pages to tasks with OGP image fetching
      const tasks = await Promise.all(
        // biome-ignore lint/suspicious/noExplicitAny: Notion API response
        data.results.map((page: any) => this.mapNotionPageToTask(page)),
      );

      return {
        tasks,
        hasMore: data.has_more,
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
        // biome-ignore lint/style/useNamingConvention: HTTP header name
        Authorization: `Bearer ${this.apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // biome-ignore lint/style/useNamingConvention: Notion API field
        parent: { database_id: this.databaseId },
        properties: {
          名前: {
            title: [{ text: { content: task.title || '' } }],
          },
          テキスト: {
            // biome-ignore lint/style/useNamingConvention: Notion API field
            rich_text: [{ text: { content: task.description || '' } }],
          },
          // biome-ignore lint/style/useNamingConvention: Notion API field
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
    return await this.mapNotionPageToTask(data);
  }

  async updateTask(task: Task): Promise<Task> {
    const url = this.buildUrl(
      `https://api.notion.com/v1/pages/${task.sourceId}`,
    );
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        // biome-ignore lint/style/useNamingConvention: HTTP header name
        Authorization: `Bearer ${this.apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          名前: {
            title: [{ text: { content: task.title } }],
          },
          テキスト: {
            // biome-ignore lint/style/useNamingConvention: Notion API field
            rich_text: [{ text: { content: task.description || '' } }],
          },
          // biome-ignore lint/style/useNamingConvention: Notion API field
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
    return await this.mapNotionPageToTask(data);
  }

  async deleteTask(id: string): Promise<void> {
    const url = this.buildUrl(`https://api.notion.com/v1/pages/${id}`);
    await fetch(url, {
      method: 'PATCH',
      headers: {
        // biome-ignore lint/style/useNamingConvention: HTTP header name
        Authorization: `Bearer ${this.apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        archived: true,
      }),
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: Notion API response
  private async mapNotionPageToTask(page: any): Promise<Task> {
    const notionTitle = page.properties.名前?.title?.[0]?.text?.content;
    const notionDescription =
      page.properties.テキスト?.rich_text?.[0]?.text?.content || '';
    const taskUrl = page.properties.URL?.url || undefined;

    // Fetch OGP data if URL exists
    let ogpData: { title?: string; description?: string; image?: string } = {};
    if (taskUrl) {
      ogpData = await this.fetchOGPData(taskUrl);
    }

    const task: Task = {
      id: page.id,
      sourceId: page.id,
      title: notionTitle || ogpData.title || 'Untitled',
      description: notionDescription || ogpData.description || '',
      completed: false, // No completion status in this database
      stocked: page.properties.Stock?.checkbox,
      read: page.properties.既読?.checkbox,
      createdAt: new Date(page.created_time),
      updatedAt: new Date(page.last_edited_time),
      source: 'notion' as const,
      author: page.created_by?.name || 'Unknown',
      tags:
        // biome-ignore lint/suspicious/noExplicitAny: Notion API structure
        page.properties.タグ?.multi_select?.map((tag: any) => tag.name) || [],
      url: taskUrl,
      iconUrl: undefined, // Disabled icon functionality
      notionPageUrl: page.url,
      ogpImageUrl: ogpData.image,
    };

    console.log('Mapping Notion page to task:', {
      title: task.title,
      description: task.description,
      url: task.url,
      notionPageUrl: task.notionPageUrl,
      tags: task.tags,
      ogpImageUrl: task.ogpImageUrl,
      ogpData,
    });

    return task;
  }
}

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
