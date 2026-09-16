import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 45) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return 'Recently';
  }
}

export const formatTimeAgo = formatRelativeTime;

/**
 * Returns the active direct URL for the current server container.
 */
export function getDirectUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  const origin = window.location.origin;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return path.startsWith('http') ? path : `${origin}${cleanPath}`;
}

/**
 * Returns the public preview URL (ais-pre-*) if in AI Studio dev environment.
 * Guests scanning this link or QR code open the app directly with ZERO Google login prompt.
 */
export function getPreviewUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  let origin = window.location.origin;
  if (origin.includes('ais-dev-')) {
    origin = origin.replace('ais-dev-', 'ais-pre-');
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return path.startsWith('http') ? path : `${origin}${cleanPath}`;
}

/**
 * Shareable URL for guests: Uses the active live server origin to ensure immediate resolution without 404s.
 */
export function getShareableUrl(path: string): string {
  return getDirectUrl(path);
}

export function isDevContainerUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.origin.includes('ais-dev-');
}

export function getSessionId(): string {
  let sessionId = localStorage.getItem('momento_session_id');
  if (!sessionId) {
    sessionId = 'guest_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem('momento_session_id', sessionId);
  }
  return sessionId;
}

export function getGuestName(): string {
  return localStorage.getItem('momento_guest_name') || '';
}

export function setGuestName(name: string): void {
  if (name.trim()) {
    localStorage.setItem('momento_guest_name', name.trim());
  }
}
