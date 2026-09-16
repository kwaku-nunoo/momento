import React from 'react';

// Varied aspect ratios and heights to mimic real-world photo orientations (portrait, square, landscape)
const SKELETON_ITEMS = [
  { id: 'sk-1', aspect: 'aspect-[3/4]', heightClass: 'h-64 sm:h-72' },
  { id: 'sk-2', aspect: 'aspect-[1/1]', heightClass: 'h-48 sm:h-56' },
  { id: 'sk-3', aspect: 'aspect-[4/5]', heightClass: 'h-72 sm:h-80' },
  { id: 'sk-4', aspect: 'aspect-[16/9]', heightClass: 'h-44 sm:h-52' },
  { id: 'sk-5', aspect: 'aspect-[3/4]', heightClass: 'h-60 sm:h-68' },
  { id: 'sk-6', aspect: 'aspect-[1/1]', heightClass: 'h-52 sm:h-60' },
  { id: 'sk-7', aspect: 'aspect-[4/3]', heightClass: 'h-48 sm:h-56' },
  { id: 'sk-8', aspect: 'aspect-[3/4]', heightClass: 'h-64 sm:h-72' },
  { id: 'sk-9', aspect: 'aspect-[9/16]', heightClass: 'h-80 sm:h-96' },
  { id: 'sk-10', aspect: 'aspect-[1/1]', heightClass: 'h-52 sm:h-60' },
  { id: 'sk-11', aspect: 'aspect-[4/5]', heightClass: 'h-68 sm:h-76' },
  { id: 'sk-12', aspect: 'aspect-[3/2]', heightClass: 'h-46 sm:h-54' },
];

export const GallerySkeleton: React.FC = () => {
  return (
    <div
      id="gallery-skeleton-container"
      className="min-h-screen bg-[#F5F2ED] dark:bg-[#020104] text-[#1A1A1A] dark:text-[#F3F1EC] flex flex-col animate-fade-in"
      aria-busy="true"
      aria-label="Loading gallery moments"
    >
      {/* Header Skeleton Bar */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#020104]/80 backdrop-blur-md border-b border-gray-200/60 dark:border-white/10 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Back button & Title shimmer */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-gray-200/90 dark:bg-white/10 animate-pulse flex-shrink-0" />
            <div className="space-y-1.5 min-w-0">
              <div className="w-16 h-2.5 rounded-full bg-gray-200/80 dark:bg-white/10 animate-pulse" />
              <div className="w-32 sm:w-48 h-4 rounded-lg bg-gray-300/80 dark:bg-white/15 animate-pulse" />
            </div>
          </div>

          {/* Right: Actions pills shimmer */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden xs:block w-20 h-8 rounded-full bg-gray-200/80 dark:bg-white/10 animate-pulse" />
            <div className="w-24 h-8 rounded-full bg-gray-200/80 dark:bg-white/10 animate-pulse" />
            <div className="w-8 h-8 rounded-full bg-gray-200/80 dark:bg-white/10 animate-pulse" />
          </div>
        </div>
      </header>

      {/* Sub-bar / Gallery Summary Meta Bar Skeleton */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-24 h-6 rounded-full bg-gray-200/80 dark:bg-white/10 animate-pulse" />
          <div className="w-20 h-6 rounded-full bg-gray-200/70 dark:bg-white/10 animate-pulse" />
        </div>
        <div className="w-28 h-4 rounded-full bg-gray-200/60 dark:bg-white/10 animate-pulse hidden sm:block" />
      </div>

      {/* Responsive Masonry Photo Grid Skeletons */}
      <main className="w-full px-2.5 sm:px-4 md:px-6 pb-28 pt-2 max-w-7xl mx-auto">
        <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-2.5 sm:gap-3.5 [column-fill:_balance]">
          {SKELETON_ITEMS.map((item, idx) => (
            <div
              key={item.id}
              className={`relative mb-2.5 sm:mb-3.5 break-inside-avoid overflow-hidden rounded-xl sm:rounded-2xl bg-[#EBE7E0] dark:bg-[#18171F] border border-black/[0.04] dark:border-white/[0.08] shadow-xs ${item.aspect}`}
              style={{
                animationDelay: `${idx * 60}ms`,
              }}
            >
              {/* Pulsing Base Shimmer */}
              <div className="absolute inset-0 bg-gradient-to-tr from-[#E6E1D8] via-[#F2EDE4] to-[#E6E1D8] dark:from-[#1E1C26] dark:via-[#262432] dark:to-[#1E1C26] animate-pulse" />

              {/* Dynamic Wave Light Highlight */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" 
                style={{
                  animationDelay: `${(idx % 4) * 0.35}s`
                }}
              />

              {/* Polaroid/Camera Viewfinder Subtle Reticle Marker */}
              <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-black/10 dark:bg-white/10" />

              {/* Bottom Metadata Bar Placeholder */}
              <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3 bg-gradient-to-t from-black/25 dark:from-black/40 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-white/40 dark:bg-white/20 animate-pulse" />
                  <div className="w-14 sm:w-18 h-2 rounded-full bg-white/40 dark:bg-white/20 animate-pulse" />
                </div>
                <div className="w-8 h-2 rounded-full bg-white/30 dark:bg-white/15 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Floating Bottom Upload Button Skeleton */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <div className="h-12 w-36 rounded-full bg-[#1A1A1A]/80 dark:bg-white/80 shadow-xl backdrop-blur-md flex items-center justify-center gap-2 px-4 animate-pulse">
          <div className="w-4 h-4 rounded-full bg-[#E67E22]/90" />
          <div className="w-16 h-3 rounded-full bg-white/60 dark:bg-black/40" />
        </div>
      </div>
    </div>
  );
};
