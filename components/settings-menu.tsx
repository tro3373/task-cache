"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AppSettings, dbManager } from '@/lib/indexeddb';
import { NotionAPIClient, GoogleTasksAPIClient } from '@/lib/api-clients';
import { Settings, Database, Key, Download } from 'lucide-react';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { toast } from 'sonner';

interface SettingsMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsMenu({ open, onOpenChange }: SettingsMenuProps) {
  const [settings, setSettings] = useState<AppSettings>({ backendType: null });
  const [isLoading, setIsLoading] = useState(false);
  const { canInstall, install } = usePWAInstall();

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    try {
      await dbManager.init();
      const savedSettings = await dbManager.getSettings();
      setSettings(savedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('設定の読み込みに失敗しました');
    }
  };

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

  const testConnection = async () => {
    if (!settings.backendType) {
      toast.error('バックエンドタイプを選択してください');
      return;
    }

    setIsLoading(true);
    try {
      if (settings.backendType === 'notion') {
        if (!settings.notionApiKey || !settings.notionDatabaseId) {
          toast.error('Notion APIキーとデータベースIDを入力してください');
          return;
        }
        
        const client = new NotionAPIClient(settings.notionApiKey, settings.notionDatabaseId, settings.proxyServerUrl);
        const isAuthenticated = await client.authenticate();
        
        if (isAuthenticated) {
          toast.success('Notionへの接続に成功しました');
        } else {
          toast.error('Notionへの接続に失敗しました');
        }
      } else if (settings.backendType === 'google-tasks') {
        if (!settings.googleTasksCredentials) {
          toast.error('Google Tasks認証情報を入力してください');
          return;
        }
        
        const client = new GoogleTasksAPIClient(settings.googleTasksCredentials, settings.proxyServerUrl);
        const isAuthenticated = await client.authenticate();
        
        if (isAuthenticated) {
          toast.success('Google Tasksへの接続に成功しました');
        } else {
          toast.error('Google Tasksへの接続に失敗しました');
        }
      }
    } catch (error) {
      toast.error('接続テストでエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

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
            <div className="p-4 bg-primary/10 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">アプリをインストール</h4>
                  <p className="text-sm text-muted-foreground">
                    ホーム画面に追加してオフラインでも使用できます
                  </p>
                </div>
                <Button onClick={install} size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  インストール
                </Button>
              </div>
            </div>
          )}

          {/* Proxy Server Settings */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">プロキシサーバー設定（オプション）</Label>
            <div className="space-y-2">
              <Label htmlFor="proxy-server-url">プロキシサーバーURL</Label>
              <Input
                id="proxy-server-url"
                placeholder="https://proxy.example.com/api?url="
                value={settings.proxyServerUrl || ''}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  proxyServerUrl: e.target.value 
                }))}
              />
              <p className="text-xs text-muted-foreground">
                CORS制限を回避するためのプロキシサーバーURLを設定します。末尾に「?url=」を含めてください。
              </p>
            </div>
          </div>

          {/* Backend Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">バックエンドサービス</Label>
            <Select
              value={settings.backendType || ''}
              onValueChange={(value: 'notion' | 'google-tasks') => 
                setSettings(prev => ({ ...prev, backendType: value }))
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
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    notionApiKey: e.target.value 
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notion-database-id">データベースID</Label>
                <Input
                  id="notion-database-id"
                  placeholder="32桁のデータベースID"
                  value={settings.notionDatabaseId || ''}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    notionDatabaseId: e.target.value 
                  }))}
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
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    googleTasksCredentials: e.target.value 
                  }))}
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
              <Database className="h-4 w-4 mr-2" />
              {isLoading ? '接続テスト中...' : '接続テスト'}
            </Button>
          )}

          {/* Clear Local Data */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full"
              >
                <Database className="h-4 w-4 mr-2" />
                データをクリア
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>データをクリアしますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  この操作により、以下のデータが削除されます：
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>すべてのタスクデータ</li>
                    <li>既読・ストック状態</li>
                    <li>最終同期情報</li>
                  </ul>
                  <p className="mt-3 font-semibold">
                    この操作は取り消すことができません。
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    try {
                      await dbManager.init();
                      
                      // Clear tasks data
                      const db = (dbManager as any).db;
                      const transaction = db.transaction(['tasks'], 'readwrite');
                      const store = transaction.objectStore('tasks');
                      await store.clear();
                      
                      // Reset lastSync settings while keeping other settings
                      const currentSettings = await dbManager.getSettings();
                      const newSettings = {
                        ...currentSettings,
                        lastSyncAt: undefined,
                        lastSyncCursor: undefined,
                      };
                      await dbManager.saveSettings(newSettings);
                      
                      toast.success('データをクリアしました');
                      window.location.reload(); // Reload to reflect changes
                    } catch (error) {
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