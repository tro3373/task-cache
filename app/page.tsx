"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/components/header';
import { TaskCard } from '@/components/task-card';
import { PullToRefreshIndicator } from '@/components/pull-to-refresh-indicator';
import { Task, AppSettings, dbManager } from '@/lib/indexeddb';
import { NotionAPIClient, GoogleTasksAPIClient } from '@/lib/api-clients';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw, Settings, Database } from 'lucide-react';
import { SettingsMenu } from '@/components/settings-menu';

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ backendType: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreTasks, setHasMoreTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'read' | 'stocked' | 'unread'>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Helper function to remove duplicate tasks by ID
  const removeDuplicateTasks = (tasks: Task[]): Task[] => {
    const seen = new Set<string>();
    return tasks.filter(task => {
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
  const syncData = useCallback(async (loadMore = false) => {
    if (!settings.backendType) {
      toast.error('バックエンドサービスが設定されていません');
      return;
    }

    if (loadMore) {
      setIsLoadingMore(true);
    }

    try {
      let apiClient;
      
      if (settings.backendType === 'notion') {
        if (!settings.notionApiKey || !settings.notionDatabaseId) {
          toast.error('Notionの設定が不完全です');
          return;
        }
        apiClient = new NotionAPIClient(settings.notionApiKey, settings.notionDatabaseId, settings.proxyServerUrl);
      } else if (settings.backendType === 'google-tasks') {
        if (!settings.googleTasksCredentials) {
          toast.error('Google Tasksの設定が不完全です');
          return;
        }
        apiClient = new GoogleTasksAPIClient(settings.googleTasksCredentials, settings.proxyServerUrl);
      }

      if (!apiClient) return;

      // For incremental sync, use lastSyncAt for filtering
      // For pagination, use lastSyncCursor
      const result = await apiClient.fetchTasks(
        loadMore ? undefined : settings.lastSyncAt,
        loadMore ? settings.lastSyncCursor : undefined,
        20
      );
      
      if (result.tasks.length > 0) {
        // Get existing tasks from IndexedDB to preserve local state
        const allExistingTasks = await dbManager.getTasks();
        const existingTasksMap = new Map(allExistingTasks.map(task => [task.sourceId, task]));
        
        const mergedTasks = result.tasks.map(fetchedTask => {
          const existing = existingTasksMap.get(fetchedTask.sourceId);
          return existing ? {
            ...fetchedTask,
            read: existing.read,
            stocked: existing.stocked,
          } : fetchedTask;
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
          setTasks(prev => {
            const existingIds = new Set(prev.map(task => task.id));
            const newTasks = mergedTasks.filter(task => !existingIds.has(task.id));
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
      toast.error('データの同期に失敗しました');
    } finally {
      if (loadMore) {
        setIsLoadingMore(false);
      }
    }
  }, [settings, tasks]);

  const { isRefreshing, isPulling, pullDistance } = usePullToRefresh(syncData);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    // First, remove duplicates by ID
    const uniqueTasks = removeDuplicateTasks(tasks);

    let filtered = uniqueTasks;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.author?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    switch (filter) {
      case 'read':
        filtered = filtered.filter(task => task.read);
        break;
      case 'unread':
        filtered = filtered.filter(task => !task.read);
        break;
      case 'stocked':
        filtered = filtered.filter(task => task.stocked);
        break;
      default:
        break;
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tasks, searchQuery, filter]);

  // Task actions
  const handleToggleRead = async (task: Task) => {
    const updatedTask = { ...task, read: !task.read, updatedAt: new Date() };
    await dbManager.updateTask(updatedTask);
    setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
    toast.success(updatedTask.read ? '既読にしました' : '未読にしました');
  };

  const handleToggleStock = async (task: Task) => {
    const updatedTask = { ...task, stocked: !task.stocked, updatedAt: new Date() };
    await dbManager.updateTask(updatedTask);
    setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
    toast.success(updatedTask.stocked ? 'ストックしました' : 'ストックを解除しました');
  };

  const handleDelete = async (task: Task) => {
    await dbManager.deleteTask(task.id);
    setTasks(prev => prev.filter(t => t.id !== task.id));
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
      } catch (error) {
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

  const unreadCount = tasks.filter(task => !task.read).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
        {!settings.backendType ? (
          <div className="text-center py-16">
            <Database className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">バックエンドサービスを設定</h2>
            <p className="text-muted-foreground mb-6">
              NotionまたはGoogle Tasksを設定してタスクの同期を開始しましょう
            </p>
            <Button onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              設定を開く
            </Button>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-2xl font-semibold mb-2">
              {tasks.length === 0 ? 'タスクがありません' : '条件に合うタスクがありません'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {tasks.length === 0 
                ? '下に引いてタスクを同期するか、バックエンドサービスでタスクを作成してください'
                : '検索条件やフィルタを変更してみてください'
              }
            </p>
            {tasks.length === 0 && (
              <div className="flex gap-2">
                <Button 
                  onClick={syncData} 
                  disabled={isRefreshing}
                  className={`relative overflow-hidden ${
                    isRefreshing ? 'bg-primary/10 animate-sync-pulse' : ''
                  }`}
                >
                  {isRefreshing && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-shimmer -skew-x-12" />
                  )}
                  <RefreshCw className={`h-4 w-4 mr-2 transition-all duration-300 ${
                    isRefreshing 
                      ? 'animate-spin text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' 
                      : 'hover:rotate-180'
                  }`} />
                  <span className={isRefreshing ? 'animate-pulse' : ''}>
                    {isRefreshing ? '同期中...' : 'データを同期'}
                  </span>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    await dbManager.init();
                    const db = (dbManager as any).db;
                    const transaction = db.transaction(['tasks'], 'readwrite');
                    const store = transaction.objectStore('tasks');
                    await store.clear();
                    setTasks([]);
                    toast.success('ローカルデータをクリアしました');
                  }}
                >
                  データクリア
                </Button>
              </div>
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
                  <RefreshCw className="h-6 w-6 animate-spin mr-2 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                  <div className="absolute inset-0 h-6 w-6 rounded-full bg-primary/20 blur-md animate-pulse mr-2" />
                </div>
                <span className="animate-pulse font-medium text-primary">さらに読み込み中...</span>
                <div className="ml-2 flex space-x-1">
                  <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            )}
            
            {/* No more data indicator */}
            {!hasMoreTasks && filteredTasks.length > 0 && (
              <div className="text-center py-8 text-muted-foreground">
                すべてのタスクを表示しました
              </div>
            )}
          </>
        )}
      </main>

      <SettingsMenu open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}