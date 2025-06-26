import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  hasNoTasks: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function EmptyState({
  hasNoTasks,
  onRefresh,
  isRefreshing,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md text-center">
        <div className="mb-4 text-6xl">📝</div>
        <h2 className="mb-2 font-semibold text-2xl">
          {hasNoTasks ? 'タスクがありません' : '条件に合うタスクがありません'}
        </h2>
        <p className="mb-6 text-muted-foreground">
          {hasNoTasks
            ? '下に引いてタスクを同期するか、バックエンドサービスでタスクを作成してください'
            : '検索条件やフィルタを変更してみてください'}
        </p>
        {hasNoTasks && (
          <Button
            onClick={onRefresh}
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
    </div>
  );
}
