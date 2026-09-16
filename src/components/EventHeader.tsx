import React from 'react';
import type { MomentoEvent } from '../types';
import { 
  Share2, 
  QrCode, 
  Settings, 
  Users, 
  Image as ImageIcon, 
  MapPin, 
  Calendar, 
  Sparkles, 
  ArrowLeft, 
  Play 
} from 'lucide-react';

interface EventHeaderProps {
  event: Omit<MomentoEvent, 'hostKey'>;
  photoCount: number;
  contributorCount: number;
  onOpenShare: () => void;
  onOpenHost?: () => void;
  onOpenSlideshow?: () => void;
  isHost?: boolean;
  isLive?: boolean;
  onGoHome?: () => void;
}

export const EventHeader: React.FC<EventHeaderProps> = ({
  event,
  photoCount,
  contributorCount,
  onOpenShare,
  onOpenHost,
  onOpenSlideshow,
  isHost = false,
  isLive = true,
  onGoHome
}) => {
  return (
    <header
      id="event-header-bar"
      className="sticky top-0 z-30 bg-white/80 dark:bg-[#020104]/88 backdrop-blur-md border-b border-gray-100 dark:border-white/[0.08] px-4 sm:px-6 py-3.5 transition-all"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Back & Event Info */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {onGoHome && (
            <button
              id="btn-header-back-home"
              type="button"
              onClick={onGoHome}
              aria-label="Back to home"
              className="p-2 -ml-1 rounded-full text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 active:scale-95 transition-all min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-400 font-bold leading-none">
                {isLive ? 'Live Event' : 'Archived Event'}
              </span>
              {isHost && (
                <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-[#1A1A1A] dark:bg-white dark:text-black text-white text-[9px] font-semibold uppercase tracking-wider">
                  Host
                </span>
              )}
            </div>

            <h2 className="text-sm sm:text-base font-semibold text-[#1A1A1A] dark:text-white truncate tracking-tight mt-0.5">
              {event.name}
            </h2>
          </div>
        </div>

        {/* Right: Stats Badge & Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Slideshow Button */}
          {photoCount > 0 && onOpenSlideshow && (
            <button
              id="btn-header-slideshow"
              type="button"
              onClick={onOpenSlideshow}
              aria-label="Play Slideshow"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1A1A1A] dark:bg-white/10 text-white text-xs font-semibold hover:bg-black dark:hover:bg-white/20 active:scale-95 transition-all shadow-xs min-h-[34px] cursor-pointer"
            >
              <Play className="w-3 h-3 text-[#E67E22] fill-current" />
              <span className="hidden xs:inline">Slideshow</span>
            </button>
          )}

          <button
            id="btn-header-share-qr"
            type="button"
            onClick={onOpenShare}
            aria-label="Share QR code"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#0A0910]/90 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-[#14121C] active:scale-95 transition-all shadow-2xs min-h-[34px] cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5 text-[#E67E22]" />
            <span className="hidden sm:inline">Invite / QR</span>
          </button>

          {onOpenHost && (
            <button
              id="btn-header-host-settings"
              type="button"
              onClick={onOpenHost}
              aria-label="Host settings"
              className={`p-1.5 rounded-full border transition-all min-h-[34px] min-w-[34px] flex items-center justify-center cursor-pointer ${
                isHost 
                  ? 'bg-[#1A1A1A] dark:bg-white/20 border-[#1A1A1A] dark:border-white/20 text-white hover:bg-black' 
                  : 'bg-white dark:bg-[#0A0910]/90 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#14121C]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
