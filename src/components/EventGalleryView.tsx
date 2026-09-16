import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { MomentoEvent, MomentoPhoto, UploadItem } from '../types';
import { EventHeader } from './EventHeader';
import { PhotoGrid } from './PhotoGrid';
import { PhotoViewer } from './PhotoViewer';
import { SlideshowViewer } from './SlideshowViewer';
import { UploadQueue } from './UploadQueue';
import { ShareModal } from './ShareModal';
import { HostDashboard } from './HostDashboard';
import { GallerySkeleton } from './GallerySkeleton';
import { NetworkToast } from './NetworkToast';
import { PullToRefresh } from './PullToRefresh';
import { getSessionId, getGuestName, setGuestName, formatFileSize } from '../lib/utils';
import { useNetworkStatus } from '../lib/sw-manager';
import { Plus, Camera, Sparkles, AlertCircle, RefreshCw, AlertTriangle, WifiOff, Wifi, X, CheckCircle2, UploadCloud, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

interface EventGalleryViewProps {
  eventCode: string;
  initialHostKey?: string;
  initialPhotoId?: string;
  onGoHome: () => void;
}

export const EventGalleryView: React.FC<EventGalleryViewProps> = ({
  eventCode,
  initialHostKey,
  initialPhotoId,
  onGoHome
}) => {
  const networkStatus = useNetworkStatus();
  const [event, setEvent] = useState<Omit<MomentoEvent, 'hostKey'> | null>(null);
  const [hostEvent, setHostEvent] = useState<MomentoEvent | null>(null);
  const [photos, setPhotos] = useState<MomentoPhoto[]>([]);
  const [stats, setStats] = useState({ photoCount: 0, contributorCount: 0, totalSizeBytes: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [showOnlineToast, setShowOnlineToast] = useState(false);
  const [uploadErrorBannerDismissed, setUploadErrorBannerDismissed] = useState(false);
  const [uploadsClosedNotice, setUploadsClosedNotice] = useState(false);
  
  // UI Modals & Drawers
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showHostDashboard, setShowHostDashboard] = useState(false);
  const [hostKey, setHostKey] = useState<string>(initialHostKey || '');
  const [isHost, setIsHost] = useState(false);

  // Upload Management
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [uploaderName, setUploaderNameState] = useState<string>(getGuestName());
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingFilesToUpload, setPendingFilesToUpload] = useState<File[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showRecentUploadSuccess, setShowRecentUploadSuccess] = useState(false);
  const prevUploadingRef = useRef(false);

  // Active upload calculations for file input progress bar and pulsing animation
  const uploadingItems = uploadQueue.filter(i => i.status === 'uploading' || i.status === 'queued');
  const isUploading = uploadingItems.length > 0;
  const overallUploadProgress = isUploading
    ? Math.round(
        uploadingItems.reduce(
          (sum, item) => sum + (item.status === 'queued' ? 5 : (item.progress || 0)),
          0
        ) / uploadingItems.length
      )
    : 0;

  // Track upload completion to provide a brief celebratory success state
  useEffect(() => {
    if (prevUploadingRef.current && !isUploading && uploadQueue.some(i => i.status === 'completed')) {
      setShowRecentUploadSuccess(true);
      const timer = setTimeout(() => {
        setShowRecentUploadSuccess(false);
      }, 2600);
      return () => clearTimeout(timer);
    }
    prevUploadingRef.current = isUploading;
  }, [isUploading, uploadQueue]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const sessionId = getSessionId();

  // Ensure current browser address bar reflects this specific event URL (/e/:code)
  useEffect(() => {
    if (eventCode && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith(`/e/${eventCode}`) && !currentPath.startsWith(`/join/${eventCode}`)) {
        const queryParams = new URLSearchParams(window.location.search);
        const searchStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
        window.history.replaceState({}, '', `/e/${eventCode}${searchStr}`);
      }
    }
  }, [eventCode]);

  // Check stored host keys for this event
  useEffect(() => {
    try {
      const storedHostEvents = JSON.parse(localStorage.getItem('momento_host_events') || '[]');
      const match = storedHostEvents.find((h: any) => h.code.toLowerCase() === eventCode.toLowerCase());
      if (match && match.hostKey) {
        setHostKey(match.hostKey);
        setIsHost(true);
      } else if (initialHostKey) {
        setHostKey(initialHostKey);
        setIsHost(true);
      }
    } catch (e) {}
  }, [eventCode, initialHostKey]);

  // Fetch Event Data with Service Worker Cache & LocalStorage Fallback
  const fetchEventData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      let fromCache = false;
      const res = await fetch(`/api/events/by-code/${encodeURIComponent(eventCode)}`);
      
      if (res.headers.get('X-Momento-Offline-Cache') === 'true') {
        fromCache = true;
      }

      if (!res.ok) {
        // Try local storage cache fallback
        const localCache = localStorage.getItem(`momento_cached_event_${eventCode}`);
        if (localCache) {
          const parsed = JSON.parse(localCache);
          setEvent(parsed.event);
          setPhotos(parsed.photos || []);
          setStats({
            photoCount: parsed.stats?.photoCount || parsed.photos?.length || 0,
            contributorCount: parsed.stats?.contributorCount || 0,
            totalSizeBytes: (parsed.photos || []).reduce((sum: number, p: MomentoPhoto) => sum + (p.fileSize || 0), 0)
          });
          setIsOfflineCached(true);
          return;
        }

        if (res.status === 404) {
          throw new Error('Event not found. Please check the code or link.');
        }
        throw new Error('Failed to load event gallery.');
      }

      const data = await res.json();
      setEvent(data.event);
      setPhotos(data.photos || []);
      setStats({
        photoCount: data.stats.photoCount,
        contributorCount: data.stats.contributorCount,
        totalSizeBytes: (data.photos || []).reduce((sum: number, p: MomentoPhoto) => sum + (p.fileSize || 0), 0)
      });
      setIsOfflineCached(fromCache);

      // Cache to local backup for instant subsequent renders
      try {
        localStorage.setItem(`momento_cached_event_${eventCode}`, JSON.stringify(data));
      } catch (e) {}

      // Save to visited events in localStorage
      try {
        const visited = JSON.parse(localStorage.getItem('momento_visited_events') || '[]');
        const filtered = visited.filter((v: any) => v.code !== data.event.code);
        filtered.unshift({
          code: data.event.code,
          name: data.event.name,
          visitedAt: new Date().toISOString()
        });
        localStorage.setItem('momento_visited_events', JSON.stringify(filtered.slice(0, 15)));
      } catch (e) {}

      // If host key is present, also fetch host details
      if (hostKey) {
        try {
          const hostRes = await fetch(`/api/events/${data.event.id}/host`, {
            headers: { 'x-host-key': hostKey }
          });
          if (hostRes.ok) {
            const hostData = await hostRes.json();
            setHostEvent(hostData.event);
            setIsHost(true);
          }
        } catch (hErr) {}
      }
    } catch (err: any) {
      // Offline fallback: check local storage
      try {
        const localCache = localStorage.getItem(`momento_cached_event_${eventCode}`);
        if (localCache) {
          const parsed = JSON.parse(localCache);
          setEvent(parsed.event);
          setPhotos(parsed.photos || []);
          setStats({
            photoCount: parsed.stats?.photoCount || parsed.photos?.length || 0,
            contributorCount: parsed.stats?.contributorCount || 0,
            totalSizeBytes: (parsed.photos || []).reduce((sum: number, p: MomentoPhoto) => sum + (p.fileSize || 0), 0)
          });
          setIsOfflineCached(true);
          setError('');
          return;
        }
      } catch (e) {}

      setError(err.message || 'Error loading event');
    } finally {
      setLoading(false);
    }
  }, [eventCode, hostKey]);

  useEffect(() => {
    fetchEventData();
  }, [fetchEventData]);

  // Fetch metadata ONLY for new photos uploaded since a given timestamp
  const fetchNewPhotosDelta = useCallback(async (sinceIso?: string): Promise<number> => {
    if (!eventCode) return 0;
    try {
      const url = sinceIso 
        ? `/api/events/${encodeURIComponent(eventCode)}/photos/delta?since=${encodeURIComponent(sinceIso)}`
        : `/api/events/${encodeURIComponent(eventCode)}/photos/delta`;
      const res = await fetch(url);
      if (!res.ok) return 0;
      const data = await res.json();
      const newPhotos: MomentoPhoto[] = data.photos || [];
      if (newPhotos.length > 0) {
        let addedCount = 0;
        setPhotos(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const fresh = newPhotos.filter(p => !existingIds.has(p.id));
          addedCount = fresh.length;
          if (fresh.length === 0) return prev;
          const merged = [...fresh, ...prev];
          try {
            const cached = localStorage.getItem(`momento_cached_event_${eventCode}`);
            if (cached) {
              const parsed = JSON.parse(cached);
              parsed.photos = merged;
              parsed.stats = {
                ...parsed.stats,
                photoCount: merged.length,
                contributorCount: new Set(merged.map(p => p.uploaderSessionId)).size,
                totalSizeBytes: merged.reduce((acc, p) => acc + (p.fileSize || 0), 0)
              };
              localStorage.setItem(`momento_cached_event_${eventCode}`, JSON.stringify(parsed));
            }
          } catch {}
          return merged;
        });

        if (addedCount > 0) {
          setStats(prev => ({
            ...prev,
            photoCount: prev.photoCount + addedCount
          }));
        }
        return addedCount;
      }
      return 0;
    } catch (err) {
      console.debug('[MOMENTO REALTIME DELTA] Failed delta fetch:', err);
      return 0;
    }
  }, [eventCode]);

  // Pull-to-refresh handler for gesture to check for and load moments from other guests
  const handlePullToRefresh = useCallback(async (): Promise<string> => {
    try {
      const newestIso = photos.length > 0 ? photos[0]?.createdAt : undefined;
      const newCount = await fetchNewPhotosDelta(newestIso);

      // Also refresh event details & photo stats
      try {
        const res = await fetch(`/api/events/by-code/${encodeURIComponent(eventCode)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.event) {
            setEvent(data.event);
          }
          if (data.stats) {
            setStats({
              photoCount: data.stats.photoCount,
              contributorCount: data.stats.contributorCount,
              totalSizeBytes: (data.photos || []).reduce((sum: number, p: MomentoPhoto) => sum + (p.fileSize || 0), 0)
            });
          }
          if (photos.length === 0 && data.photos && data.photos.length > 0) {
            setPhotos(data.photos);
            return `${data.photos.length} new moment${data.photos.length > 1 ? 's' : ''} loaded! ✨`;
          }
        }
      } catch {}

      if (newCount > 0) {
        return `Found ${newCount} new moment${newCount > 1 ? 's' : ''}! ✨`;
      }
      return 'Gallery is up to date ✨';
    } catch (err) {
      return 'Gallery refreshed';
    }
  }, [eventCode, photos, fetchNewPhotosDelta]);

  // Auto-sync queued items when connection is restored
  const prevOnlineRef = useRef(networkStatus.isOnline);
  useEffect(() => {
    if (!prevOnlineRef.current && networkStatus.isOnline) {
      setShowOnlineToast(true);
      setTimeout(() => setShowOnlineToast(false), 4500);

      // Auto-retry queued or offline-failed items
      setUploadQueue(prev => {
        const itemsToUpload = prev.filter(i => i.status === 'queued' || (i.status === 'failed' && i.error?.includes('Offline')));
        if (itemsToUpload.length > 0) {
          console.log(`[MOMENTO AUTO-SYNC] Connection restored. Syncing ${itemsToUpload.length} queued upload(s)...`);
          setTimeout(() => {
            itemsToUpload.forEach(item => uploadSingleItem(item, uploaderName));
          }, 300);
        }
        return prev;
      });

      // Instead of downloading full list, only fetch new photos uploaded while offline
      if (photos.length > 0 && photos[0]?.createdAt) {
        fetchNewPhotosDelta(photos[0].createdAt);
      } else {
        fetchEventData();
      }
    }
    prevOnlineRef.current = networkStatus.isOnline;
  }, [networkStatus.isOnline, fetchEventData, fetchNewPhotosDelta, uploaderName, photos]);

  // Real-time updates via Server-Sent Events (SSE)
  useEffect(() => {
    if (!eventCode) return;

    try {
      const source = new EventSource(`/api/events/${encodeURIComponent(eventCode)}/stream`);
      sseRef.current = source;

      source.onmessage = async (e) => {
        try {
          const payload = JSON.parse(e.data);
          
          if (payload.type === 'PHOTOS_ADDED') {
            // Received metadata directly in payload for newly uploaded photos only
            const newPhotos: MomentoPhoto[] = payload.data?.photos || [];
            if (newPhotos.length > 0) {
              setPhotos(prev => {
                const existingIds = new Set(prev.map(p => p.id));
                const fresh = newPhotos.filter(p => !existingIds.has(p.id));
                if (fresh.length === 0) return prev;
                const merged = [...fresh, ...prev];
                try {
                  const cached = localStorage.getItem(`momento_cached_event_${eventCode}`);
                  if (cached) {
                    const parsed = JSON.parse(cached);
                    parsed.photos = merged;
                    parsed.stats = {
                      ...parsed.stats,
                      photoCount: merged.length,
                      contributorCount: new Set(merged.map(p => p.uploaderSessionId)).size,
                      totalSizeBytes: merged.reduce((acc, p) => acc + (p.fileSize || 0), 0)
                    };
                    localStorage.setItem(`momento_cached_event_${eventCode}`, JSON.stringify(parsed));
                  }
                } catch {}
                return merged;
              });
              setStats(prev => ({
                ...prev,
                photoCount: prev.photoCount + newPhotos.length
              }));
            }
          } else if (payload.type === 'NEW_PHOTO_AVAILABLE' || payload.type === 'PHOTO_ADDED_ID') {
            // Lightweight notification with ID only: Fetch metadata for ONLY this single new photo
            const photoId = payload.data?.photoId || (Array.isArray(payload.data?.photoIds) ? payload.data.photoIds[0] : null);
            if (photoId) {
              try {
                const metaRes = await fetch(`/api/events/${encodeURIComponent(eventCode)}/photos/${photoId}/metadata`);
                if (metaRes.ok) {
                  const metaData = await metaRes.json();
                  const singlePhoto: MomentoPhoto = metaData.photo;
                  if (singlePhoto) {
                    setPhotos(prev => {
                      if (prev.some(p => p.id === singlePhoto.id)) return prev;
                      return [singlePhoto, ...prev];
                    });
                    setStats(prev => ({
                      ...prev,
                      photoCount: prev.photoCount + 1
                    }));
                  }
                }
              } catch (metaErr) {
                console.debug('[MOMENTO SSE METADATA FETCH ERROR]', metaErr);
              }
            }
          } else if (payload.type === 'PHOTO_DELETED') {
            const deletedId = payload.data.photoId;
            setPhotos(prev => prev.filter(p => p.id !== deletedId));
            setStats(prev => ({
              ...prev,
              photoCount: Math.max(0, prev.photoCount - 1)
            }));
          } else if (payload.type === 'PHOTOS_CLEARED' || payload.type === 'GALLERY_CLEARED') {
            setPhotos([]);
            setStats({
              photoCount: 0,
              contributorCount: 0,
              totalSizeBytes: 0
            });
            setSelectedPhotoIndex(null);
          } else if (payload.type === 'EVENT_UPDATED') {
            setEvent(prev => prev ? { ...prev, ...payload.data } : null);
          }
        } catch (parseErr) {}
      };

      source.onerror = () => {
        // SSE will reconnect automatically
      };

      return () => {
        source.close();
      };
    } catch (sseErr) {}
  }, [eventCode]);

  // Upload handler: processes files in batch with individual progress tracking
  const startUploadingFiles = async (files: File[], nameOverride?: string) => {
    if (!event) {
      console.error('[MOMENTO UPLOAD] Cannot upload: Event not loaded.');
      return;
    }

    if (event.isArchived || !event.allowUploads) {
      console.warn('[MOMENTO UPLOAD] Cannot upload: Event uploads are closed or archived.');
      setUploadsClosedNotice(true);
      setTimeout(() => setUploadsClosedNotice(false), 4500);
      return;
    }

    const currentName = nameOverride !== undefined ? nameOverride : uploaderName;
    console.log(`[MOMENTO UPLOAD] Starting batch upload of ${files.length} file(s) for event "${event.code}" (ID: ${event.id}) by "${currentName || 'Anonymous'}"`);

    // Reset error banner dismissed state for new batch
    setUploadErrorBannerDismissed(false);

    // Create queued items with client-side constraint validation
    const newItems: UploadItem[] = files.map(file => {
      let initialStatus: UploadItem['status'] = 'queued';
      let preflightError: string | undefined;

      // Constraint 1: Maximum file size limit (100MB)
      const MAX_SIZE_BYTES = 100 * 1024 * 1024;
      if (file.size > MAX_SIZE_BYTES) {
        initialStatus = 'failed';
        preflightError = `File exceeds 100MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
        console.error(`[MOMENTO UPLOAD CONSTRAINT] File "${file.name}" rejected: Exceeds 100MB max limit.`);
      }

      // Constraint 2: 0-byte or corrupted file check
      if (file.size === 0) {
        initialStatus = 'failed';
        preflightError = 'Empty or 0-byte file cannot be uploaded';
        console.error(`[MOMENTO UPLOAD CONSTRAINT] File "${file.name}" rejected: 0 bytes.`);
      }

      // Constraint 3: Network connectivity check - queue instead of hard failing
      const isOffline = (typeof navigator !== 'undefined' && !navigator.onLine) || !networkStatus.isOnline;
      if (isOffline && initialStatus !== 'failed') {
        initialStatus = 'queued';
        console.log(`[MOMENTO UPLOAD CONSTRAINT] Offline venue mode: Queued "${file.name}" for auto-sync.`);
      }

      return {
        id: Math.random().toString(36).substring(2, 9),
        file,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        status: initialStatus,
        error: preflightError,
        failedAt: preflightError ? new Date().toISOString() : undefined
      };
    });

    setUploadQueue(prev => [...newItems, ...prev]);

    // Upload queued files that passed preflight checks if online
    if (networkStatus.isOnline) {
      for (const item of newItems) {
        if (item.status === 'queued') {
          uploadSingleItem(item, currentName);
        }
      }
    }
  };

  const uploadSingleItem = async (item: UploadItem, name?: string) => {
    if (!event) {
      console.error('[MOMENTO UPLOAD] Cannot upload single item: Event state is null.');
      return;
    }

    console.log(`[MOMENTO UPLOAD ITEM] Dispatching file "${item.file.name}" (${formatFileSize(item.file.size)}, type: "${item.file.type || 'unknown'}")`);

    // Check offline constraint before initiating request - hold in queue
    if ((typeof navigator !== 'undefined' && !navigator.onLine) || !networkStatus.isOnline) {
      console.warn(`[MOMENTO UPLOAD ITEM] Holding "${item.file.name}" in queue: Venue is offline.`);
      setUploadQueue(prev =>
        prev.map(i => i.id === item.id ? {
          ...i,
          status: 'queued',
          error: undefined,
          progress: 0
        } : i)
      );
      return;
    }

    setUploadQueue(prev =>
      prev.map(i => i.id === item.id ? { ...i, status: 'uploading', progress: 15, error: undefined } : i)
    );

    const formData = new FormData();
    formData.append('photos', item.file);
    formData.append('uploaderSessionId', sessionId);
    if (name) {
      formData.append('uploaderName', name);
    }

    try {
      const xhr = new XMLHttpRequest();
      const targetUrl = `/api/events/${encodeURIComponent(event.code || event.id || eventCode)}/photos`;
      xhr.open('POST', targetUrl);
      
      // 90 second timeout for large RAW / untouched files
      xhr.timeout = 90000;

      xhr.upload.onprogress = (progressEvent) => {
        if (progressEvent.lengthComputable) {
          const percent = Math.round((progressEvent.loaded / progressEvent.total) * 90);
          console.log(`[MOMENTO UPLOAD PROGRESS] "${item.file.name}": ${percent}% (${formatFileSize(progressEvent.loaded)} / ${formatFileSize(progressEvent.total)})`);
          setUploadQueue(prev =>
            prev.map(i => i.id === item.id ? { ...i, progress: percent } : i)
          );
        }
      };

      xhr.onload = () => {
        console.log(`[MOMENTO UPLOAD RESPONSE] "${item.file.name}" HTTP ${xhr.status} ${xhr.statusText}`);
        
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            const uploadedPhoto = response.photos?.[0];
            console.log(`[MOMENTO UPLOAD SUCCESS] "${item.file.name}" saved successfully:`, uploadedPhoto);

            setUploadQueue(prev =>
              prev.map(i => i.id === item.id ? { ...i, status: 'completed', progress: 100, photo: uploadedPhoto } : i)
            );

            // Prepend photo directly to state
            if (uploadedPhoto) {
              setPhotos(prev => {
                if (prev.some(p => p.id === uploadedPhoto.id)) return prev;
                return [uploadedPhoto, ...prev];
              });
              setStats(prev => ({
                ...prev,
                photoCount: prev.photoCount + 1
              }));
            }

            // Trigger mini confetti celebratory burst
            try {
              confetti({
                particleCount: 25,
                spread: 45,
                origin: { y: 0.9 }
              });
            } catch (e) {}

          } catch (jsonErr) {
            console.warn(`[MOMENTO UPLOAD JSON PARSE WARN] Could not parse response for "${item.file.name}":`, jsonErr);
            setUploadQueue(prev =>
              prev.map(i => i.id === item.id ? { ...i, status: 'completed', progress: 100 } : i)
            );
          }
        } else {
          let errorMsg = `Upload failed with HTTP ${xhr.status}`;
          try {
            const res = JSON.parse(xhr.responseText);
            if (res.error) errorMsg = res.error;
          } catch (e) {
            if (xhr.status === 413) {
              errorMsg = 'File exceeds server size limit (100MB)';
            } else if (xhr.status === 403) {
              errorMsg = 'Uploads are disabled or event is closed';
            } else if (xhr.status === 404) {
              errorMsg = 'Event not found on server';
            } else if (xhr.status >= 500) {
              errorMsg = `Server error during image processing (HTTP ${xhr.status})`;
            }
          }

          console.error(`[MOMENTO UPLOAD FAILED] "${item.file.name}": ${errorMsg} (HTTP ${xhr.status})`, xhr.responseText);

          setUploadQueue(prev =>
            prev.map(i => i.id === item.id ? {
              ...i,
              status: 'failed',
              error: errorMsg,
              httpStatus: xhr.status,
              failedAt: new Date().toISOString()
            } : i)
          );
        }
      };

      xhr.onerror = () => {
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        const errorMsg = isOnline 
          ? 'Network connection error (Failed to reach server)' 
          : 'Offline: Internet connection lost during upload';
        
        console.error(`[MOMENTO UPLOAD NETWORK ERROR] "${item.file.name}": ${errorMsg}`, { isOnline });

        setUploadQueue(prev =>
          prev.map(i => i.id === item.id ? {
            ...i,
            status: 'failed',
            error: errorMsg,
            httpStatus: 0,
            failedAt: new Date().toISOString()
          } : i)
        );
      };

      xhr.ontimeout = () => {
        const errorMsg = 'Upload timed out after 90 seconds. Please check your connection.';
        console.error(`[MOMENTO UPLOAD TIMEOUT] "${item.file.name}": Request timed out.`);

        setUploadQueue(prev =>
          prev.map(i => i.id === item.id ? {
            ...i,
            status: 'failed',
            error: errorMsg,
            httpStatus: 408,
            failedAt: new Date().toISOString()
          } : i)
        );
      };

      xhr.onabort = () => {
        console.warn(`[MOMENTO UPLOAD ABORTED] "${item.file.name}": Request was cancelled.`);
        setUploadQueue(prev =>
          prev.map(i => i.id === item.id ? {
            ...i,
            status: 'failed',
            error: 'Upload was cancelled',
            failedAt: new Date().toISOString()
          } : i)
        );
      };

      xhr.send(formData);
    } catch (err: any) {
      console.error(`[MOMENTO UPLOAD EXCEPTION] Exception thrown while uploading "${item.file.name}":`, err);
      setUploadQueue(prev =>
        prev.map(i => i.id === item.id ? {
          ...i,
          status: 'failed',
          error: err.message || 'Unexpected upload error',
          failedAt: new Date().toISOString()
        } : i)
      );
    }
  };

  const handleRetryUpload = (itemId: string) => {
    const item = uploadQueue.find(i => i.id === itemId);
    if (item) {
      console.log(`[MOMENTO UPLOAD RETRY] Retrying single item: "${item.file.name}" (ID: ${item.id})`);
      uploadSingleItem(item, uploaderName);
    }
  };

  const handleRetryAllUploads = () => {
    const failed = uploadQueue.filter(i => i.status === 'failed');
    console.log(`[MOMENTO UPLOAD RETRY ALL] Retrying ${failed.length} failed upload(s).`);
    for (const item of failed) {
      uploadSingleItem(item, uploaderName);
    }
  };

  const handleDismissUploadItem = (itemId: string) => {
    setUploadQueue(prev => prev.filter(i => i.id !== itemId));
  };

  const handleClearCompletedUploads = () => {
    setUploadQueue(prev => prev.filter(i => i.status !== 'completed'));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    // Check if guest has a name set, if not ask optionally once
    if (!uploaderName && !localStorage.getItem('momento_name_prompted')) {
      setPendingFilesToUpload(files);
      setShowNameModal(true);
      localStorage.setItem('momento_name_prompted', 'true');
    } else {
      startUploadingFiles(files);
    }

    e.target.value = '';
  };

  const handleConfirmNameAndUpload = (name: string) => {
    setGuestName(name);
    setUploaderNameState(name);
    setShowNameModal(false);
    if (pendingFilesToUpload.length > 0) {
      startUploadingFiles(pendingFilesToUpload, name);
      setPendingFilesToUpload([]);
    }
  };

  const handleSkipNameAndUpload = () => {
    setShowNameModal(false);
    if (pendingFilesToUpload.length > 0) {
      startUploadingFiles(pendingFilesToUpload, '');
      setPendingFilesToUpload([]);
    }
  };

  // Drag and drop multi-file upload support
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const droppedFiles: File[] = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    const files = droppedFiles.filter(f => 
      f.type.startsWith('image/') || 
      f.name.match(/\.(jpe?g|png|webp|heic|heif|avif|gif|bmp|tiff|raw|dng)$/i)
    );
    if (files.length > 0) {
      startUploadingFiles(files);
    }
  };

  // Delete Photo
  const handleDeletePhoto = async (photoId: string) => {
    if (!event) return;
    const res = await fetch(`/api/events/${event.id}/photos/${photoId}`, {
      method: 'DELETE',
      headers: {
        'x-host-key': hostKey,
        'x-session-id': sessionId
      }
    });

    if (!res.ok) {
      throw new Error('Failed to delete photo');
    }

    setPhotos(prev => prev.filter(p => p.id !== photoId));
    setStats(prev => ({
      ...prev,
      photoCount: Math.max(0, prev.photoCount - 1)
    }));
  };

  // Clear all images from current event's gallery (Host Only)
  const handleClearAllPhotos = async () => {
    if (!event || !hostKey) return;
    const res = await fetch(`/api/events/${event.id}/clear-photos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-host-key': hostKey
      }
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to clear gallery photos');
    }

    setPhotos([]);
    setStats({
      photoCount: 0,
      contributorCount: 0,
      totalSizeBytes: 0
    });
    setSelectedPhotoIndex(null);

    try {
      localStorage.removeItem(`momento_cached_event_${event.code}`);
    } catch {}
  };

  // Update Event Settings
  const handleUpdateEvent = async (updates: Partial<MomentoEvent>) => {
    if (!event || !hostKey) return;
    const res = await fetch(`/api/events/${event.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-host-key': hostKey
      },
      body: JSON.stringify(updates)
    });

    if (!res.ok) {
      throw new Error('Failed to update settings');
    }

    const data = await res.json();
    setEvent(data.event);
    setHostEvent(data.event);
  };

  // Open & Close Photo in Lightbox with URL sync
  const handleOpenPhoto = (index: number) => {
    setSelectedPhotoIndex(index);
    const photo = photos[index];
    if (photo && event) {
      const url = `/e/${event.code}/photo/${photo.id}${hostKey ? `?key=${encodeURIComponent(hostKey)}` : ''}`;
      window.history.replaceState({}, '', url);
    }
  };

  const handleClosePhoto = () => {
    setSelectedPhotoIndex(null);
    if (event) {
      const url = `/e/${event.code}${hostKey ? `?key=${encodeURIComponent(hostKey)}` : ''}`;
      window.history.replaceState({}, '', url);
    }
  };

  // Deep-link initialPhotoId auto-selection
  useEffect(() => {
    if (initialPhotoId && photos.length > 0 && selectedPhotoIndex === null) {
      const matchIdx = photos.findIndex(p => p.id === initialPhotoId);
      if (matchIdx !== -1) {
        setSelectedPhotoIndex(matchIdx);
      }
    }
  }, [initialPhotoId, photos]);

  // In-place retry for the current event page
  const handleRetry = async () => {
    setIsRetrying(true);
    if (typeof window !== 'undefined') {
      const searchStr = window.location.search || (hostKey ? `?key=${encodeURIComponent(hostKey)}` : '');
      window.history.replaceState({}, '', `/e/${eventCode}${searchStr}`);
    }
    await fetchEventData();
    setIsRetrying(false);
  };

  // Full browser reload strictly preserving the current event path
  const handleFullPageRefresh = () => {
    if (typeof window !== 'undefined') {
      const searchStr = window.location.search || (hostKey ? `?key=${encodeURIComponent(hostKey)}` : '');
      window.history.replaceState({}, '', `/e/${eventCode}${searchStr}`);
      window.location.reload();
    }
  };

  if (loading) {
    return <GallerySkeleton />;
  }

  if (error || !event) {
    return (
      <div id="error-gallery-state" className="min-h-screen bg-[#F5F2ED] dark:bg-[#020104] text-[#1A1A1A] dark:text-[#F3F1EC] flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 border border-amber-200/60 dark:border-amber-700/40">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-1 font-display">
          Event Not Loaded Yet
        </h2>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
          {error || `Unable to load event "${eventCode}". Tap refresh to reconnect to the gallery.`}
        </p>
        <div className="flex flex-col gap-2.5 w-full max-w-xs">
          <button
            id="btn-retry-fetch-event"
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full px-6 py-3.5 rounded-2xl bg-[#1A1A1A] dark:bg-white dark:text-black text-white text-xs font-semibold hover:bg-black dark:hover:bg-gray-100 active:scale-[0.98] transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Refreshing Event...' : 'Refresh This Page'}</span>
          </button>
          
          <button
            id="btn-reload-full-page"
            type="button"
            onClick={handleFullPageRefresh}
            className="w-full px-6 py-3 rounded-2xl bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/10 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
          >
            Hard Reload Browser
          </button>

          <button
            id="btn-return-home-error"
            type="button"
            onClick={onGoHome}
            className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline underline-offset-4 mt-2 transition-colors cursor-pointer"
          >
            Or return to MOMENTO home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="event-gallery-container"
      className="min-h-screen bg-[#F5F2ED] dark:bg-transparent text-[#1A1A1A] dark:text-[#F3F1EC] flex flex-col selection:bg-[#E67E22]/20 selection:text-[#E67E22] transition-colors duration-200"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden Native File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,image/heic,image/heif,image/avif,.heic,.heif,.jpg,.jpeg,.png,.webp,.gif,.bmp,.dng,.raw,.cr2,.nef"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png"
        capture="environment"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-[#1A1A1A]/85 backdrop-blur-md flex flex-col items-center justify-center text-white pointer-events-none p-6 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-3xl bg-[#E67E22] flex items-center justify-center mb-4 shadow-xl animate-bounce">
            <Plus className="w-10 h-10 text-white stroke-[3]" />
          </div>
          <h3 className="text-2xl font-bold font-display mb-1">Drop your moments here</h3>
          <p className="text-sm text-gray-300">Untouched originals will be saved directly to the gallery.</p>
        </div>
      )}

      {/* Subtle Universal Top Edge Progress Bar for Upload Feedback */}
      {isUploading && (
        <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-black/10 dark:bg-white/10 overflow-hidden pointer-events-none">
          <div
            className="h-full bg-gradient-to-r from-[#E67E22] via-amber-400 to-[#E67E22] transition-all duration-300 ease-out shadow-[0_0_10px_#E67E22] animate-upload-shimmer"
            style={{ width: `${Math.max(overallUploadProgress, 6)}%` }}
          />
        </div>
      )}

      {/* Minimal Sticky Header */}
      <EventHeader
        event={event}
        photoCount={photos.length}
        contributorCount={stats.contributorCount}
        onOpenShare={() => setShowShareModal(true)}
        onOpenHost={isHost ? () => setShowHostDashboard(true) : undefined}
        onOpenSlideshow={photos.length > 0 ? () => setShowSlideshow(true) : undefined}
        isHost={isHost}
        onGoHome={onGoHome}
      />

      {/* Subtle Network Status Toast Notification */}
      <NetworkToast queuedCount={uploadQueue.filter(i => i.status === 'queued').length} />

      {/* Notice when uploads are locked/closed */}
      {uploadsClosedNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1C1A27] dark:bg-[#0C0B12] border border-amber-500/30 text-amber-300 px-5 py-3 rounded-2xl shadow-2xl text-xs flex items-center gap-2.5 animate-scale-in">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>Uploads are currently closed or archived for this event gallery.</span>
          <button
            type="button"
            onClick={() => setUploadsClosedNotice(false)}
            className="ml-2 text-white/50 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload Failure Alert Banner (Visible when failed uploads exist) */}
      {uploadQueue.some(i => i.status === 'failed') && !uploadErrorBannerDismissed && (
        <div className="px-3.5 sm:px-6 pt-3 pb-1 max-w-7xl mx-auto w-full animate-fade-in">
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-red-900 dark:text-red-200 leading-tight">
                  {uploadQueue.filter(i => i.status === 'failed').length} photo{uploadQueue.filter(i => i.status === 'failed').length > 1 ? 's' : ''} failed to upload
                </p>
                <p className="text-[11px] text-red-700 dark:text-red-300 mt-0.5">
                  {uploadQueue.find(i => i.status === 'failed')?.error || 'Check network connection or file size constraints (max 100MB).'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleRetryAllUploads}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Failed</span>
              </button>

              <button
                type="button"
                onClick={() => setUploadErrorBannerDismissed(true)}
                title="Dismiss banner"
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pull-to-Refresh Wrapper: allows guests to pull down from the top to sync new moments */}
      <PullToRefresh
        onRefresh={handlePullToRefresh}
        disabled={selectedPhotoIndex !== null || showSlideshow || showShareModal || showHostDashboard}
      >
        {/* Event Info Snippet Banner (if location/date/description present) */}
        {(event.description || event.location || event.date) && (
          <div className="px-3.5 sm:px-6 pt-3 pb-1 max-w-7xl mx-auto w-full">
            <div className="bg-white/80 backdrop-blur-xs rounded-2xl border border-gray-200/80 px-4 py-3 text-xs text-gray-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
              <div className="flex-1 min-w-0">
                {event.description && (
                  <p className="text-[#1A1A1A] font-medium leading-relaxed">
                    {event.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400 mt-1">
                  {event.date && <span>📅 {event.date}</span>}
                  {event.location && <span>📍 {event.location}</span>}
                </div>
              </div>
              
              {event.isArchived && (
                <span className="self-start sm:self-auto px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold text-[10px] uppercase">
                  Archived (Read-Only)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Interactive File Input & Upload Feedback Bar */}
        {(!event.isArchived && event.allowUploads) && (
          <div className="px-3.5 sm:px-6 pt-3 pb-1 max-w-7xl mx-auto w-full">
            <div
              id="gallery-file-input-bar"
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              aria-label={
                isUploading
                  ? `Uploading ${uploadingItems.length} photos: ${overallUploadProgress}% complete`
                  : 'Upload photos to event'
              }
              className={`relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none ${
                isUploading
                  ? 'bg-white dark:bg-[#08070E] border-[#E67E22] ring-2 ring-[#E67E22]/20 shadow-md animate-upload-pulse'
                  : showRecentUploadSuccess
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-2xs'
                    : 'bg-white/80 dark:bg-[#06050A]/85 dark:backdrop-blur-md hover:bg-white dark:hover:bg-[#0E0D16] border-gray-200/80 dark:border-white/[0.08] shadow-2xs hover:shadow-xs'
              }`}
            >
              {/* Subtle Progress Bar Track inside the file input bar */}
              {isUploading && (
                <div className="absolute top-0 left-0 right-0 h-1 sm:h-1.5 bg-gray-100 dark:bg-white/10 overflow-hidden pointer-events-none">
                  <div
                    className="h-full bg-gradient-to-r from-[#E67E22] via-amber-400 to-[#E67E22] transition-all duration-300 ease-out animate-upload-shimmer shadow-[0_0_8px_#E67E22]"
                    style={{ width: `${Math.max(overallUploadProgress, 6)}%` }}
                  />
                </div>
              )}

              {/* Left side: Upload indicator & text */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    isUploading
                      ? 'bg-[#E67E22] text-white shadow-sm shadow-[#E67E22]/30'
                      : showRecentUploadSuccess
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-[#E67E22] border border-amber-200/50 dark:border-amber-700/30'
                  }`}
                >
                  {isUploading ? (
                    <UploadCloud className="w-5 h-5 text-white animate-bounce" />
                  ) : showRecentUploadSuccess ? (
                    <Check className="w-5 h-5 stroke-[2.5]" />
                  ) : (
                    <Camera className="w-4 h-4 stroke-[2]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs sm:text-sm font-bold text-[#1A1A1A] dark:text-white truncate">
                      {isUploading
                        ? `Uploading ${uploadingItems.length} moment${uploadingItems.length > 1 ? 's' : ''}...`
                        : showRecentUploadSuccess
                          ? 'All moments added to gallery ✨'
                          : 'Tap to add photos or drop anywhere'}
                    </p>
                    {isUploading && (
                      <span className="text-[11px] font-mono font-bold text-[#E67E22] bg-[#E67E22]/10 px-1.5 py-0.5 rounded-md shrink-0">
                        {overallUploadProgress}%
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    {isUploading
                      ? 'Saving full-resolution originals untouched in the background'
                      : 'Supports RAW, HEIC, JPG, PNG up to 100MB per file'}
                  </p>
                </div>
              </div>

              {/* Right side: Action badge or micro-progress detail */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                {isUploading ? (
                  <div className="flex items-center gap-2 bg-[#E67E22]/10 text-[#E67E22] px-3 py-1.5 rounded-xl text-xs font-semibold">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E67E22] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E67E22]" />
                    </span>
                    <span>Syncing</span>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-[#E67E22]" />
                    <span>Select Photos</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Masonry Gallery */}
        <main className="flex-1 max-w-7xl mx-auto w-full">
          <PhotoGrid
            photos={photos}
            onPhotoClick={(_photo, index) => handleOpenPhoto(index)}
            onOpenUpload={() => fileInputRef.current?.click()}
            onTakePhoto={() => cameraInputRef.current?.click()}
            onShareEvent={() => setShowShareModal(true)}
            eventName={event.name}
            isArchived={event.isArchived || !event.allowUploads}
            isUploading={isUploading}
            uploadProgress={overallUploadProgress}
            uploadingCount={uploadingItems.length}
          />
        </main>
      </PullToRefresh>

      {/* FLOATING ACTION BUTTON (FAB): Clean Minimalism "+ Add Photos" (Shown when gallery has photos) */}
      {(!event.isArchived && event.allowUploads && photos.length > 0) && (
        <div className="fixed bottom-6 right-6 z-30 flex items-center gap-3 pb-safe animate-scale-up">
          <div className="flex items-center gap-2 shadow-2xl rounded-full p-1.5 bg-white/95 backdrop-blur-md border border-gray-200">
            {/* Take photo directly */}
            <button
              id="btn-fab-camera"
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              aria-label="Take Photo"
              className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 active:scale-95 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Camera className="w-5 h-5 text-gray-700" />
            </button>

            {/* Multi-photo picker FAB with subtle progress and pulsing feedback */}
            <button
              id="btn-fab-add-photos"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label={isUploading ? `Uploading photos: ${overallUploadProgress}%` : "Add Moments"}
              className={`relative overflow-hidden flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm shadow-md active:scale-95 transition-all min-h-[44px] ${
                isUploading
                  ? 'bg-[#E67E22] text-white shadow-[#E67E22]/40 ring-4 ring-[#E67E22]/25 animate-upload-pulse'
                  : 'bg-[#E67E22] hover:bg-[#d47019] text-white shadow-[#E67E22]/25'
              }`}
            >
              {/* Progress Bar within FAB button */}
              {isUploading && (
                <div className="absolute inset-0 pointer-events-none">
                  <div
                    className="h-full bg-black/15 transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(overallUploadProgress, 6)}%` }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 overflow-hidden">
                    <div
                      className="h-full bg-white/90 rounded-full transition-all duration-300 ease-out animate-upload-shimmer"
                      style={{ width: `${Math.max(overallUploadProgress, 6)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="relative z-10 flex items-center gap-2">
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Uploading {overallUploadProgress}%</span>
                  </>
                ) : showRecentUploadSuccess ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Saved! ✨</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Add Moments</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Upload Queue Overlay */}
      <UploadQueue
        items={uploadQueue}
        onRetry={handleRetryUpload}
        onRetryAll={handleRetryAllUploads}
        onDismiss={handleDismissUploadItem}
        onClearCompleted={handleClearCompletedUploads}
      />

      {/* Full-screen Immersive Photo Viewer */}
      {selectedPhotoIndex !== null && (
        <PhotoViewer
          photos={photos}
          initialIndex={selectedPhotoIndex}
          onClose={handleClosePhoto}
          onDeletePhoto={handleDeletePhoto}
          isHost={isHost}
          currentSessionId={sessionId}
        />
      )}

      {/* Cinematic Slideshow with Music */}
      {showSlideshow && photos.length > 0 && (
        <SlideshowViewer
          photos={photos}
          event={event}
          initialIndex={0}
          onClose={() => setShowSlideshow(false)}
        />
      )}

      {/* Share / QR Code Modal */}
      {showShareModal && (
        <ShareModal
          eventName={event.name}
          eventCode={event.code}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Host Management Dashboard Drawer */}
      {showHostDashboard && hostEvent && (
        <HostDashboard
          event={hostEvent}
          photos={photos}
          stats={stats}
          onClose={() => setShowHostDashboard(false)}
          onUpdateEvent={handleUpdateEvent}
          onDeletePhoto={handleDeletePhoto}
          onClearAllPhotos={handleClearAllPhotos}
        />
      )}

      {/* Optional Guest Name Prompt Modal */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FDFCF9] w-full max-w-sm rounded-3xl border border-gray-200 shadow-2xl p-6 text-center animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-[#E67E22]/10 text-[#E67E22] flex items-center justify-center mx-auto mb-3">
              <Camera className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-[#1A1A1A] mb-1 font-display">
              Add your name?
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Optional: Let the host and guests know who snapped these moments.
            </p>

            <input
              id="input-guest-name-modal"
              type="text"
              placeholder="e.g. Alex, Sam, Sofia"
              value={uploaderName}
              onChange={(e) => setUploaderNameState(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-[#1A1A1A] text-sm focus:outline-none focus:ring-2 focus:ring-[#E67E22]/30 mb-4"
              autoFocus
            />

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleConfirmNameAndUpload(uploaderName)}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#1A1A1A] text-white font-semibold text-sm hover:bg-black transition-colors"
              >
                Continue & Upload
              </button>

              <button
                type="button"
                onClick={handleSkipNameAndUpload}
                className="w-full py-2.5 px-4 rounded-2xl text-gray-500 hover:text-black text-xs font-medium transition-colors"
              >
                Upload Anonymously
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
