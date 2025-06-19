import { GoogleTasksAPIClient } from '@/lib/google-tasks-api-client';
import { type AppSettings, type Task, dbManager } from '@/lib/indexeddb';
import { NotionAPIClient } from '@/lib/notion-api-client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type SyncState = 'idle' | 'syncing' | 'loading-more';

interface UseTaskSyncOptions {
  settings: AppSettings;
  onTasksUpdated: (tasks: Task[]) => void;
  onSettingsUpdated: (settings: AppSettings) => void;
  onError: (error: {
    title: string;
    message: string;
    details?: string;
  }) => void;
}

export function useTaskSync({
  settings,
  onTasksUpdated,
  onSettingsUpdated,
  onError,
}: UseTaskSyncOptions) {
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [hasMoreTasks, setHasMoreTasks] = useState(false);

  const getApiClient = useCallback(():
    | NotionAPIClient
    | GoogleTasksAPIClient
    | undefined => {
    if (settings.backendType === 'notion') {
      if (!(settings.notionApiKey && settings.notionDatabaseId)) {
        toast.error('Notionの設定が不完全です');
        return;
      }
      return new NotionAPIClient(
        settings.notionApiKey,
        settings.notionDatabaseId,
        settings.proxyServerUrl,
      );
    }
    if (!settings.googleTasksCredentials) {
      toast.error('Google Tasksの設定が不完全です');
      return;
    }
    return new GoogleTasksAPIClient(
      settings.googleTasksCredentials,
      settings.proxyServerUrl,
    );
  }, [settings]);

  const fetchNewTasks = useCallback(
    (apiClient: NotionAPIClient | GoogleTasksAPIClient) => {
      if (!settings.newestTaskCreatedAt) {
        // First sync: get latest tasks
        return apiClient.fetchTasks(undefined, undefined, 20);
      }

      // Get tasks newer than the newest existing task
      return apiClient.fetchTasks(undefined, undefined, 20, {
        type: 'after',
        date: settings.newestTaskCreatedAt,
      });
    },
    [settings.newestTaskCreatedAt],
  );

  const fetchOlderTasks = useCallback(
    (apiClient: NotionAPIClient | GoogleTasksAPIClient) => {
      if (!settings.oldestTaskCreatedAt) {
        return { tasks: [], hasMore: false };
      }

      return apiClient.fetchTasks(undefined, undefined, 20, {
        type: 'before',
        date: settings.oldestTaskCreatedAt,
      });
    },
    [settings.oldestTaskCreatedAt],
  );

  const fetchTasks = useCallback(
    async (loadMore: boolean) => {
      const apiClient = getApiClient();
      if (!apiClient) {
        return;
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timeout'));
        }, 30000);
      });

      const fetchPromise = loadMore
        ? fetchOlderTasks(apiClient)
        : fetchNewTasks(apiClient);

      const fetchedTasks = await Promise.race([fetchPromise, timeoutPromise]);
      if (fetchedTasks.tasks.length === 0) {
        if (!loadMore) {
          toast.info('新しいタスクはありませんでした');
        }
        setHasMoreTasks(false);
        return;
      }
      return fetchedTasks;
    },
    [getApiClient, fetchNewTasks, fetchOlderTasks],
  );

  const getSyncErrorMessage = useCallback(
    (
      error: unknown,
    ): {
      errorMessage: string;
      errorDetails: string;
    } => {
      const defaultResponse = {
        errorMessage: 'データの同期に失敗しました',
        errorDetails: '',
      };

      if (!(error instanceof Error)) {
        return defaultResponse;
      }

      // Handle timeout errors
      if (error.message === 'Request timeout') {
        return {
          errorMessage: 'データの同期がタイムアウトしました',
          errorDetails:
            'ネットワーク接続を確認してください。プロキシサーバーを使用している場合は、設定を確認してください。',
        };
      }

      // Handle authentication errors
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized')
      ) {
        return {
          errorMessage: '認証エラーが発生しました',
          errorDetails:
            'APIキーまたは認証情報が正しくない可能性があります。設定を確認してください。',
        };
      }

      // Handle not found errors
      if (error.message.includes('404')) {
        return {
          errorMessage: 'リソースが見つかりません',
          errorDetails:
            'データベースIDまたはタスクリストが正しくない可能性があります。',
        };
      }

      // Handle network/CORS errors
      if (error.message.includes('CORS') || error.message.includes('fetch')) {
        return {
          errorMessage: 'ネットワークエラーが発生しました',
          errorDetails: `${error.message}\n\nCORSエラーの場合は、プロキシサーバーの設定が必要です。`,
        };
      }

      // Default case with error details
      return {
        ...defaultResponse,
        errorDetails: error.message,
      };
    },
    [],
  );

  const handleSyncError = useCallback(
    (error: unknown) => {
      console.error('Sync failed:', error);
      const { errorMessage, errorDetails } = getSyncErrorMessage(error);
      onError({
        title: errorMessage,
        message: 'エラーの詳細情報:',
        details: errorDetails || '不明なエラーが発生しました',
      });
      toast.error(errorMessage);
    },
    [onError, getSyncErrorMessage],
  );

  const updateCreatedAtRange = useCallback(
    (tasks: Task[], currentSettings: AppSettings) => {
      if (tasks.length === 0) {
        return currentSettings;
      }

      const taskCreatedAts = tasks.map((task) => new Date(task.createdAt));
      const minCreatedAt = new Date(
        Math.min(...taskCreatedAts.map((d) => d.getTime())),
      );
      const maxCreatedAt = new Date(
        Math.max(...taskCreatedAts.map((d) => d.getTime())),
      );

      return {
        ...currentSettings,
        newestTaskCreatedAt:
          !currentSettings.newestTaskCreatedAt ||
          maxCreatedAt > currentSettings.newestTaskCreatedAt
            ? maxCreatedAt
            : currentSettings.newestTaskCreatedAt,
        oldestTaskCreatedAt:
          !currentSettings.oldestTaskCreatedAt ||
          minCreatedAt < currentSettings.oldestTaskCreatedAt
            ? minCreatedAt
            : currentSettings.oldestTaskCreatedAt,
      };
    },
    [],
  );

  const sync = useCallback(
    async (loadMore = false) => {
      if (!settings.backendType) {
        toast.error('バックエンドサービスが設定されていません');
        return;
      }

      setSyncState(loadMore ? 'loading-more' : 'syncing');

      try {
        const fetchedTasks = await fetchTasks(loadMore);
        if (!fetchedTasks) {
          return;
        }

        // Simply add all fetched tasks to IndexedDB
        // No duplicate handling needed due to date filtering
        for (const task of fetchedTasks.tasks) {
          await dbManager.addTask(task);
        }

        // Update UI with all tasks from DB
        const allTasks = await dbManager.getTasks();
        onTasksUpdated(allTasks);

        setHasMoreTasks(fetchedTasks.hasMore);

        if (!loadMore) {
          toast.success(`${fetchedTasks.tasks.length}件のタスクを同期しました`);
        }

        // Update sync settings with createdAt range
        const newSettings = updateCreatedAtRange(fetchedTasks.tasks, {
          ...settings,
          lastSyncAt: new Date(),
        });

        await dbManager.saveSettings(newSettings);
        onSettingsUpdated(newSettings);
      } catch (error) {
        handleSyncError(error);
      } finally {
        setSyncState('idle');
      }
    },
    [
      settings,
      fetchTasks,
      updateCreatedAtRange,
      onTasksUpdated,
      onSettingsUpdated,
      handleSyncError,
    ],
  );

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 1000 && // Load when 1000px from bottom
      hasMoreTasks &&
      syncState === 'idle'
    ) {
      sync(true); // Load more
    }
  }, [hasMoreTasks, syncState, sync]);

  // Add scroll listener
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return {
    sync,
    syncMore: () => sync(true),
    isSyncing: syncState === 'syncing',
    isLoadingMore: syncState === 'loading-more',
    hasMoreTasks,
  };
}
