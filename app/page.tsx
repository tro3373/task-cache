'use client';

import { ErrorDialog } from '@/components/error-dialog';
import { Header } from '@/components/header';
import { LoadingOverlay } from '@/components/loading-overlay';
import { PullToRefreshIndicator } from '@/components/pull-to-refresh-indicator';
import { SettingsMenu } from '@/components/settings-menu';
import { TaskCard } from '@/components/task-card';
import { Button } from '@/components/ui/button';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { GoogleTasksAPIClient, NotionAPIClient } from '@/lib/api-clients';
import { type AppSettings, type Task, dbManager } from '@/lib/indexeddb';
import { Database, RefreshCw, Settings } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ backendType: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreTasks, setHasMoreTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'read' | 'stocked' | 'unread'>(
    'unread',
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  // Helper function to remove duplicate tasks by ID
  const removeDuplicateTasks = (tasks: Task[]): Task[] => {
    const seen = new Set<string>();
    return tasks.filter((task) => {
      if (seen.has(task.id)) {
        return false;
      }
      seen.add(task.id);
      return true;
    });
  };

  // Initialize app
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      await dbManager.init();
      await dbManager.persistStorage();

      const savedSettings = await dbManager.getSettings();
      setSettings(savedSettings);

      const savedTasks = await dbManager.getTasks();
      setTasks(removeDuplicateTasks(savedTasks));

      // Register service worker
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js');
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
      toast.error('アプリの初期化に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // Sync data with backend (incremental)
  const syncData = useCallback(
    async (loadMore = false) => {
      if (!settings.backendType) {
        toast.error('バックエンドサービスが設定されていません');
        return;
      }

      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      try {
        let apiClient: NotionAPIClient | GoogleTasksAPIClient | undefined;

        if (settings.backendType === 'notion') {
          if (!(settings.notionApiKey && settings.notionDatabaseId)) {
            toast.error('Notionの設定が不完全です');
            return;
          }
          apiClient = new NotionAPIClient(
            settings.notionApiKey,
            settings.notionDatabaseId,
            settings.proxyServerUrl,
          );
        } else if (settings.backendType === 'google-tasks') {
          if (!settings.googleTasksCredentials) {
            toast.error('Google Tasksの設定が不完全です');
            return;
          }
          apiClient = new GoogleTasksAPIClient(
            settings.googleTasksCredentials,
            settings.proxyServerUrl,
          );
        }

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
        const result = await Promise.race([fetchPromise, timeoutPromise]);

        if (result.tasks.length > 0) {
          // Get existing tasks from IndexedDB to preserve local state
          const allExistingTasks = await dbManager.getTasks();
          const existingTasksMap = new Map(
            allExistingTasks.map((task) => [task.sourceId, task]),
          );

          const mergedTasks = result.tasks.map((fetchedTask) => {
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

          if (loadMore) {
            // Append to existing tasks, avoiding duplicates
            setTasks((prev) => {
              const existingIds = new Set(prev.map((task) => task.id));
              const newTasks = mergedTasks.filter(
                (task) => !existingIds.has(task.id),
              );
              return [...prev, ...newTasks];
            });
          } else {
            // Replace with new tasks + reload from DB to get complete list
            const allTasks = await dbManager.getTasks();
            setTasks(removeDuplicateTasks(allTasks));
          }

          setHasMoreTasks(result.hasMore);

          if (!loadMore) {
            toast.success(`${result.tasks.length}件のタスクを同期しました`);
          }

          // Update sync settings
          const newSettings = {
            ...settings,
            lastSyncAt: new Date(),
            lastSyncCursor: result.nextCursor,
          };
          await dbManager.saveSettings(newSettings);
          setSettings(newSettings);
        } else {
          if (!loadMore) {
            toast.info('新しいタスクはありませんでした');
          }
          setHasMoreTasks(false);
        }
      } catch (error) {
        console.error('Sync failed:', error);

        let errorMessage = 'データの同期に失敗しました';
        let errorDetails = '';

        if (error instanceof Error) {
          if (error.message === 'Request timeout') {
            errorMessage = 'データの同期がタイムアウトしました';
            errorDetails =
              'ネットワーク接続を確認してください。プロキシサーバーを使用している場合は、設定を確認してください。';
          } else {
            errorDetails = error.message;

            // Check for specific error patterns
            if (
              error.message.includes('401') ||
              error.message.includes('Unauthorized')
            ) {
              errorMessage = '認証エラーが発生しました';
              errorDetails =
                'APIキーまたは認証情報が正しくない可能性があります。設定を確認してください。';
            } else if (error.message.includes('404')) {
              errorMessage = 'リソースが見つかりません';
              errorDetails =
                'データベースIDまたはタスクリストが正しくない可能性があります。';
            } else if (
              error.message.includes('CORS') ||
              error.message.includes('fetch')
            ) {
              errorMessage = 'ネットワークエラーが発生しました';
              errorDetails = `${error.message}\n\nCORSエラーの場合は、プロキシサーバーの設定が必要です。`;
            }
          }
        }

        // Show error dialog with details
        setErrorDialog({
          isOpen: true,
          title: errorMessage,
          message: 'エラーの詳細情報:',
          details: errorDetails || '不明なエラーが発生しました',
        });

        toast.error(errorMessage);
      } finally {
        if (loadMore) {
          setIsLoadingMore(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [settings, removeDuplicateTasks],
  );

  const { isRefreshing, isPulling, pullDistance } = usePullToRefresh(syncData);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    // First, remove duplicates by ID
    const uniqueTasks = removeDuplicateTasks(tasks);

    let filtered = uniqueTasks;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.author?.toLowerCase().includes(query),
      );
    }

    // Apply status filter
    switch (filter) {
      case 'read':
        filtered = filtered.filter((task) => task.read);
        break;
      case 'unread':
        filtered = filtered.filter((task) => !task.read);
        break;
      case 'stocked':
        filtered = filtered.filter((task) => task.stocked);
        break;
      default:
        break;
    }

    return filtered.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [tasks, searchQuery, filter, removeDuplicateTasks]);

  // Task actions
  const handleToggleRead = async (task: Task) => {
    const updatedTask = { ...task, read: !task.read, updatedAt: new Date() };
    await dbManager.updateTask(updatedTask);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updatedTask : t)));
    toast.success(updatedTask.read ? '既読にしました' : '未読にしました');
  };

  const handleToggleStock = async (task: Task) => {
    const updatedTask = {
      ...task,
      stocked: !task.stocked,
      updatedAt: new Date(),
    };
    await dbManager.updateTask(updatedTask);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updatedTask : t)));
    toast.success(
      updatedTask.stocked ? 'ストックしました' : 'ストックを解除しました',
    );
  };

  const handleDelete = async (task: Task) => {
    await dbManager.deleteTask(task.id);
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    toast.success('タスクを削除しました');
  };

  const handleShare = async (task: Task) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: task.title,
          text: task.description,
          url: task.url || task.notionPageUrl || window.location.href,
        });
      } catch (_error) {
        console.log('Share cancelled');
      }
    } else {
      const shareText = `${task.title}\n${task.description || ''}\n${task.url || task.notionPageUrl || ''}`;
      await navigator.clipboard.writeText(shareText);
      toast.success('クリップボードにコピーしました');
    }
  };


  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 1000 && // Load when 1000px from bottom
      hasMoreTasks &&
      !isLoadingMore &&
      !isRefreshing
    ) {
      syncData(true); // Load more
    }
  }, [hasMoreTasks, isLoadingMore, isRefreshing, syncData]);

  // Add scroll listener
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const unreadCount = tasks.filter((task) => !task.read).length;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <LoadingOverlay
        isLoading={isLoading && !isRefreshing}
        message="タスクを同期しています..."
      />

      <PullToRefreshIndicator
        isVisible={isPulling}
        isRefreshing={isRefreshing}
        pullDistance={pullDistance}
      />

      <Header
        onRefresh={syncData}
        onSearch={setSearchQuery}
        onFilterChange={setFilter}
        isRefreshing={isRefreshing}
        totalTasks={tasks.length}
        unreadCount={unreadCount}
        currentFilter={filter}
      />

      <main className="container px-4 py-6">
        {settings.backendType ? (
          filteredTasks.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mb-4 text-6xl">📝</div>
              <h2 className="mb-2 font-semibold text-2xl">
                {tasks.length === 0
                  ? 'タスクがありません'
                  : '条件に合うタスクがありません'}
              </h2>
              <p className="mb-6 text-muted-foreground">
                {tasks.length === 0
                  ? '下に引いてタスクを同期するか、バックエンドサービスでタスクを作成してください'
                  : '検索条件やフィルタを変更してみてください'}
              </p>
              {tasks.length === 0 && (
                <Button
                  onClick={() => syncData()}
                  disabled={isRefreshing}
                  className={`relative overflow-hidden ${
                    isRefreshing ? 'animate-sync-pulse bg-primary/10' : ''
                  }`}
                >
                  {isRefreshing && (
                    <div className="-skew-x-12 absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                  )}
                  <RefreshCw
                    className={`mr-2 h-4 w-4 transition-all duration-300 ${
                      isRefreshing
                        ? 'animate-spin text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                        : 'hover:rotate-180'
                    }`}
                  />
                  <span className={isRefreshing ? 'animate-pulse' : ''}>
                    {isRefreshing ? '同期中...' : 'データを同期'}
                  </span>
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggleRead={handleToggleRead}
                    onToggleStock={handleToggleStock}
                    onDelete={handleDelete}
                    onShare={handleShare}
                  />
                ))}
              </div>

              {/* Loading more indicator */}
              {isLoadingMore && (
                <div className="flex items-center justify-center py-8">
                  <div className="relative">
                    <RefreshCw className="mr-2 h-6 w-6 animate-spin text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                    <div className="absolute inset-0 mr-2 h-6 w-6 animate-pulse rounded-full bg-primary/20 blur-md" />
                  </div>
                  <span className="animate-pulse font-medium text-primary">
                    さらに読み込み中...
                  </span>
                  <div className="ml-2 flex space-x-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary/60" />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-primary/60"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-primary/60"
                      style={{ animationDelay: '0.2s' }}
                    />
                  </div>
                </div>
              )}

              {/* No more data indicator */}
              {!hasMoreTasks && filteredTasks.length > 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  すべてのタスクを表示しました
                </div>
              )}
            </>
          )
        ) : (
          <div className="py-16 text-center">
            <Database className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="mb-2 font-semibold text-2xl">
              バックエンドサービスを設定
            </h2>
            <p className="mb-6 text-muted-foreground">
              NotionまたはGoogle Tasksを設定してタスクの同期を開始しましょう
            </p>
            <Button onClick={() => setSettingsOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />
              設定を開く
            </Button>
          </div>
        )}
      </main>

      <SettingsMenu
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      <ErrorDialog
        isOpen={errorDialog.isOpen}
        onClose={() => setErrorDialog({ ...errorDialog, isOpen: false })}
        title={errorDialog.title}
        message={errorDialog.message}
        details={errorDialog.details}
      />
    </div>
  );
}
