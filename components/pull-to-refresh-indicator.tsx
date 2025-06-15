'use client';

import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshIndicatorProps {
  isVisible: boolean;
  isRefreshing: boolean;
  pullDistance: number;
}

function AnimatedBackground() {
  return (
    <div className="-skew-x-12 absolute inset-0 animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
  );
}

function RippleEffect() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="h-16 w-16 animate-ping rounded-full border-2 border-primary/30" />
      <div
        className="absolute h-12 w-12 animate-ping rounded-full border-2 border-primary/50"
        style={{ animationDelay: '0.2s' }}
      />
      <div
        className="absolute h-8 w-8 animate-ping rounded-full border-2 border-primary/70"
        style={{ animationDelay: '0.4s' }}
      />
    </div>
  );
}

function RefreshIcon({
  isRefreshing,
  shouldTrigger,
  progress,
}: {
  isRefreshing: boolean;
  shouldTrigger: boolean;
  progress: number;
}) {
  return (
    <div className="relative">
      <RefreshCw
        className={cn(
          'h-6 w-6 transition-all duration-300',
          isRefreshing &&
            'animate-spin text-primary drop-shadow-[0_0_12px_rgba(59,130,246,0.6)]',
          shouldTrigger &&
            !isRefreshing &&
            'scale-110 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]',
          !(shouldTrigger || isRefreshing) && 'scale-100',
        )}
        style={{
          transform: isRefreshing
            ? ''
            : `rotate(${progress * 360}deg) scale(${0.8 + progress * 0.4})`,
        }}
      />
      {/* Glow effect */}
      {(isRefreshing || shouldTrigger) && (
        <div className="absolute inset-0 h-6 w-6 animate-pulse rounded-full bg-primary/30 blur-md" />
      )}
    </div>
  );
}

export function PullToRefreshIndicator({
  isVisible,
  isRefreshing,
  pullDistance,
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / 80, 1);
  const shouldTrigger = pullDistance > 80;

  return (
    <div
      className={cn(
        'fixed top-0 right-0 left-0 z-40 flex items-center justify-center',
        'border-b bg-background/90 backdrop-blur-sm transition-all duration-300',
        isVisible ? 'translate-y-0' : '-translate-y-full',
        isRefreshing &&
          'bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5',
      )}
      style={{
        height: Math.min(pullDistance, 80),
        transform: `translateY(${isVisible ? 0 : -80}px)`,
      }}
    >
      {/* Animated background */}
      {isRefreshing && <AnimatedBackground />}

      {/* Ripple effect */}
      {isRefreshing && <RippleEffect />}

      <div
        className={cn(
          'relative z-10 flex items-center gap-3 text-muted-foreground',
          isRefreshing && 'animate-pulse',
        )}
      >
        <RefreshIcon
          isRefreshing={isRefreshing}
          shouldTrigger={shouldTrigger}
          progress={progress}
        />

        <div className="flex flex-col items-center">
          <span
            className={cn(
              'font-medium text-sm transition-all duration-300',
              isRefreshing && 'font-semibold text-primary',
              shouldTrigger && !isRefreshing && 'font-medium text-primary',
            )}
          >
            {isRefreshing
              ? '同期中...'
              : shouldTrigger
                ? '離して更新'
                : '下に引いて更新'}
          </span>

          {/* Progress bar */}
          <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full bg-gradient-to-r from-primary/50 to-primary transition-all duration-200',
                isRefreshing && 'animate-pulse',
              )}
              style={{
                width: `${progress * 100}%`,
                transform: shouldTrigger ? 'scaleX(1)' : 'scaleX(0.8)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
