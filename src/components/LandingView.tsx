import React, { useEffect, useState } from 'react';
import { 
  Sparkles, 
  Camera, 
  QrCode, 
  ArrowRight, 
  Download, 
  Users, 
  Plus, 
  Clock, 
  Lock, 
  ShieldCheck,
  Music,
  Play,
  WifiOff,
  X
} from 'lucide-react';
import { useNetworkStatus } from '../lib/sw-manager';

interface LandingViewProps {
  onCreateEvent: () => void;
  onJoinEvent: () => void;
  onSelectEvent: (code: string) => void;
  onOpenAdmin?: () => void;
}

interface RecentEvent {
  code: string;
  name: string;
  hostKey?: string;
  isHost?: boolean;
  date?: string;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onCreateEvent,
  onJoinEvent,
  onSelectEvent,
  onOpenAdmin
}) => {
  const network = useNetworkStatus();
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);

  useEffect(() => {
    try {
      // Clean out any legacy demo event 'summer-party' from local caches if present
      const cleanLocalStorageArray = (key: string) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((item: any) => item && item.code && item.code !== 'summer-party' && item.code !== 'demo-event-01');
            localStorage.setItem(key, JSON.stringify(filtered));
            return filtered;
          }
        } catch {}
        return [];
      };

      const hostEvents = cleanLocalStorageArray('momento_host_events');
      const visitedEvents = cleanLocalStorageArray('momento_visited_events');
      
      const map = new Map<string, RecentEvent>();
      
      for (const h of hostEvents) {
        if (h && h.code) {
          map.set(h.code, {
            code: h.code,
            name: h.name || h.code,
            hostKey: h.hostKey,
            isHost: true
          });
        }
      }

      for (const v of visitedEvents) {
        if (v && v.code && !map.has(v.code)) {
          map.set(v.code, {
            code: v.code,
            name: v.name || v.code,
            isHost: false
          });
        }
      }

      setRecentEvents(Array.from(map.values()).slice(0, 5));
    } catch (e) {}
  }, []);

  const handleClearRecentEvents = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      localStorage.removeItem('momento_visited_events');
      localStorage.removeItem('momento_host_events');
      setRecentEvents([]);
    } catch (err) {}
  };

  const handleRemoveSingleRecent = (e: React.MouseEvent, codeToRemove: string) => {
    e.stopPropagation();
    try {
      const filterKey = (key: string) => {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((item: any) => item && item.code !== codeToRemove);
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      };
      filterKey('momento_visited_events');
      filterKey('momento_host_events');
      setRecentEvents(prev => prev.filter(item => item.code !== codeToRemove));
    } catch (err) {}
  };

  // Keyboard shortcut listener for hidden Admin Portal (Alt + A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        onOpenAdmin?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenAdmin]);

  return (
    <div id="landing-view-container" className="min-h-screen flex flex-col justify-between bg-[#F5F2ED] dark:bg-transparent text-[#1A1A1A] dark:text-[#F3F1EC] relative overflow-hidden transition-colors duration-200">
      {/* Subtle Static Ambient Background Glow (Zero CPU) */}
      <div 
        className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-60" 
        style={{
          background: 'radial-gradient(circle, rgba(230, 126, 34, 0.12) 0%, transparent 70%)'
        }}
      />
      <div 
        className="pointer-events-none absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-40" 
        style={{
          background: 'radial-gradient(circle, rgba(230, 126, 34, 0.08) 0%, transparent 70%)'
        }}
      />

      {/* Top Brand Bar */}
      <header className="px-6 py-6 sm:py-8 max-w-4xl mx-auto w-full flex items-center justify-between relative z-10">
        <div 
          onClick={onOpenAdmin}
          className="flex items-center gap-2.5 cursor-pointer group"
          title="MOMENTO (Double-click or Alt+A for Admin Vault)"
        >
          <picture>
            <source media="(prefers-color-scheme: dark)" srcSet="/momento.svg" />
            <img src="/momento 1.svg" alt="MOMENTO" className="w-10 h-10 rounded-2xl object-cover shadow-xs group-hover:scale-105 transition-transform" />
          </picture>
          <span className="text-lg font-bold tracking-tight font-display text-[#1A1A1A] dark:text-white">MOMENTO</span>
        </div>

        <div className="flex items-center gap-2">
          {!network.isOnline && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-semibold">
              <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Offline Mode</span>
            </div>
          )}

          {onOpenAdmin && (
            <button
              id="btn-landing-admin-quick"
              type="button"
              onClick={onOpenAdmin}
              className="p-2 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-white/10 transition-colors"
              title="Admin Portal (Alt + A)"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}

          <button
            id="btn-landing-join-top"
            type="button"
            onClick={onJoinEvent}
            className="text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white bg-white dark:bg-[#08070D]/90 border border-gray-200 dark:border-white/10 px-4 py-2 rounded-full shadow-2xs hover:bg-gray-50 dark:hover:bg-[#12101A] transition-all active:scale-95 min-h-[38px] cursor-pointer"
          >
            Join an Event
          </button>
        </div>
      </header>

      {/* Main Clean Minimalist Card Layout with Interactive Motion */}
      <main className="flex-1 flex flex-col justify-center px-4 py-6 max-w-md mx-auto w-full relative z-10 animate-fade-in">
        {/* Floating Mini Photo Strips Mockup for Visual Delight */}
        <div className="flex items-center justify-center -space-x-3 mb-6">
          <div className="w-16 h-20 rounded-2xl bg-white dark:bg-[#060509] border border-gray-200 dark:border-white/10 shadow-md p-1.5 transform -rotate-6 hover:rotate-0 transition-transform duration-300 hover:z-20 cursor-default">
            <img 
              src="https://images.unsplash.com/photo-1519741497674-611481863552?w=300&auto=format&fit=crop&q=80" 
              alt="" 
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <div className="w-20 h-24 rounded-2xl bg-white dark:bg-[#060509] border border-gray-200 dark:border-amber-500/30 shadow-xl dark:shadow-[0_0_24px_rgba(230,126,34,0.18)] p-1.5 transform -translate-y-2 hover:scale-105 transition-transform duration-300 z-10 cursor-default">
            <img 
              src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=300&auto=format&fit=crop&q=80" 
              alt="" 
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <div className="w-16 h-20 rounded-2xl bg-white dark:bg-[#060509] border border-gray-200 dark:border-white/10 shadow-md p-1.5 transform rotate-6 hover:rotate-0 transition-transform duration-300 hover:z-20 cursor-default">
            <img 
              src="https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=300&auto=format&fit=crop&q=80" 
              alt="" 
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0B0A12]/95 dark:backdrop-blur-2xl rounded-[36px] shadow-xl border border-stone-300/90 dark:border-white/20 dark:shadow-[0_24px_60px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.06),0_0_30px_rgba(230,126,34,0.08)] p-6 sm:p-8 text-center overflow-hidden relative transition-all hover:shadow-2xl">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-stone-100 dark:bg-white/10 border border-stone-200 dark:border-white/15 text-stone-700 dark:text-stone-200 text-[10px] font-bold uppercase tracking-widest mb-4">
            <Sparkles className="w-3 h-3 text-[#E67E22]" />
            <span>One event. Everyone’s moments.</span>
          </div>

          <picture className="block mx-auto mb-4">
            <source media="(prefers-color-scheme: dark)" srcSet="/momento.svg" />
            <img src="/momento 1.svg" alt="MOMENTO" className="w-28 h-28 sm:w-32 sm:h-32 rounded-[28px] object-cover mx-auto shadow-lg" />
          </picture>
          <h1 className="sr-only">MOMENTO</h1>
          <p className="text-sm font-medium text-stone-600 dark:text-stone-300 mb-8 max-w-xs mx-auto leading-relaxed">
            Every moment. One place.
          </p>

          {/* Action Buttons */}
          <div className="space-y-3 px-1 sm:px-3 mb-8">
            <button
              id="btn-landing-create-event"
              type="button"
              onClick={onCreateEvent}
              className="w-full bg-[#1A1A1A] dark:bg-white dark:text-black hover:bg-black dark:hover:bg-gray-100 text-white py-4 px-6 rounded-2xl font-semibold cursor-pointer shadow-md active:scale-[0.98] transition-all min-h-[52px] flex items-center justify-center gap-2 text-sm sm:text-base group"
            >
              <Plus className="w-5 h-5 text-[#E67E22] stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
              <span>Create an Event</span>
            </button>

            <button
              id="btn-landing-join-event"
              type="button"
              onClick={onJoinEvent}
              className="w-full border border-stone-300 dark:border-white/20 bg-white dark:bg-[#14121F] hover:bg-stone-50 dark:hover:bg-[#1A1728] text-stone-900 dark:text-white py-4 px-6 rounded-2xl font-semibold cursor-pointer shadow-2xs active:scale-[0.98] transition-all min-h-[52px] flex items-center justify-center gap-2 text-sm sm:text-base group"
            >
              <QrCode className="w-4 h-4 text-[#E67E22] group-hover:scale-110 transition-transform" />
              <span>Join an Event</span>
            </button>
          </div>

          {/* 3 Core Value Pillars */}
          <div className="grid grid-cols-3 gap-2.5 pt-6 border-t border-stone-200 dark:border-white/15 text-left">
            <div className="hover:translate-y-[-2px] transition-transform">
              <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-white/10 border border-stone-200 dark:border-white/15 flex items-center justify-center text-[#E67E22] mb-2">
                <QrCode className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs font-bold text-stone-900 dark:text-white">Instant QR</div>
              <div className="text-[11px] font-medium text-stone-600 dark:text-stone-300 mt-0.5 leading-tight">Zero friction join</div>
            </div>

            <div className="hover:translate-y-[-2px] transition-transform">
              <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-white/10 border border-stone-200 dark:border-white/15 flex items-center justify-center text-[#E67E22] mb-2">
                <Music className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs font-bold text-stone-900 dark:text-white">Slideshow</div>
              <div className="text-[11px] font-medium text-stone-600 dark:text-stone-300 mt-0.5 leading-tight">Soundtrack vibe</div>
            </div>

            <div className="hover:translate-y-[-2px] transition-transform">
              <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-white/10 border border-stone-200 dark:border-white/15 flex items-center justify-center text-[#E67E22] mb-2">
                <Download className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs font-bold text-stone-900 dark:text-white">Originals</div>
              <div className="text-[11px] font-medium text-stone-600 dark:text-stone-300 mt-0.5 leading-tight">Raw camera files</div>
            </div>
          </div>
        </div>

        {/* Recent Galleries Container */}
        {recentEvents.length > 0 && (
          <div className="mt-5 bg-[#FDFCF9] dark:bg-[#060509]/90 dark:backdrop-blur-xl rounded-3xl border border-dashed border-gray-300 dark:border-white/10 p-5 text-left shadow-2xs">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-[#E67E22]" /> Recent Galleries
              </span>
              <button
                type="button"
                onClick={handleClearRecentEvents}
                className="text-[10px] text-gray-400 hover:text-red-500 font-medium lowercase tracking-normal transition-colors"
                title="Clear all recent history"
              >
                clear history
              </button>
            </div>

            <div className="space-y-2">
              {recentEvents.map((ev) => (
                <div
                  key={ev.code}
                  id={`recent-event-${ev.code}`}
                  onClick={() => onSelectEvent(ev.code)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-[#0C0B12] border border-gray-200/80 dark:border-white/10 hover:border-gray-400 dark:hover:border-amber-500/30 cursor-pointer active:scale-[0.99] transition-all shadow-2xs group relative"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-[#1A1A1A] dark:text-white truncate">
                        {ev.name}
                      </span>
                      {ev.isHost && (
                        <span className="px-1.5 py-0.2 text-[9px] rounded bg-[#1A1A1A] dark:bg-white dark:text-black text-white font-medium">
                          Host
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                      /e/{ev.code}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => handleRemoveSingleRecent(e, ev.code)}
                      className="p-1 rounded-lg text-gray-300 dark:text-gray-500 hover:text-red-500 hover:bg-gray-50 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                      title="Remove from recents"
                      aria-label="Remove from recents"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-500 group-hover:text-[#E67E22] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Minimal Footer with Hidden Admin Link */}
      <footer className="px-6 py-5 text-center text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200/60 dark:border-white/10 max-w-md mx-auto w-full pb-safe flex items-center justify-between">
        <span>MOMENTO • Every moment. One place.</span>
        {onOpenAdmin && (
          <button
            type="button"
            onClick={onOpenAdmin}
            className="text-[10px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 transition-colors"
            title="Admin Vault (Alt + A)"
          >
            <ShieldCheck className="w-3 h-3" />
            <span>Admin</span>
          </button>
        )}
      </footer>
    </div>
  );
};
