import React, { useState, useEffect, useRef } from 'react';
import { useNetworkStatus } from '../lib/sw-manager';
import { WifiOff, Wifi, X, RefreshCw, CheckCircle2, CloudOff } from 'lucide-react';

interface NetworkToastProps {
  queuedCount?: number;
}

export const NetworkToast: React.FC<NetworkToastProps> = ({ queuedCount = 0 }) => {
  const network = useNetworkStatus();
  const [toastType, setToastType] = useState<'offline' | 'online' | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const hasMountedRef = useRef(false);
  const prevOnlineRef = useRef(network.isOnline);

  useEffect(() => {
    // On initial mount, only set offline if the device is genuinely detected as offline
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      if (!network.isOnline) {
        setToastType('offline');
        setDismissed(false);
      }
      prevOnlineRef.current = network.isOnline;
      return;
    }

    // When connection transitions from ONLINE -> OFFLINE
    if (prevOnlineRef.current && !network.isOnline) {
      setToastType('offline');
      setDismissed(false);
    } 
    // When connection transitions from OFFLINE -> ONLINE
    else if (!prevOnlineRef.current && network.isOnline) {
      setToastType('online');
      setDismissed(false);
      
      // Auto-hide the "Back Online" toast after 4.5 seconds
      const timer = setTimeout(() => {
        setToastType(null);
      }, 4500);
      return () => clearTimeout(timer);
    }

    prevOnlineRef.current = network.isOnline;
  }, [network.isOnline]);

  if (!toastType || dismissed) {
    return null;
  }

  return (
    <div
      id="network-status-toast"
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] sm:w-auto animate-fade-in pointer-events-auto"
    >
      {toastType === 'offline' ? (
        /* Subtle Offline Notification */
        <div className="bg-[#1A1A1A]/95 dark:bg-[#1C1B24]/95 text-white backdrop-blur-md px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl border border-white/15 dark:border-white/10 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-500/30">
              <CloudOff className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white tracking-tight">Offline</span>
                {queuedCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/30 text-amber-300 text-[10px] font-semibold">
                    {queuedCount} queued
                  </span>
                )}
              </div>
              <p className="text-gray-300 dark:text-gray-300 text-[11px] leading-tight mt-0.5">
                Uploads will queue safely and sync automatically when back online.
              </p>
            </div>
          </div>

          <button
            id="btn-dismiss-offline-toast"
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss offline notice"
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Subtle Restored / Back Online Notification */
        <div className="bg-[#121E14]/95 dark:bg-[#102216]/95 text-white backdrop-blur-md px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl border border-emerald-500/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-emerald-300 tracking-tight">Back Online</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <p className="text-gray-300 text-[11px] leading-tight mt-0.5">
                Connection restored. Syncing any pending gallery uploads...
              </p>
            </div>
          </div>

          <button
            id="btn-dismiss-online-toast"
            type="button"
            onClick={() => {
              setDismissed(true);
              setToastType(null);
            }}
            aria-label="Dismiss online notice"
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
