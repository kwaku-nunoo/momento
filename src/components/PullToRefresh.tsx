import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, ArrowDown, Check, Sparkles } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<string | void>;
  disabled?: boolean;
  children: React.ReactNode;
}

type RefreshState = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'success';

const PULL_THRESHOLD = 70; // Pixel distance to trigger refresh
const MAX_PULL_DISTANCE = 110; // Maximum visual pull displacement

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  disabled = false,
  children,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshState, setRefreshState] = useState<RefreshState>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isTrackingRef = useRef(false);
  const isEligibleAtTopRef = useRef(false);
  const hasTriggeredHapticRef = useRef(false);

  // Damping function for natural elastic rubber-band feel
  const calculateDampedDistance = (rawDistance: number): number => {
    if (rawDistance <= 0) return 0;
    // Non-linear logarithmic/exponential resistance
    return Math.min(
      MAX_PULL_DISTANCE,
      Math.pow(rawDistance, 0.82) * 1.6
    );
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (disabled || refreshState === 'refreshing') return;

    // Only allow pull if currently at the very top of the page
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollTop <= 2) {
      isEligibleAtTopRef.current = true;
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      isTrackingRef.current = true;
      hasTriggeredHapticRef.current = false;
    } else {
      isEligibleAtTopRef.current = false;
      isTrackingRef.current = false;
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isTrackingRef.current || !isEligibleAtTopRef.current || disabled || refreshState === 'refreshing') {
      return;
    }

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - startYRef.current;
    const deltaX = currentX - startXRef.current;

    // If gesture is more horizontal than vertical, cancel pull-to-refresh to allow horizontal scrolls
    if (Math.abs(deltaX) > Math.abs(deltaY) && pullDistance === 0) {
      isTrackingRef.current = false;
      return;
    }

    // Only pull downwards
    if (deltaY > 0) {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollTop <= 2) {
        // Prevent native browser overscroll if user is dragging down
        if (e.cancelable && deltaY > 10) {
          e.preventDefault();
        }

        const damped = calculateDampedDistance(deltaY);
        setPullDistance(damped);

        if (damped >= PULL_THRESHOLD) {
          if (!hasTriggeredHapticRef.current) {
            hasTriggeredHapticRef.current = true;
            // Subtle mobile haptic feedback if supported
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try {
                navigator.vibrate(12);
              } catch {}
            }
          }
          setRefreshState('ready');
        } else {
          hasTriggeredHapticRef.current = false;
          setRefreshState('pulling');
        }
      }
    } else {
      setPullDistance(0);
      setRefreshState('idle');
    }
  };

  const handleTouchEnd = async () => {
    if (!isTrackingRef.current || disabled) return;
    isTrackingRef.current = false;

    if (refreshState === 'ready' || pullDistance >= PULL_THRESHOLD) {
      // Engage refreshing state
      setRefreshState('refreshing');
      setPullDistance(56); // Hold at indicator height

      try {
        const resultMessage = await onRefresh();
        setRefreshState('success');
        setStatusMessage(typeof resultMessage === 'string' && resultMessage ? resultMessage : 'Gallery up to date');
        
        // Hold success state briefly for clear feedback
        setTimeout(() => {
          setPullDistance(0);
          setRefreshState('idle');
          setStatusMessage('');
        }, 1100);
      } catch (err) {
        setPullDistance(0);
        setRefreshState('idle');
        setStatusMessage('');
      }
    } else {
      // Snap back smoothly to top
      setPullDistance(0);
      setRefreshState('idle');
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => handleTouchStart(e);
    const onTouchMove = (e: TouchEvent) => handleTouchMove(e);
    const onTouchEnd = () => handleTouchEnd();
    const onTouchCancel = () => handleTouchEnd();

    // Attach with { passive: false } to allow preventDefault on touchmove when pulling
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [disabled, refreshState, pullDistance, onRefresh]);

  // Pull progress ratio (0 to 1)
  const pullProgress = Math.min(1, pullDistance / PULL_THRESHOLD);
  const isVisible = pullDistance > 4 || refreshState === 'refreshing' || refreshState === 'success';

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Visual Pull-to-Refresh Floating Indicator Pill */}
      <div
        id="pull-to-refresh-indicator"
        aria-live="polite"
        role="status"
        className={`fixed top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-all duration-200 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 -translate-y-8'
        }`}
        style={{
          transform: `translate(-50%, ${Math.max(0, pullDistance - 14)}px)`,
          transition: isTrackingRef.current ? 'opacity 0.15s ease' : 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 dark:bg-[#06050A]/95 backdrop-blur-md shadow-md border border-black/5 dark:border-amber-500/20 text-xs font-semibold text-[#1A1A1A] dark:text-[#F3F1EC] select-none shadow-[0_8px_20px_rgba(0,0,0,0.8)]">
          {/* Animated Icon Container */}
          <div className="relative w-5 h-5 flex items-center justify-center">
            {refreshState === 'pulling' && (
              <ArrowDown
                className="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-150"
                style={{
                  transform: `rotate(${pullProgress * 180}deg)`
                }}
              />
            )}

            {refreshState === 'ready' && (
              <RefreshCw className="w-4 h-4 text-[#E67E22] transition-transform duration-200 rotate-180 animate-pulse" />
            )}

            {refreshState === 'refreshing' && (
              <RefreshCw className="w-4 h-4 text-[#E67E22] animate-spin" />
            )}

            {refreshState === 'success' && (
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5] animate-scale-in" />
            )}
          </div>

          {/* Dynamic Status Text */}
          <span className="text-[12px] font-medium tracking-tight">
            {refreshState === 'pulling' && 'Pull to refresh'}
            {refreshState === 'ready' && 'Release to load new moments'}
            {refreshState === 'refreshing' && 'Checking for new moments...'}
            {refreshState === 'success' && (statusMessage || 'Gallery up to date ✨')}
          </span>
        </div>
      </div>

      {/* Main Content with subtle natural spring pull offset */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${Math.min(pullDistance * 0.4, 45)}px)` : undefined,
          transition: isTrackingRef.current ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {children}
      </div>
    </div>
  );
};
