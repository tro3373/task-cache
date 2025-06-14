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
        "bg-background/90 backdrop-blur-sm border-b transition-all duration-300",
        isVisible ? "translate-y-0" : "-translate-y-full",
        isRefreshing && "bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5"
      )}
      style={{
        height: Math.min(pullDistance, 80),
        transform: `translateY(${isVisible ? 0 : -80}px)`,
      }}
    >
      {/* Animated background */}
      {isRefreshing && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-[shimmer_2s_infinite] -skew-x-12" />
      )}
      
      {/* Ripple effect */}
      {isRefreshing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-2 border-primary/30 animate-ping" />
          <div className="absolute w-12 h-12 rounded-full border-2 border-primary/50 animate-ping" style={{ animationDelay: '0.2s' }} />
          <div className="absolute w-8 h-8 rounded-full border-2 border-primary/70 animate-ping" style={{ animationDelay: '0.4s' }} />
        </div>
      )}
      
      <div className={cn(
        "flex items-center gap-3 text-muted-foreground relative z-10",
        isRefreshing && "animate-pulse"
      )}>
        <div className="relative">
          <RefreshCw 
            className={cn(
              "h-6 w-6 transition-all duration-300",
              isRefreshing && "animate-spin text-primary drop-shadow-[0_0_12px_rgba(59,130,246,0.6)]",
              shouldTrigger && !isRefreshing && "text-primary scale-110 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]",
              !shouldTrigger && !isRefreshing && "scale-100"
            )}
            style={{
              transform: isRefreshing 
                ? '' 
                : `rotate(${progress * 360}deg) scale(${0.8 + progress * 0.4})`,
            }}
          />
          {/* Glow effect */}
          {(isRefreshing || shouldTrigger) && (
            <div className="absolute inset-0 h-6 w-6 rounded-full bg-primary/30 blur-md animate-pulse" />
          )}
        </div>
        
        <div className="flex flex-col items-center">
          <span className={cn(
            "text-sm font-medium transition-all duration-300",
            isRefreshing && "text-primary font-semibold",
            shouldTrigger && !isRefreshing && "text-primary font-medium"
          )}>
            {isRefreshing 
              ? '同期中...' 
              : shouldTrigger 
                ? '離して更新' 
                : '下に引いて更新'
            }
          </span>
          
          {/* Progress bar */}
          <div className="w-20 h-1 bg-muted rounded-full overflow-hidden mt-1">
            <div 
              className={cn(
                "h-full bg-gradient-to-r from-primary/50 to-primary transition-all duration-200",
                isRefreshing && "animate-pulse"
              )}
              style={{
                width: `${progress * 100}%`,
                transform: shouldTrigger ? 'scaleX(1)' : 'scaleX(0.8)'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}