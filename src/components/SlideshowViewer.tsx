import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { MomentoPhoto, MomentoEvent } from '../types';
import { 
  slideshowAudio, 
  SOUNDTRACK_OPTIONS, 
  type MusicTheme 
} from '../lib/slideshowAudio';
import { 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Music, 
  Upload, 
  Shuffle, 
  Clock, 
  Sparkles,
  Sliders,
  ArrowLeft,
  LogOut
} from 'lucide-react';

interface SlideshowViewerProps {
  photos: MomentoPhoto[];
  event: MomentoEvent | Omit<MomentoEvent, 'hostKey'>;
  initialIndex?: number;
  onClose: () => void;
}

export const SlideshowViewer: React.FC<SlideshowViewerProps> = ({
  photos,
  event,
  initialIndex = 0,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [slideInterval, setSlideInterval] = useState<number>(5000); // 5 seconds
  const [isShuffle, setIsShuffle] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showMusicMenu, setShowMusicMenu] = useState(false);
  
  // Audio state
  const [musicTheme, setMusicTheme] = useState<MusicTheme>('off');
  const [volume, setVolume] = useState(0.6);
  const [isMuted, setIsMuted] = useState(false);
  const [customTrackName, setCustomTrackName] = useState<string>('');
  const [customAudioError, setCustomAudioError] = useState<string>('');
  const [transition, setTransition] = useState<'zoom' | 'drift' | 'spin' | 'flash'>('zoom');

  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect event theme vibe based on event name/description
  useEffect(() => {
    setMusicTheme('off');
    slideshowAudio.setVolume(0.6);
    slideshowAudio.stop();

    return () => {
      slideshowAudio.stop();
    };
  }, [event.name, event.description]);

  // Handle slide advance
  const nextSlide = useCallback(() => {
    if (photos.length === 0) return;
    const transitions: Array<'zoom' | 'drift' | 'spin' | 'flash'> = ['zoom', 'drift', 'spin', 'flash'];
    setTransition(transitions[Math.floor(slideshowAudio.getPlaybackTime() / 0.6) % transitions.length]);
    if (isShuffle) {
      const nextRand = Math.floor(Math.random() * photos.length);
      setCurrentIndex(nextRand);
    } else {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }
  }, [photos.length, isShuffle]);

  const prevSlide = useCallback(() => {
    if (photos.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  // Slideshow auto-advance timer
  useEffect(() => {
    if (!isPlaying || photos.length <= 1) return;
    const interval = setInterval(() => {
      nextSlide();
    }, slideInterval);
    return () => clearInterval(interval);
  }, [isPlaying, slideInterval, nextSlide, photos.length]);

  // Mouse idle hide controls
  const handleUserActivity = () => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      window.clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowMusicMenu(false);
      }
    }, 4000);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleUserActivity();
      if (e.key === 'Escape' || e.key === 'q' || e.key === 'Q' || e.key === 'Backspace') {
        if (isFullscreen && document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'p' || e.key === 'P') {
        setIsPlaying((p) => !p);
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
      } else if (e.key === 'f' || e.key === 'F') {
        handleToggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, nextSlide, prevSlide, onClose, isPlaying]);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleToggleMute = () => {
    if (isMuted) {
      slideshowAudio.setVolume(volume);
      setIsMuted(false);
    } else {
      slideshowAudio.setVolume(0);
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    slideshowAudio.setVolume(newVol);
  };

  const handleSelectSoundtrack = (theme: MusicTheme) => {
    setMusicTheme(theme);
    const option = SOUNDTRACK_OPTIONS.find((item) => item.id === theme);
    if (option?.source) {
      slideshowAudio.setCustomAudio(option.source, option.title);
      slideshowAudio.playCustomAudio().catch(() => setMusicTheme('off'));
    } else {
      slideshowAudio.switchTheme(theme);
    }
  };

  const handleCustomAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomAudioError('');
      slideshowAudio.setCustomAudio(file);
      setCustomTrackName(file.name.replace(/\.[^/.]+$/, ''));
      setMusicTheme('custom');
      slideshowAudio.playCustomAudio().catch((error: Error) => setCustomAudioError(error.message || 'Tap Play uploaded song to start it.'));
    }
  };

  const handlePlayCustomAudio = () => {
    setCustomAudioError('');
    setIsMuted(false);
    slideshowAudio.setVolume(volume || 0.6);
    setMusicTheme('custom');
    slideshowAudio.playCustomAudio().catch((error: Error) => setCustomAudioError(error.message || 'This audio file could not be played. Try an MP3, WAV, M4A, or AAC file.'));
  };

  const currentPhoto = photos[currentIndex] || photos[0];

  if (!currentPhoto) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      id="slideshow-viewer"
      onMouseMove={handleUserActivity}
      onTouchStart={handleUserActivity}
      className="fixed inset-0 z-50 bg-[#020104] text-white flex flex-col justify-between overflow-hidden select-none"
    >
      {/* Background Ambient Glow & Ken Burns Display */}
      <div 
        className="absolute inset-0 overflow-hidden flex items-center justify-center cursor-pointer"
        onClick={() => setShowControls(prev => !prev)}
      >
        {/* Soft blurred background for portrait or mismatched aspect ratio photos */}
        <div
          className="absolute inset-0 bg-cover bg-center blur-3xl opacity-25 scale-125 transition-all duration-1000"
          style={{ backgroundImage: `url(${currentPhoto.originalUrl})` }}
        />

        {/* Foreground Photo with subtle Ken Burns motion */}
        <img
          key={currentPhoto.id}
          src={currentPhoto.originalUrl}
          alt={currentPhoto.originalFilename || 'Event photo'}
          className={`relative max-w-full max-h-full object-contain drop-shadow-2xl slideshow-transition-${transition}`}
          style={{
            animation: `${transition === 'zoom' ? 'slideshow-zoom' : transition === 'drift' ? 'slideshow-drift' : transition === 'spin' ? 'slideshow-spin' : 'slideshow-flash'} ${transition === 'flash' ? '900ms' : '7000ms'} ease-out both`,
            transformOrigin: currentIndex % 2 === 0 ? 'center center' : 'top right'
          }}
        />
      </div>

      {/* Top Header Bar */}
      <div
        className={`relative z-20 px-4 sm:px-6 py-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top-Left Back to Gallery Button */}
        <button
          id="btn-slideshow-back-gallery"
          type="button"
          onClick={onClose}
          className="flex items-center gap-2.5 group text-left cursor-pointer p-1.5 -m-1.5 rounded-2xl hover:bg-white/10 active:scale-95 transition-all"
          title="Back to Gallery (Esc)"
          aria-label="Back to Gallery"
        >
          <div className="w-9 h-9 rounded-xl bg-white/15 group-hover:bg-[#E67E22] backdrop-blur-md flex items-center justify-center text-white transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <div className="truncate max-w-[160px] sm:max-w-xs">
            <h3 className="font-bold text-sm sm:text-base font-display truncate text-white leading-tight">
              {event.name}
            </h3>
            <p className="text-[11px] text-white/70 truncate flex items-center gap-1">
              <span>Photo {currentIndex + 1} of {photos.length}</span>
              <span className="hidden sm:inline">• {currentPhoto.uploaderName || 'Guest'}</span>
            </p>
          </div>
        </button>

        {/* Right Top Actions */}
        <div className="flex items-center gap-2">
          {/* Music Menu Toggle */}
          <button
            id="btn-slideshow-music"
            type="button"
            onClick={() => setShowMusicMenu(!showMusicMenu)}
            className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-semibold backdrop-blur-md transition-all cursor-pointer ${
              musicTheme !== 'off'
                ? 'bg-[#E67E22]/20 border-[#E67E22]/40 text-[#E67E22]'
                : 'bg-white/10 border-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {musicTheme === 'custom' ? (customTrackName || 'Custom Song') : musicTheme !== 'off' ? 'Soundtrack' : 'Muted'}
            </span>
          </button>

          {/* Fullscreen Button */}
          <button
            id="btn-slideshow-fullscreen"
            type="button"
            onClick={handleToggleFullscreen}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition-colors cursor-pointer"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* PROMINENT EXIT SLIDESHOW BUTTON */}
          <button
            id="btn-slideshow-exit"
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/20 hover:bg-red-500/80 active:scale-95 text-white font-semibold text-xs backdrop-blur-md transition-all shadow-md cursor-pointer border border-white/15"
            title="Exit Slideshow (Esc)"
            aria-label="Exit Slideshow"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
            <span className="font-medium">Exit</span>
          </button>
        </div>
      </div>


      {/* Floating Soundtracks & Music Selector Popup */}
      {showMusicMenu && (
        <div className="absolute top-20 right-4 sm:right-6 z-30 w-80 max-w-[calc(100vw-2rem)] bg-[#1A1A1A]/95 backdrop-blur-xl border border-white/15 rounded-3xl p-4 shadow-2xl animate-scale-in text-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
            <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#E67E22]" /> Gallery Soundtrack
            </span>
            <button
              type="button"
              onClick={() => setShowMusicMenu(false)}
              className="text-white/50 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2 mb-4 px-2 py-2 bg-white/5 rounded-2xl">
            <button
              type="button"
              onClick={handleToggleMute}
              className="text-white/70 hover:text-white"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-[#E67E22]" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#E67E22]"
            />
            <span className="text-[10px] text-white/50 font-mono w-7 text-right">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>

          {/* Soundtrack List */}
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {SOUNDTRACK_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectSoundtrack(opt.id)}
                className={`w-full text-left p-2.5 rounded-2xl flex items-center justify-between transition-all ${
                  musicTheme === opt.id
                    ? 'bg-[#E67E22] text-white font-semibold shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-white/80'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-base">{opt.icon}</span>
                  <div className="truncate">
                    <div className="font-semibold text-xs truncate">{opt.title}</div>
                    <div className={`text-[10px] truncate ${musicTheme === opt.id ? 'text-white/80' : 'text-white/40'}`}>
                      {opt.vibe}
                    </div>
                  </div>
                </div>
                {musicTheme === opt.id && (
                  <span className="w-2 h-2 rounded-full bg-white shrink-0 animate-pulse ml-2" />
                )}
              </button>
            ))}
          </div>

          {/* Custom Song Upload Action */}
          <div className="mt-3 pt-3 border-t border-white/10">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.aac"
              onChange={handleCustomAudioUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white flex items-center justify-center gap-2 font-medium text-xs transition-all border border-dashed border-white/20 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#E67E22]" />
              <span>Choose Custom Audio (MP3/WAV)</span>
            </button>
            {customTrackName && (
              <div className="mt-2 space-y-1.5">
                <div className="text-[10px] text-emerald-400 text-center truncate">
                  Loaded: {customTrackName}
                </div>
                <button
                  type="button"
                  onClick={handlePlayCustomAudio}
                  className="w-full py-2 rounded-xl bg-[#E67E22] hover:bg-[#d47019] text-white text-xs font-semibold transition-colors"
                >
                  Play uploaded song
                </button>
                {customAudioError && (
                  <div className="text-[10px] text-amber-300 text-center leading-relaxed">
                    {customAudioError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Center Left/Right Arrow Overlays */}
      <button
        id="btn-slideshow-prev"
        type="button"
        onClick={prevSlide}
        className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white transition-all ${
          showControls ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
        }`}
        aria-label="Previous Photo"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        id="btn-slideshow-next"
        type="button"
        onClick={nextSlide}
        className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white transition-all ${
          showControls ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
        }`}
        aria-label="Next Photo"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Bottom Controls Bar */}
      <div
        className={`relative z-20 px-4 sm:px-6 py-4 sm:py-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 transition-opacity duration-300 pb-safe ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Animated Equalizer Wave / Audio Status */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {musicTheme !== 'off' && isPlaying && !isMuted ? (
            <div className="flex items-end gap-1 h-5">
              <span className="w-1 bg-[#E67E22] rounded-full animate-pulse h-4" />
              <span className="w-1 bg-[#E67E22] rounded-full animate-pulse h-3" style={{ animationDelay: '0.2s' }} />
              <span className="w-1 bg-[#E67E22] rounded-full animate-pulse h-5" style={{ animationDelay: '0.4s' }} />
              <span className="w-1 bg-[#E67E22] rounded-full animate-pulse h-2" style={{ animationDelay: '0.1s' }} />
            </div>
          ) : (
            <div className="w-2 h-2 rounded-full bg-white/30" />
          )}
          <span className="text-xs font-medium text-white/70">
            {musicTheme === 'off' || isMuted ? 'Muted' : SOUNDTRACK_OPTIONS.find(s => s.id === musicTheme)?.title || 'Playing Music'}
          </span>
        </div>

        {/* Center Playback Controls */}
        <div className="flex items-center gap-3 sm:gap-4 bg-white/10 backdrop-blur-xl px-4 sm:px-5 py-2 rounded-full border border-white/10 shadow-lg">
          {/* Shuffle Toggle */}
          <button
            type="button"
            onClick={() => setIsShuffle(!isShuffle)}
            className={`p-2 rounded-full transition-colors ${
              isShuffle ? 'text-[#E67E22] bg-[#E67E22]/20' : 'text-white/60 hover:text-white'
            }`}
            title="Shuffle Photos"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Previous */}
          <button
            type="button"
            onClick={prevSlide}
            className="p-2 rounded-full text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Play / Pause */}
          <button
            id="btn-slideshow-playpause"
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#E67E22] hover:bg-[#d47019] text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
            title={isPlaying ? "Pause (Space/P)" : "Play (Space/P)"}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          {/* Next */}
          <button
            type="button"
            onClick={nextSlide}
            className="p-2 rounded-full text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Next (Right Arrow/Space)"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Speed Selector Dropdown */}
          <div className="flex items-center gap-1 pl-2 border-l border-white/15 text-xs">
            <Clock className="w-3.5 h-3.5 text-white/50" />
            <select
              value={slideInterval}
              onChange={(e) => setSlideInterval(parseInt(e.target.value, 10))}
              className="bg-transparent text-white/80 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="3000" className="bg-[#1A1A1A]">3s</option>
              <option value="5000" className="bg-[#1A1A1A]">5s</option>
              <option value="8000" className="bg-[#1A1A1A]">8s</option>
              <option value="12000" className="bg-[#1A1A1A]">12s</option>
              <option value="20000" className="bg-[#1A1A1A]">20s</option>
            </select>
          </div>
        </div>

        {/* Right side: Mini Strip or Exit Quick Action */}
        <div className="flex items-center gap-3">
          {/* Thumbnail Mini Strip Navigation */}
          <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto max-w-xs py-1">
            {photos.slice(0, 8).map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`w-9 h-9 rounded-lg overflow-hidden border transition-all ${
                  currentIndex === idx ? 'border-[#E67E22] scale-110 shadow-md' : 'border-white/20 opacity-50 hover:opacity-100'
                }`}
              >
                <img src={p.thumbnailUrl} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          {/* Bottom Bar Exit Button for mobile & desktop */}
          <button
            id="btn-slideshow-bottom-exit"
            type="button"
            onClick={onClose}
            className="flex sm:hidden items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white/90 text-xs font-medium self-end"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Slideshow</span>
          </button>
        </div>
      </div>
    </div>
  );
};

