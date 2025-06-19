import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { GoogleTasksAPIClient } from '@/lib/google-tasks-api-client';
import { type AppSettings, dbManager } from '@/lib/indexeddb';
import { NotionAPIClient } from '@/lib/notion-api-client';
import { Database, Download, Settings } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SettingsMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsMenu({ open, onOpenChange }: SettingsMenuProps) {
  const [settings, setSettings] = useState<AppSettings>({ backendType: null });
  const [isLoading, setIsLoading] = useState(false);
  const { canInstall, install } = usePWAInstall();

  const loadSettings = useCallback(async () => {
    try {
      await dbManager.init();
      const savedSettings = await dbManager.getSettings();
      setSettings(savedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('設定の読み込みに失敗しました');
    }
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await dbManager.init();
      await dbManager.saveSettings(settings);
      toast.success('設定を保存しました');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('設定の保存に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const toastStatus = useCallback((connectTo: string, status: boolean) => {
    const statusMsg = status ? '成功' : '失敗';
    const message = `${connectTo}への接続テストが${statusMsg}しました`;
    toast.success(message);
  }, []);

  const testConnectionInner = useCallback(async () => {
    if (settings.backendType === 'notion') {
      if (!(settings.notionApiKey && settings.notionDatabaseId)) {
        toast.error('Notion APIキーとデータベースIDを入力してください');
        return;
      }
      const client = new NotionAPIClient(
        settings.notionApiKey,
        settings.notionDatabaseId,
        settings.proxyServerUrl,
      );
      const isAuthenticated = await client.authenticate();
      toastStatus('Notion', isAuthenticated);
      return;
    }

    if (settings.backendType === 'google-tasks') {
      if (!settings.googleTasksCredentials) {
        toast.error('Google Tasks認証情報を入力してください');
        return;
      }

      const client = new GoogleTasksAPIClient(
        settings.googleTasksCredentials,
        settings.proxyServerUrl,
      );
      const isAuthenticated = await client.authenticate();
      toastStatus('Google Tasks', isAuthenticated);
      return;
    }
  }, [toastStatus, settings]);

  const testConnection = useCallback(async () => {
    if (!settings.backendType) {
      toast.error('バックエンドタイプを選択してください');
      return;
    }

    setIsLoading(true);
    try {
      await testConnectionInner();
    } catch (_error) {
      toast.error('接続テストでエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [testConnectionInner, settings.backendType]);

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open, loadSettings]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            設定
          </DialogTitle>
          <DialogDescription>
            バックエンドサービスの設定とアプリの設定を行います
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* PWA Install */}
          {canInstall && (
            <div className="rounded-lg bg-primary/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">アプリをインストール</h4>
                  <p className="text-muted-foreground text-sm">
                    ホーム画面に追加してオフラインでも使用できます
                  </p>
                </div>
                <Button onClick={install} size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  インストール
                </Button>
              </div>
            </div>
          )}

          {/* Proxy Server Settings */}
          <div className="space-y-3">
            <Label className="font-semibold text-base">
              プロキシサーバー設定（オプション）
            </Label>
            <div className="space-y-2">
              <Label htmlFor="proxy-server-url">プロキシサーバーURL</Label>
              <Input
                id="proxy-server-url"
                placeholder="https://proxy.example.com/api?url="
                value={settings.proxyServerUrl || ''}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    proxyServerUrl: e.target.value,
                  }))
                }
              />
              <p className="text-muted-foreground text-xs">
                CORS制限を回避するためのプロキシサーバーURLを設定します。末尾に「?url=」を含めてください。
              </p>
            </div>
          </div>

          {/* Backend Selection */}
          <div className="space-y-3">
            <Label className="font-semibold text-base">
              バックエンドサービス
            </Label>
            <Select
              value={settings.backendType || ''}
              onValueChange={(value: 'notion' | 'google-tasks') =>
                setSettings((prev) => ({ ...prev, backendType: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="サービスを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="notion">Notion</SelectItem>
                <SelectItem value="google-tasks">Google Tasks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notion Settings */}
          {settings.backendType === 'notion' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notion-api-key">Notion APIキー</Label>
                <Input
                  id="notion-api-key"
                  type="password"
                  placeholder="secret_..."
                  value={settings.notionApiKey || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      notionApiKey: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notion-database-id">データベースID</Label>
                <Input
                  id="notion-database-id"
                  placeholder="32桁のデータベースID"
                  value={settings.notionDatabaseId || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      notionDatabaseId: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          )}

          {/* Google Tasks Settings */}
          {settings.backendType === 'google-tasks' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="google-credentials">認証情報 (JSON)</Label>
                <Textarea
                  id="google-credentials"
                  placeholder="Google Tasks APIの認証情報をJSON形式で入力"
                  value={settings.googleTasksCredentials || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      googleTasksCredentials: e.target.value,
                    }))
                  }
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Test Connection */}
          {settings.backendType && (
            <Button
              onClick={testConnection}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              <Database className="mr-2 h-4 w-4" />
              {isLoading ? '接続テスト中...' : '接続テスト'}
            </Button>
          )}

          {/* Clear Local Data */}
          <AlertDialog>
            <AlertDialogTrigger asChild={true}>
              <Button variant="destructive" className="w-full">
                <Database className="mr-2 h-4 w-4" />
                データをクリア
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>データをクリアしますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  この操作により、以下のデータが削除されます：
                </AlertDialogDescription>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li>すべてのタスクデータ</li>
                  <li>既読・ストック状態</li>
                  <li>最終同期情報</li>
                </ul>
                <p className="mt-3 text-sm font-semibold text-muted-foreground">
                  この操作は取り消すことができません。
                </p>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    try {
                      await dbManager.init();

                      // Clear tasks data
                      const db = dbManager.getDb();
                      if (!db) {
                        throw new Error('Database not initialized');
                      }
                      const transaction = db.transaction(
                        ['tasks'],
                        'readwrite',
                      );
                      const store = transaction.objectStore('tasks');
                      store.clear();

                      // Reset sync range settings while keeping other settings
                      const currentSettings = await dbManager.getSettings();
                      const newSettings = {
                        ...currentSettings,
                        lastSyncCursor: undefined,
                        newestTaskCreatedAt: undefined,
                        oldestTaskCreatedAt: undefined,
                      };
                      await dbManager.saveSettings(newSettings);

                      toast.success('データをクリアしました');
                      window.location.reload(); // Reload to reflect changes
                    } catch (_error) {
                      toast.error('データクリアに失敗しました');
                    }
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  データをクリア
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
