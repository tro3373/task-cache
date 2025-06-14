"use client";

import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  isVisible: boolean;
  isRefreshing: boolean;
  pullDistance: number;
}

export function PullToRefreshIndicator({ 
  isVisible, 
  isRefreshing, 
  pullDistance 
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / 80, 1);
  const shouldTrigger = pullDistance > 80;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-40 flex items-center justify-center",
        "bg-background/90 backdrop-blur-sm border-b transition-all duration-200",
        isVisible ? "translate-y-0" : "-translate-y-full"
      )}
      style={{
        height: Math.min(pullDistance, 80),
        transform: `translateY(${isVisible ? 0 : -80}px)`,
      }}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <RefreshCw 
          className={cn(
            "h-5 w-5 transition-all duration-200",
            isRefreshing && "animate-spin",
            shouldTrigger && !isRefreshing && "text-primary"
          )}
          style={{
            transform: isRefreshing ? '' : `rotate(${progress * 360}deg)`,
          }}
        />
        <span className="text-sm font-medium">
          {isRefreshing 
            ? '更新中...' 
            : shouldTrigger 
              ? '離して更新' 
              : '下に引いて更新'
          }
        </span>
      </div>
    </div>
  );
}