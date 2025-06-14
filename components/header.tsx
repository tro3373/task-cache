"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Menu, RefreshCw, Filter, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SettingsMenu } from './settings-menu';

interface HeaderProps {
  onRefresh: () => void;
  onSearch: (query: string) => void;
  onFilterChange: (filter: 'all' | 'read' | 'stocked' | 'unread') => void;
  isRefreshing: boolean;
  totalTasks: number;
  unreadCount: number;
  currentFilter: string;
}

export function Header({ 
  onRefresh, 
  onSearch, 
  onFilterChange, 
  isRefreshing, 
  totalTasks, 
  unreadCount,
  currentFilter 
}: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch(value);
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              TaskCache
            </h1>
            {totalTasks > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {totalTasks}件
                </Badge>
                {unreadCount > 0 && (
                  <Badge className="text-xs">
                    未読 {unreadCount}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`hidden sm:flex relative overflow-hidden ${
                isRefreshing ? 'bg-primary/10 animate-pulse' : ''
              }`}
            >
              {isRefreshing && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-[shimmer_2s_infinite] -skew-x-12" />
              )}
              <RefreshCw className={`h-4 w-4 mr-2 transition-all duration-300 ${
                isRefreshing 
                  ? 'animate-spin text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' 
                  : 'hover:rotate-180'
              }`} />
              <span className={isRefreshing ? 'animate-pulse' : ''}>
                {isRefreshing ? '同期中...' : '更新'}
              </span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onRefresh} disabled={isRefreshing} className={isRefreshing ? 'bg-primary/5' : ''}>
                  <RefreshCw className={`h-4 w-4 mr-2 transition-all duration-300 ${
                    isRefreshing 
                      ? 'animate-spin text-primary drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]' 
                      : 'hover:rotate-180'
                  }`} />
                  <span className={isRefreshing ? 'animate-pulse' : ''}>
                    {isRefreshing ? '同期中...' : 'データ更新'}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onFilterChange('all')}>
                  <Filter className="h-4 w-4 mr-2" />
                  すべて
                  {currentFilter === 'all' && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onFilterChange('unread')}>
                  未読のみ
                  {currentFilter === 'unread' && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onFilterChange('stocked')}>
                  ストック済み
                  {currentFilter === 'stocked' && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onFilterChange('read')}>
                  既読済み
                  {currentFilter === 'read' && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  設定
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search Bar */}
        <div className="border-t px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="タスクを検索..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </header>

      <SettingsMenu open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}