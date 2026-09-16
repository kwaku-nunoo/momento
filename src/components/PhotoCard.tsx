import React, { useState } from 'react';
import type { MomentoPhoto } from '../types';
import { formatRelativeTime } from '../lib/utils';
import { ImageOff, RefreshCw } from 'lucide-react';

interface PhotoCardProps {
  photo: MomentoPhoto;
  index: number;
  onClick: (photo: MomentoPhoto, index: number) => void;
  onQuickDownload?: (photo: MomentoPhoto, e: React.MouseEvent) => void;
}

export const PhotoCard: React.FC<PhotoCardProps> = React.memo(({
  photo,
  index,
  onClick,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(false);
    setLoaded(false);
    setRetryCount(prev => prev + 1);
  };

  const imageSrc = retryCount > 0 
    ? `${photo.thumbnailUrl}?retry=${retryCount}`
    : photo.thumbnailUrl;

  return (
    <div
      id={`photo-card-${photo.id}`}
      onClick={() => onClick(photo, index)}
      className="group relative mb-2 sm:mb-3.5 break-inside-avoid overflow-hidden rounded-xl sm:rounded-2xl bg-[#EBE7E0] dark:bg-[#07060B] border border-black/[0.04] dark:border-white/[0.06] shadow-xs cursor-pointer active:scale-[0.985] transition-transform duration-150 transform-gpu"
      style={{
        aspectRatio: photo.aspectRatio > 0 ? `${photo.aspectRatio}` : '1 / 1',
        contain: 'layout paint',
        contentVisibility: 'auto',
        containIntrinsicSize: '240px',
      }}
    >
      {/* Lightweight skeleton shimmer */}
      {!loaded && !error && (
        <div className="absolute inset-0 bg-gradient-to-tr from-[#E6E1D8] via-[#F2EDE4] to-[#E6E1D8] dark:from-[#09080E] dark:via-[#13111A] dark:to-[#09080E] animate-pulse" />
      )}

      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-gray-400 dark:text-gray-500 text-xs text-center bg-gray-100 dark:bg-[#07060B]">
          <ImageOff className="w-6 h-6 mb-1.5 opacity-50" />
          <span className="text-[11px] mb-2 font-medium">Moment unavailable</span>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/10 dark:bg-white/10 text-xs hover:bg-black/20 dark:hover:bg-white/20 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      ) : (
        <img
          src={imageSrc}
          alt={photo.originalFilename || 'Event photo'}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Subtle bottom gradient on hover/tap */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 sm:transition-opacity duration-200 flex flex-col justify-end p-2.5 pointer-events-none">
        <div className="flex items-center justify-between text-white text-[11px] font-medium leading-tight drop-shadow-xs">
          <span className="truncate max-w-[120px]">
            {photo.uploaderName ? photo.uploaderName : 'Guest moment'}
          </span>
          <span className="text-white/80 text-[10px]">
            {formatRelativeTime(photo.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
});

PhotoCard.displayName = 'PhotoCard';
