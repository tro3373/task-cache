import type { FetchTasksResult } from '@/lib/api-clients';
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

  const removeDuplicateTasks = useCallback((tasks: Task[]): Task[] => {
    const seen = new Set<string>();
    return tasks.filter((task) => {
      if (seen.has(task.id)) {
        return false;
      }
      seen.add(task.id);
      return true;
    });
  }, []);

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

  const fetchTasks = useCallback(
    async (loadMore: boolean) => {
      const apiClient = getApiClient();
      if (!apiClient) {
        return;
      }

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timeout'));
        }, 30000); // 30 seconds timeout
      });

      // For incremental sync, use lastSyncAt for filtering
      // For pagination, use lastSyncCursor
      const fetchPromise = apiClient.fetchTasks(
        loadMore ? undefined : settings.lastSyncAt,
        loadMore ? settings.lastSyncCursor : undefined,
        20,
      );

      // Race between fetch and timeout
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
    [getApiClient, settings.lastSyncAt, settings.lastSyncCursor],
  );

  const mergeTasks = useCallback(async (fetchedTasks: FetchTasksResult) => {
    // Get existing tasks from IndexedDB to preserve local state
    const allExistingTasks = await dbManager.getTasks();
    const existingTasksMap = new Map(
      allExistingTasks.map((task) => [task.sourceId, task]),
    );

    const mergedTasks = fetchedTasks.tasks.map((fetchedTask) => {
      const existing = existingTasksMap.get(fetchedTask.sourceId);
      return existing
        ? {
            ...fetchedTask,
            read: existing.read,
            stocked: existing.stocked,
          }
        : fetchedTask;
    });

    // Save to IndexedDB
    for (const task of mergedTasks) {
      try {
        await dbManager.updateTask(task);
      } catch {
        await dbManager.addTask(task);
      }
    }
    return mergedTasks;
  }, []);

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

        const mergedTasks = await mergeTasks(fetchedTasks);

        let currentTasks = await dbManager.getTasks();
        if (loadMore) {
          const existingIds = new Set(currentTasks.map((task) => task.id));
          const newTasks = mergedTasks.filter(
            (task) => !existingIds.has(task.id),
          );
          currentTasks = [...currentTasks, ...newTasks];
        }
        onTasksUpdated(removeDuplicateTasks(currentTasks));

        setHasMoreTasks(fetchedTasks.hasMore);

        if (!loadMore) {
          toast.success(`${fetchedTasks.tasks.length}件のタスクを同期しました`);
        }

        // Update sync settings
        const newSettings = {
          ...settings,
          lastSyncAt: new Date(),
          lastSyncCursor: fetchedTasks.nextCursor,
        };
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
      mergeTasks,
      removeDuplicateTasks,
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
