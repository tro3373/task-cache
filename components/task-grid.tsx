import { TaskCard } from '@/components/task-card';
import type { Task } from '@/lib/indexeddb';
import { RefreshCw } from 'lucide-react';

interface TaskGridProps {
  tasks: Task[];
  onToggleRead: (task: Task) => void;
  onToggleStock: (task: Task) => void;
  onDelete: (task: Task) => void;
  onShare: (task: Task) => void;
  isLoadingMore: boolean;
  hasMoreTasks: boolean;
}

export function TaskGrid({
  tasks,
  onToggleRead,
  onToggleStock,
  onDelete,
  onShare,
  isLoadingMore,
  hasMoreTasks,
}: TaskGridProps) {
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onToggleRead={onToggleRead}
            onToggleStock={onToggleStock}
            onDelete={onDelete}
            onShare={onShare}
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
      {!hasMoreTasks && tasks.length > 0 && (
        <div className="py-8 text-center text-muted-foreground">
          すべてのタスクを表示しました
        </div>
      )}
    </>
  );
}
