import React from 'react';
import type { MomentoPhoto } from '../types';
import { PhotoCard } from './PhotoCard';
import { 
  Camera, 
  Plus, 
  Sparkles, 
  Lock, 
  QrCode, 
  Zap, 
  ShieldCheck, 
  Image as ImageIcon,
  UploadCloud
} from 'lucide-react';

interface PhotoGridProps {
  photos: MomentoPhoto[];
  onPhotoClick: (photo: MomentoPhoto, index: number) => void;
  onOpenUpload?: () => void;
  onTakePhoto?: () => void;
  onShareEvent?: () => void;
  eventName?: string;
  isArchived?: boolean;
  loading?: boolean;
  isUploading?: boolean;
  uploadProgress?: number;
  uploadingCount?: number;
}

const SKELETON_ITEMS = [
  { id: 'grid-sk-1', aspect: 'aspect-[3/4]' },
  { id: 'grid-sk-2', aspect: 'aspect-[1/1]' },
  { id: 'grid-sk-3', aspect: 'aspect-[4/5]' },
  { id: 'grid-sk-4', aspect: 'aspect-[16/9]' },
  { id: 'grid-sk-5', aspect: 'aspect-[3/4]' },
  { id: 'grid-sk-6', aspect: 'aspect-[1/1]' },
  { id: 'grid-sk-7', aspect: 'aspect-[4/3]' },
  { id: 'grid-sk-8', aspect: 'aspect-[3/4]' },
];

export const PhotoGrid: React.FC<PhotoGridProps> = React.memo(({
  photos,
  onPhotoClick,
  onOpenUpload,
  onTakePhoto,
  onShareEvent,
  eventName,
  isArchived = false,
  loading = false,
  isUploading = false,
  uploadProgress = 0,
  uploadingCount = 0,
}) => {
  if (loading) {
    return (
      <div id="photo-masonry-grid-skeleton" className="w-full px-2.5 sm:px-4 md:px-6 pb-28 pt-2 animate-fade-in" aria-busy="true">
        <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-2.5 sm:gap-3.5 [column-fill:_balance]">
          {SKELETON_ITEMS.map((item, idx) => (
            <div
              key={item.id}
              className={`relative mb-2.5 sm:mb-3.5 break-inside-avoid overflow-hidden rounded-xl sm:rounded-2xl bg-[#EBE7E0] dark:bg-[#07060B] border border-black/[0.04] dark:border-white/[0.06] shadow-xs ${item.aspect}`}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-[#E6E1D8] via-[#F2EDE4] to-[#E6E1D8] dark:from-[#09080E] dark:via-[#13111A] dark:to-[#09080E] animate-pulse" />
              <div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 dark:via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" 
                style={{ animationDelay: `${(idx % 4) * 0.3}s` }}
              />
              <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/20 dark:from-black/40 to-transparent flex items-center justify-between">
                <div className="w-16 h-2 rounded-full bg-white/40 dark:bg-white/20 animate-pulse" />
                <div className="w-6 h-2 rounded-full bg-white/30 dark:bg-white/15 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div 
        id="empty-gallery-state" 
        className="flex flex-col items-center justify-center py-12 sm:py-20 px-4 sm:px-6 text-center max-w-lg mx-auto min-h-[62vh] animate-fade-in"
      >
        {/* Photographic Viewfinder / Polaroid Silhouette Container */}
        <div className="relative mb-6 sm:mb-8 group">
          {/* Subtle Ambient Warm Glow */}
          <div className="absolute -inset-4 bg-radial from-[#E67E22]/15 via-[#E67E22]/5 to-transparent rounded-full blur-2xl pointer-events-none" />

          {/* Viewfinder Frame */}
          <div className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-white dark:bg-[#06050A] border shadow-xl flex flex-col items-center justify-center p-4 transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl ${
            isUploading 
              ? 'border-[#E67E22] ring-4 ring-[#E67E22]/20 animate-upload-pulse' 
              : 'border-gray-200/90 dark:border-white/[0.08]'
          }`}>
            {/* Viewfinder Corner Reticle Marks */}
            <div className="absolute top-2.5 left-2.5 w-2.5 h-2.5 border-t-2 border-l-2 border-gray-300 dark:border-white/30 rounded-tl-sm" />
            <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 border-t-2 border-r-2 border-gray-300 dark:border-white/30 rounded-tr-sm" />
            <div className="absolute bottom-2.5 left-2.5 w-2.5 h-2.5 border-b-2 border-l-2 border-gray-300 dark:border-white/30 rounded-bl-sm" />
            <div className="absolute bottom-2.5 right-2.5 w-2.5 h-2.5 border-b-2 border-r-2 border-gray-300 dark:border-white/30 rounded-br-sm" />

            {/* Camera Icon / Center Reticle */}
            <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] dark:bg-[#0E0D16] text-[#E67E22] flex items-center justify-center shadow-inner relative">
              {isUploading ? (
                <UploadCloud className="w-7 h-7 stroke-[1.8] text-[#E67E22] animate-bounce" />
              ) : (
                <Camera className="w-7 h-7 stroke-[1.8] text-[#1A1A1A] dark:text-white group-hover:text-[#E67E22] transition-colors" />
              )}
              <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-[#06050A] ${
                isUploading ? 'bg-amber-400 animate-ping' : 'bg-[#E67E22] animate-pulse'
              }`} />
            </div>

            {/* Micro Focal Badge */}
            <span className="text-[9px] font-mono tracking-widest text-gray-400 dark:text-gray-400 uppercase font-semibold mt-2">
              {isUploading ? `UPLOADING ${uploadProgress}%` : 'RAW • 100%'}
            </span>
          </div>
        </div>

        {/* Headline & Narrative */}
        <div className="space-y-2 mb-8 max-w-sm">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 dark:bg-white/10 border border-gray-200/80 dark:border-white/10 text-[#1A1A1A] dark:text-white text-[11px] font-bold uppercase tracking-wider shadow-2xs">
            <Sparkles className="w-3 h-3 text-[#E67E22]" />
            <span>Shared Camera Roll</span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] dark:text-white font-display tracking-tight">
            No moments yet.
          </h3>

          <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed">
            {isArchived
              ? 'This event is archived and uploads are currently closed.'
              : 'Be the first to capture and share a memory. Every guest’s photos will appear here in real time.'}
          </p>
        </div>

        {/* Primary Call-to-Action Group */}
        {!isArchived ? (
          <div className="w-full max-w-xs space-y-3">
            {onOpenUpload && (
              <button
                id="btn-empty-add-photos"
                type="button"
                onClick={onOpenUpload}
                aria-label={isUploading ? `Uploading photos: ${uploadProgress}% completed` : "Add Photos"}
                className={`w-full relative overflow-hidden inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-white text-sm sm:text-base font-semibold shadow-lg active:scale-[0.98] transition-all cursor-pointer min-h-[52px] group ${
                  isUploading
                    ? 'bg-[#1A1A1A] dark:bg-[#22202C] ring-2 ring-[#E67E22] shadow-[#E67E22]/20 animate-upload-pulse'
                    : 'bg-[#1A1A1A] dark:bg-white dark:text-black hover:bg-black dark:hover:bg-gray-100 hover:shadow-xl'
                }`}
              >
                {/* Background Subtle Progress Track when Uploading */}
                {isUploading && (
                  <div className="absolute inset-0 bg-[#E67E22]/10 pointer-events-none">
                    <div
                      className="h-full bg-[#E67E22]/20 transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(uploadProgress, 6)}%` }}
                    />
                  </div>
                )}

                {/* Subtle Linear Progress Bar along bottom edge */}
                {isUploading && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30 dark:bg-white/10 overflow-hidden pointer-events-none">
                    <div
                      className="h-full bg-gradient-to-r from-[#E67E22] via-amber-400 to-[#E67E22] transition-all duration-300 ease-out animate-upload-shimmer shadow-[0_0_8px_#E67E22]"
                      style={{ width: `${Math.max(uploadProgress, 6)}%` }}
                    />
                  </div>
                )}

                {/* Button Content */}
                <div className="relative z-10 flex items-center justify-center gap-2.5">
                  {isUploading ? (
                    <>
                      <div className="relative flex items-center justify-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#E67E22] animate-ping absolute" />
                        <span className="w-2.5 h-2.5 rounded-full bg-[#E67E22]" />
                      </div>
                      <span className="font-semibold text-white tracking-wide">
                        Uploading {uploadProgress}%
                      </span>
                      {uploadingCount > 0 && (
                        <span className="text-xs text-gray-300 font-normal">
                          ({uploadingCount} photo{uploadingCount > 1 ? 's' : ''})
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 text-[#E67E22] stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
                      <span>+ Add Photos</span>
                    </>
                  )}
                </div>
              </button>
            )}

            <div className="flex items-center justify-center gap-2">
              {onTakePhoto && (
                <button
                  id="btn-empty-take-photo"
                  type="button"
                  onClick={onTakePhoto}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white dark:bg-[#0A0910] border border-gray-200 dark:border-white/10 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#14121C] hover:text-black dark:hover:text-white shadow-2xs transition-all active:scale-95 min-h-[40px] cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-gray-500 dark:text-gray-300" />
                  <span>Take Photo</span>
                </button>
              )}

              {onShareEvent && (
                <button
                  id="btn-empty-share-qr"
                  type="button"
                  onClick={onShareEvent}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white dark:bg-[#0A0910] border border-gray-200 dark:border-white/10 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#14121C] hover:text-black dark:hover:text-white shadow-2xs transition-all active:scale-95 min-h-[40px] cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-[#E67E22]" />
                  <span>Share QR</span>
                </button>
              )}
            </div>

            {/* Drag & Drop Hint for Desktop/Tablets */}
            <p className="text-[11px] text-gray-400 dark:text-gray-400 hidden sm:block pt-1">
              or drag & drop image files anywhere on this page
            </p>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 text-xs font-medium">
            <Lock className="w-4 h-4 text-gray-400" />
            <span>Uploads disabled by event host</span>
          </div>
        )}

        {/* Core Value Assurance Badges */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-sm mt-10 pt-6 border-t border-gray-200/60 dark:border-white/10 text-center">
          <div className="flex flex-col items-center">
            <span className="text-sm mb-1">📸</span>
            <span className="text-[10px] font-bold text-[#1A1A1A] dark:text-white leading-tight">Untouched Quality</span>
            <span className="text-[9px] text-gray-400 mt-0.5">Original raw files</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-sm mb-1">⚡</span>
            <span className="text-[10px] font-bold text-[#1A1A1A] dark:text-white leading-tight">Live Realtime</span>
            <span className="text-[9px] text-gray-400 mt-0.5">Instant sync</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-sm mb-1">🔒</span>
            <span className="text-[10px] font-bold text-[#1A1A1A] dark:text-white leading-tight">Zero Sign-Up</span>
            <span className="text-[9px] text-gray-400 mt-0.5">Guest friendly</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="photo-masonry-grid" className="w-full px-2.5 sm:px-4 md:px-6 pb-28 pt-2">
      {/* Masonry column layout */}
      <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-2.5 sm:gap-3.5 [column-fill:_balance]">
        {photos.map((photo, idx) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            index={idx}
            onClick={onPhotoClick}
          />
        ))}
      </div>
    </div>
  );
});

PhotoGrid.displayName = 'PhotoGrid';
