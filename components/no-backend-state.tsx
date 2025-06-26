import { Button } from '@/components/ui/button';
import { Database, Settings } from 'lucide-react';

interface NoBackendStateProps {
  onOpenSettings: () => void;
}

export function NoBackendState({ onOpenSettings }: NoBackendStateProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md text-center">
        <Database className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
        <h2 className="mb-2 font-semibold text-2xl">
          バックエンドサービスを設定
        </h2>
        <p className="mb-6 text-muted-foreground">
          NotionまたはGoogle Tasksを設定してタスクの同期を開始しましょう
        </p>
        <Button onClick={onOpenSettings}>
          <Settings className="mr-2 h-4 w-4" />
          設定を開く
        </Button>
      </div>
    </div>
  );
}
