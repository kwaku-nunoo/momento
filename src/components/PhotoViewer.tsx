import React, { useEffect, useState, useRef } from 'react';
import type { MomentoPhoto } from '../types';
import { formatFileSize, formatRelativeTime } from '../lib/utils';
import { 
  X, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Share2, 
  Info,
  Check,
  Maximize2,
  AlertCircle
} from 'lucide-react';

interface PhotoViewerProps {
  photos: MomentoPhoto[];
  initialIndex: number;
  onClose: () => void;
  onDeletePhoto?: (photoId: string) => Promise<void>;
  isHost?: boolean;
  currentSessionId?: string;
}

export const PhotoViewer: React.FC<PhotoViewerProps> = ({
  photos,
  initialIndex,
  onClose,
  onDeletePhoto,
  isHost = false,
  currentSessionId = ''
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showInfo, setShowInfo] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);

  const currentPhoto = photos[currentIndex];
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Sync index if props change
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Lock body scroll while lightbox is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, photos.length]);

  if (!currentPhoto) return null;

  const isOwner = currentSessionId && currentPhoto.uploaderSessionId === currentSessionId;
  const canDelete = isHost || isOwner;

  const goToNext = () => {
    if (currentIndex < photos.length - 1) {
      setImageLoaded(false);
      setCurrentIndex(prev => prev + 1);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setImageLoaded(false);
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Touch swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Horizontal swipe
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) {
        goToNext();
      } else {
        goToPrev();
      }
    } else if (deltaY > 100 && Math.abs(deltaY) > Math.abs(deltaX) * 2) {
      // Swipe down to dismiss
      onClose();
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Download ORIGINAL untouched file
  const handleDownloadOriginal = () => {
    setDownloading(true);
    const downloadUrl = currentPhoto.originalUrl;
    
    // Create direct hidden download anchor
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = currentPhoto.originalFilename || `momento-original-${currentPhoto.id}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    setTimeout(() => setDownloading(false), 1200);
  };

  const handleSharePhoto = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Momento Photo',
          text: `Check out this photo from ${currentPhoto.uploaderName || 'a guest'} on MOMENTO`,
          url: shareUrl
        });
      } catch (err) {}
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } catch (e) {}
    }
  };

  const handleExecuteDelete = async () => {
    if (!onDeletePhoto) return;
    try {
      setIsDeleting(true);
      setViewerError(null);
      await onDeletePhoto(currentPhoto.id);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      if (photos.length <= 1) {
        onClose();
      } else if (currentIndex >= photos.length - 1) {
        setCurrentIndex(photos.length - 2);
      }
    } catch (err: any) {
      setIsDeleting(false);
      setViewerError(err?.message || 'Failed to delete photo. Please try again.');
      setTimeout(() => setViewerError(null), 3500);
    }
  };

  return (
    <div
      id="photo-lightbox-modal"
      className="fixed inset-0 z-50 bg-black/95 text-white flex flex-col justify-between select-none touch-none backdrop-blur-md"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Bar */}
      <header className="relative z-20 flex items-center justify-between px-4 py-3 sm:px-6 bg-gradient-to-b from-black/80 to-transparent pt-safe">
        <div className="flex items-center gap-3">
          <button
            id="btn-close-viewer"
            type="button"
            onClick={onClose}
            aria-label="Close photo viewer"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center text-white min-h-[44px] min-w-[44px]"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-white/90">
              {currentIndex + 1} <span className="text-white/50">/ {photos.length}</span>
            </span>
            <span className="text-[11px] text-white/60 truncate max-w-[140px] sm:max-w-xs">
              {currentPhoto.uploaderName ? `by ${currentPhoto.uploaderName}` : 'Guest moment'} • {formatRelativeTime(currentPhoto.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            id="btn-photo-info-toggle"
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            aria-label="View photo details"
            className={`w-10 h-10 rounded-full transition-all flex items-center justify-center min-h-[44px] min-w-[44px] ${
              showInfo ? 'bg-[#E67E22] text-white' : 'bg-white/10 hover:bg-white/20 text-white/80'
            }`}
          >
            <Info className="w-4 h-4" />
          </button>

          <button
            id="btn-photo-share"
            type="button"
            onClick={handleSharePhoto}
            aria-label="Share photo"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center text-white/80 min-h-[44px] min-w-[44px]"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>

          {canDelete && (
            <button
              id="btn-photo-delete"
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              aria-label="Delete photo"
              className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-300 transition-all flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main Image Stage */}
      <main className="relative flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        {/* Previous Button (Desktop) */}
        {currentIndex > 0 && (
          <button
            id="btn-prev-photo"
            type="button"
            onClick={goToPrev}
            aria-label="Previous photo"
            className="hidden sm:flex absolute left-4 z-20 w-12 h-12 rounded-full bg-black/40 hover:bg-black/70 text-white items-center justify-center transition-all border border-white/10 active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Next Button (Desktop) */}
        {currentIndex < photos.length - 1 && (
          <button
            id="btn-next-photo"
            type="button"
            onClick={goToNext}
            aria-label="Next photo"
            className="hidden sm:flex absolute right-4 z-20 w-12 h-12 rounded-full bg-black/40 hover:bg-black/70 text-white items-center justify-center transition-all border border-white/10 active:scale-95"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Image Container */}
        <div className="relative max-w-full max-h-full flex items-center justify-center">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[#E67E22] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <img
            key={currentPhoto.id}
            src={currentPhoto.previewUrl}
            alt={currentPhoto.originalFilename || 'Full view'}
            onLoad={() => setImageLoaded(true)}
            className={`max-h-[82vh] max-w-full object-contain rounded-lg shadow-2xl transition-opacity duration-200 ${
              imageLoaded ? 'opacity-100' : 'opacity-20'
            }`}
          />
        </div>

        {/* Info Overlay Panel */}
        {showInfo && (
          <aside className="absolute top-4 right-4 z-30 w-72 bg-neutral-900/95 border border-white/15 rounded-2xl p-4 text-xs text-neutral-300 shadow-2xl backdrop-blur-md">
            <h4 className="font-bold text-white text-sm mb-3">Photo Details</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-500">Filename</span>
                <span className="font-mono text-neutral-200 truncate max-w-[140px]">
                  {currentPhoto.originalFilename}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Resolution</span>
                <span className="text-neutral-200 font-mono">
                  {currentPhoto.width} × {currentPhoto.height}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Original Size</span>
                <span className="text-neutral-200 font-mono">
                  {formatFileSize(currentPhoto.fileSize)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Uploaded</span>
                <span className="text-neutral-200">
                  {new Date(currentPhoto.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Uploader</span>
                <span className="text-neutral-200">
                  {currentPhoto.uploaderName || 'Anonymous Guest'}
                </span>
              </div>
              <div className="pt-2 border-t border-white/10 text-[11px] text-neutral-400">
                Untouched camera master stored securely.
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* Bottom Bar: Action center */}
      <footer className="relative z-20 flex items-center justify-between px-4 py-3.5 sm:px-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent pb-safe">
        <div className="text-[11px] text-white/50 hidden sm:block">
          Swipe or use arrow keys to navigate
        </div>

        {/* Download Original Master Action */}
        <div className="w-full sm:w-auto flex items-center justify-center sm:justify-end gap-3">
          <button
            id="btn-download-original"
            type="button"
            onClick={handleDownloadOriginal}
            disabled={downloading}
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3 rounded-full bg-[#E67E22] hover:bg-[#d47019] active:scale-95 text-white font-semibold text-sm transition-all shadow-lg min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            <span>
              {downloading ? 'Downloading…' : 'Download Original'}
            </span>
            <span className="text-xs opacity-80 font-mono font-normal">
              ({formatFileSize(currentPhoto.fileSize)})
            </span>
          </button>
        </div>
      </footer>

      {/* Viewer Error Notification Toast */}
      {viewerError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-60 bg-red-600/90 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs flex items-center gap-2 animate-fade-in backdrop-blur-md">
          <AlertCircle className="w-4 h-4 text-white" />
          <span>{viewerError}</span>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          id="modal-viewer-delete-confirm"
          className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        >
          <div className="bg-[#0C0B12] border border-white/15 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Delete Photo?</h3>
            <p className="text-xs text-gray-300 mb-5 leading-relaxed">
              This will permanently remove this moment from the event gallery.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors min-h-[42px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors min-h-[42px] cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
