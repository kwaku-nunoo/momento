/**
 * MOMENTO Service Worker & Network Connectivity Manager
 * Handles SW lifecycle, registration, offline event synchronization,
 * and connection quality diagnostics for venue scenarios.
 */

import { useState, useEffect } from 'react';

export interface CacheDiagnostics {
  version: string;
  shellAssetsCount: number;
  apiItemsCount: number;
  mediaItemsCount: number;
  runtimeChunksCount: number;
  timestamp: string;
}

export interface NetworkState {
  isOnline: boolean;
  effectiveType?: string; // '4g' | '3g' | '2g' | 'slow-2g'
  saveData?: boolean;
  isLowConnectivity: boolean;
  swRegistered: boolean;
  lastChecked?: string;
}

// Initial state: strictly relies on true browser online property, default to true
function getInitialOnlineStatus(): boolean {
  if (typeof navigator === 'undefined') return true;
  if (typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

// Global network listener state
let currentNetworkState: NetworkState = {
  isOnline: getInitialOnlineStatus(),
  effectiveType: (typeof navigator !== 'undefined' && (navigator as any)?.connection?.effectiveType) || '4g',
  saveData: (typeof navigator !== 'undefined' && (navigator as any)?.connection?.saveData) || false,
  isLowConnectivity: false,
  swRegistered: false,
  lastChecked: new Date().toISOString(),
};

const listeners = new Set<(state: NetworkState) => void>();

function notifyListeners() {
  listeners.forEach(fn => fn(currentNetworkState));
}

export async function checkActualConnectivity(): Promise<boolean> {
  if (typeof window === 'undefined') return true;
  
  // If navigator clearly reports offline, believe it immediately
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (currentNetworkState.isOnline) {
      currentNetworkState = {
        ...currentNetworkState,
        isOnline: false,
        isLowConnectivity: true,
        lastChecked: new Date().toISOString()
      };
      notifyListeners();
    }
    return false;
  }

  // Active ping to verify real server reachability
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch('/api/health', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const isConnected = response.ok || response.status < 500;
    if (currentNetworkState.isOnline !== isConnected) {
      currentNetworkState = {
        ...currentNetworkState,
        isOnline: isConnected,
        isLowConnectivity: !isConnected,
        lastChecked: new Date().toISOString()
      };
      notifyListeners();
    }
    return isConnected;
  } catch (error) {
    // If fetch failed completely due to lack of connection
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (currentNetworkState.isOnline) {
        currentNetworkState = {
          ...currentNetworkState,
          isOnline: false,
          isLowConnectivity: true,
          lastChecked: new Date().toISOString()
        };
        notifyListeners();
      }
      return false;
    }
    return currentNetworkState.isOnline;
  }
}

function updateNetworkState() {
  const isOnline = getInitialOnlineStatus();
  const conn = typeof navigator !== 'undefined' ? (navigator as any)?.connection : undefined;
  const effectiveType = conn?.effectiveType || (isOnline ? '4g' : 'none');
  const isLowConnectivity = !isOnline || effectiveType === '2g' || effectiveType === 'slow-2g';

  currentNetworkState = {
    ...currentNetworkState,
    isOnline,
    effectiveType,
    saveData: conn?.saveData || false,
    isLowConnectivity,
    lastChecked: new Date().toISOString()
  };

  notifyListeners();
}

// Register browser connectivity events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[MOMENTO Network] Connectivity restored: Online');
    updateNetworkState();
    checkActualConnectivity();
  });

  window.addEventListener('offline', () => {
    console.warn('[MOMENTO Network] Connectivity lost: Offline Mode Active');
    updateNetworkState();
  });

  if ((navigator as any)?.connection) {
    (navigator as any).connection.addEventListener('change', updateNetworkState);
  }

  // Trigger initial check without blocking
  setTimeout(() => {
    checkActualConnectivity();
  }, 1000);
}

/**
 * Registers the service worker with automatic update checks
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  // Only register on http(s) protocols
  if (!window.location.protocol.startsWith('http')) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    currentNetworkState.swRegistered = true;
    updateNetworkState();

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[MOMENTO SW] New application version cached & ready.');
          }
        });
      }
    });

    console.log('[MOMENTO SW] Service worker active with shell, API, & media caching.');
    return registration;
  } catch (error) {
    console.debug('[MOMENTO SW] Registration note:', error);
    return null;
  }
}

/**
 * Query cache diagnostics from the active service worker
 */
export async function getCacheDiagnostics(): Promise<CacheDiagnostics | null> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return null;
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      if (event.data && !event.data.error) {
        resolve(event.data as CacheDiagnostics);
      } else {
        resolve(null);
      }
    };

    navigator.serviceWorker.controller?.postMessage(
      { type: 'GET_CACHE_INFO' },
      [messageChannel.port2]
    );

    // 2 second timeout fallback
    setTimeout(() => resolve(null), 2000);
  });
}

/**
 * React hook to reactively subscribe to network status and low-connectivity venue conditions
 */
export function useNetworkStatus(): NetworkState {
  const [state, setState] = useState<NetworkState>(currentNetworkState);

  useEffect(() => {
    const handler = (newState: NetworkState) => setState(newState);
    listeners.add(handler);
    // Initial sync
    updateNetworkState();

    return () => {
      listeners.delete(handler);
    };
  }, []);

  return state;
}
