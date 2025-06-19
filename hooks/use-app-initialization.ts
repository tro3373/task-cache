import { type AppSettings, type Task, dbManager } from '@/lib/indexeddb';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export function useAppInitialization() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ backendType: null });
  const [isLoading, setIsLoading] = useState(true);

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

  const initializeApp = useCallback(async () => {
    try {
      await dbManager.init();
      await dbManager.persistStorage();

      const savedSettings = await dbManager.getSettings();
      setSettings(savedSettings);

      const savedTasks = await dbManager.getTasks();
      setTasks(removeDuplicateTasks(savedTasks));

      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js');
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
      toast.error('アプリの初期化に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [removeDuplicateTasks]);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  return {
    tasks,
    setTasks,
    settings,
    setSettings,
    isLoading,
  };
}
