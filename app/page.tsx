'use client';

import { EmptyState } from '@/components/empty-state';
import { ErrorDialog } from '@/components/error-dialog';
import { Header } from '@/components/header';
import { LoadingOverlay } from '@/components/loading-overlay';
import { NoBackendState } from '@/components/no-backend-state';
import { PullToRefreshIndicator } from '@/components/pull-to-refresh-indicator';
import { SettingsMenu } from '@/components/settings-menu';
import { TaskGrid } from '@/components/task-grid';
import { useAppInitialization } from '@/hooks/use-app-initialization';
import { useErrorDialog } from '@/hooks/use-error-dialog';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useTaskActions } from '@/hooks/use-task-actions';
import { useTaskFilters } from '@/hooks/use-task-filters';
import { useTaskSync } from '@/hooks/use-task-sync';
import { dbManager } from '@/lib/indexeddb';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function Home() {
  const { tasks, setTasks, settings, setSettings, isLoading } =
    useAppInitialization();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { errorDialog, showError, hideError } = useErrorDialog();

  const { sync, isSyncing, isLoadingMore, hasMoreTasks } = useTaskSync({
    settings,
    onTasksUpdated: setTasks,
    onSettingsUpdated: setSettings,
    onError: showError,
  });

  const { isRefreshing, isPulling, pullDistance } = usePullToRefresh(() =>
    sync(),
  );

  const { filteredTasks, filter, unreadCount, setSearchQuery, setFilter } =
    useTaskFilters(tasks);

  const handleNotionSync = async () => {
    try {
      const result = await dbManager.syncTasksWithNotion();
      if (result.success > 0) {
        toast.success(`${result.success}件のタスクをNotionに同期しました`);
      }
      if (result.failed > 0) {
        const errorMessage = result.failed === 1 
          ? 'タスクの同期に失敗しました。CORSプロキシがPATCHメソッドをサポートしていない可能性があります。'
          : `${result.failed}件のタスクの同期に失敗しました`;
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Notion sync failed:', error);
      const errorMessage = error instanceof Error && error.message.includes('CORS')
        ? error.message
        : 'Notion同期中にエラーが発生しました';
      toast.error(errorMessage);
    }
  };

  const { handleToggleRead, handleToggleStock, handleDelete, handleShare } =
    useTaskActions({
      onTaskUpdate: (updatedTask) => {
        setTasks((prev) =>
          prev.map((task) => (task.id === updatedTask.id ? updatedTask : task)),
        );
      },
      onTaskDelete: (taskId) => {
        setTasks((prev) => prev.filter((task) => task.id !== taskId));
      },
      onNotionSync: handleNotionSync,
    });

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
        isLoading={isSyncing && !isRefreshing}
        message="タスクを同期しています..."
      />

      <PullToRefreshIndicator
        isVisible={isPulling}
        isRefreshing={isRefreshing}
        pullDistance={pullDistance}
      />

      <Header
        onRefresh={() => sync()}
        onSearch={setSearchQuery}
        onFilterChange={setFilter}
        isRefreshing={isRefreshing}
        totalTasks={tasks.length}
        unreadCount={unreadCount}
        currentFilter={filter}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="container px-4 py-6">
        {settings.backendType ? (
          filteredTasks.length === 0 ? (
            <EmptyState
              hasNoTasks={tasks.length === 0}
              onRefresh={() => sync()}
              isRefreshing={isRefreshing}
            />
          ) : (
            <TaskGrid
              tasks={filteredTasks}
              onToggleRead={handleToggleRead}
              onToggleStock={handleToggleStock}
              onDelete={handleDelete}
              onShare={handleShare}
              isLoadingMore={isLoadingMore}
              hasMoreTasks={hasMoreTasks}
            />
          )
        ) : (
          <NoBackendState onOpenSettings={() => setSettingsOpen(true)} />
        )}
      </main>

      <SettingsMenu
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSettingsChange={setSettings}
      />

      <ErrorDialog
        isOpen={errorDialog.isOpen}
        onClose={hideError}
        title={errorDialog.title}
        message={errorDialog.message}
        details={errorDialog.details}
      />
    </div>
  );
}
