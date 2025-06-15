'use client';

import { useCallback, useEffect, useState } from 'react';

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (window.scrollY > 0) {
        return;
      }

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      if (diff > 0 && diff < 150) {
        setCurrentY(diff);
        setIsPulling(true);
        e.preventDefault();
      }
    },
    [startY],
  );

  const handleTouchEnd = useCallback(async () => {
    if (isPulling && currentY > 80) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }

    setIsPulling(false);
    setCurrentY(0);
    setStartY(0);
  }, [isPulling, currentY, onRefresh]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, {
      passive: false,
    });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    isRefreshing,
    isPulling,
    pullDistance: currentY,
  };
}
