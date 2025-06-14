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
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'read' | 'stocked' | 'unread'>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      setTasks(savedTasks);

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

  // Sync data with backend
  const syncData = useCallback(async () => {
    if (!settings.backendType) {
      toast.error('バックエンドサービスが設定されていません');
      return;
    }

    try {
      let apiClient;
      
      if (settings.backendType === 'notion') {
        if (!settings.notionApiKey || !settings.notionDatabaseId) {
          toast.error('Notionの設定が不完全です');
          return;
        }
        apiClient = new NotionAPIClient(settings.notionApiKey, settings.notionDatabaseId);
      } else if (settings.backendType === 'google-tasks') {
        if (!settings.googleTasksCredentials) {
          toast.error('Google Tasksの設定が不完全です');
          return;
        }
        apiClient = new GoogleTasksAPIClient(settings.googleTasksCredentials);
      }

      if (!apiClient) return;

      const fetchedTasks = await apiClient.fetchTasks();
      
      if (fetchedTasks.length > 0) {
        // Merge with existing tasks, preserving local state (read, stocked)
        const existingTasksMap = new Map(tasks.map(task => [task.sourceId, task]));
        
        const mergedTasks = fetchedTasks.map(fetchedTask => {
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

        setTasks(mergedTasks);
        toast.success(`${fetchedTasks.length}件のタスクを同期しました`);
        
        // Update last sync time
        await dbManager.saveSettings({
          ...settings,
          lastSyncAt: new Date(),
        });
      } else {
        toast.info('新しいタスクはありませんでした');
      }
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('データの同期に失敗しました');
    }
  }, [settings, tasks]);

  const { isRefreshing, isPulling, pullDistance } = usePullToRefresh(syncData);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    let filtered = tasks;

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
          url: window.location.href,
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      await navigator.clipboard.writeText(`${task.title}\n${task.description || ''}`);
      toast.success('クリップボードにコピーしました');
    }
  };

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
              <Button onClick={syncData} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                データを同期
              </Button>
            )}
          </div>
        ) : (
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
        )}
      </main>

      <SettingsMenu open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}