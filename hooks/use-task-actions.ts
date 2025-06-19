import { type Task, dbManager } from '@/lib/indexeddb';
import { useCallback } from 'react';
import { toast } from 'sonner';

interface UseTaskActionsOptions {
  onTaskUpdate: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
  onNotionSync?: () => Promise<void>;
}

export function useTaskActions({
  onTaskUpdate,
  onTaskDelete,
  onNotionSync,
}: UseTaskActionsOptions) {
  const handleToggleRead = useCallback(
    async (task: Task) => {
      const updatedTask = { ...task, read: !task.read, updatedAt: new Date() };
      await dbManager.updateTask(updatedTask);
      onTaskUpdate(updatedTask);
      toast.success(updatedTask.read ? '既読にしました' : '未読にしました');

      if (onNotionSync && task.source === 'notion') {
        await onNotionSync();
      }
    },
    [onTaskUpdate, onNotionSync],
  );

  const handleToggleStock = useCallback(
    async (task: Task) => {
      const updatedTask = {
        ...task,
        stocked: !task.stocked,
        updatedAt: new Date(),
      };
      await dbManager.updateTask(updatedTask);
      onTaskUpdate(updatedTask);
      toast.success(
        updatedTask.stocked ? 'ストックしました' : 'ストックを解除しました',
      );

      if (onNotionSync && task.source === 'notion') {
        await onNotionSync();
      }
    },
    [onTaskUpdate, onNotionSync],
  );

  const handleDelete = useCallback(
    async (task: Task) => {
      await dbManager.deleteTask(task.id);
      onTaskDelete(task.id);
      toast.success('タスクを削除しました');
    },
    [onTaskDelete],
  );

  const handleShare = useCallback(async (task: Task) => {
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
  }, []);

  return {
    handleToggleRead,
    handleToggleStock,
    handleDelete,
    handleShare,
  };
}
