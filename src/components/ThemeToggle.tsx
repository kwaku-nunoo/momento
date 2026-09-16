import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../lib/theme';

interface ThemeToggleProps {
  id?: string;
  className?: string;
  floating?: boolean;
}

type Side = 'left' | 'right';

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  id = 'btn-theme-toggle',
  className = '',
  floating = false
}) => {
  const { isDark, toggleTheme } = useTheme();

  // Floating Position State (Persisted in localStorage)
  const [side, setSide] = useState<Side>(() => {
    if (typeof window === 'undefined') return 'right';
    try {
      const saved = localStorage.getItem('momento_theme_toggle_side');
      if (saved === 'left' || saved === 'right') return saved;
    } catch {}
    return 'right';
  });

  // Vertical position as percentage from top (default 50%)
  const [topPercent, setTopPercent] = useState<number>(() => {
    if (typeof window === 'undefined') return 50;
    try {
      const saved = localStorage.getItem('momento_theme_toggle_y');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 12 && parsed <= 85) return parsed;
      }
    } catch {}
    return 50;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number; moved: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Save side & vertical preferences
  const updateSide = (newSide: Side, newTopPercent?: number) => {
    setSide(newSide);
    try {
      localStorage.setItem('momento_theme_toggle_side', newSide);
      if (newTopPercent !== undefined) {
        setTopPercent(newTopPercent);
        localStorage.setItem('momento_theme_toggle_y', newTopPercent.toString());
      }
    } catch {}
  };

  // Flip sides manually on button click
  const toggleSide = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateSide(side === 'right' ? 'left' : 'right');
  };

  // Touch / Pointer Drag Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!floating) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: rect.left + rect.width / 2,
      initialY: rect.top + rect.height / 2,
      moved: false
    };

    buttonRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance > 6) {
      dragStartRef.current.moved = true;
      setIsDragging(true);
      setDragPos({
        x: Math.max(24, Math.min(window.innerWidth - 24, e.clientX)),
        y: Math.max(60, Math.min(window.innerHeight - 60, e.clientY))
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    const wasMoved = dragStartRef.current.moved;
    
    if (wasMoved && dragPos) {
      // Determine side based on release X coordinate
      const screenWidth = window.innerWidth;
      const finalSide: Side = dragPos.x < screenWidth / 2 ? 'left' : 'right';
      
      // Calculate top percentage clamped between 15% and 85%
      const screenHeight = window.innerHeight;
      const finalTop = Math.max(15, Math.min(85, (dragPos.y / screenHeight) * 100));

      updateSide(finalSide, finalTop);
    } else {
      // Tap without dragging -> toggle theme
      toggleTheme();
    }

    try {
      buttonRef.current?.releasePointerCapture(e.pointerId);
    } catch {}

    dragStartRef.current = null;
    setIsDragging(false);
    setDragPos(null);
  };

  if (floating) {
    const isLeft = side === 'left';
    
    const floatingStyle: React.CSSProperties = isDragging && dragPos
      ? {
          position: 'fixed',
          left: `${dragPos.x}px`,
          top: `${dragPos.y}px`,
          transform: 'translate(-50%, -50%)',
          zIndex: 60,
          touchAction: 'none'
        }
      : {
          position: 'fixed',
          top: `${topPercent}%`,
          transform: 'translateY(-50%)',
          left: isLeft ? '14px' : 'auto',
          right: isLeft ? 'auto' : '14px',
          zIndex: 45,
          touchAction: 'none'
        };

    return (
      <aside
        id="floating-theme-container"
        aria-label="Draggable Theme Switcher"
        style={floatingStyle}
        className="select-none transition-[left,right,top] duration-300 ease-out group"
      >
        <div className="relative flex items-center">
          {/* Side flip button on hover for quick switching */}
          <button
            type="button"
            onClick={toggleSide}
            title={`Move to ${isLeft ? 'Right' : 'Left'} side`}
            aria-label={`Move to ${isLeft ? 'Right' : 'Left'} side`}
            className={`hidden sm:flex absolute ${
              isLeft ? '-right-7' : '-left-7'
            } w-6 h-6 rounded-full bg-white dark:bg-[#0E0D18] border border-gray-200 dark:border-white/20 text-gray-500 hover:text-black dark:text-gray-300 dark:hover:text-white items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md cursor-pointer hover:scale-110 active:scale-90 z-10`}
          >
            {isLeft ? <ChevronRight className="w-3.5 h-3.5 text-[#E67E22]" /> : <ChevronLeft className="w-3.5 h-3.5 text-[#E67E22]" />}
          </button>

          {/* Main Floating Orb Button */}
          <button
            ref={buttonRef}
            id={id}
            type="button"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            aria-label={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
            title={`Click: ${isDark ? 'Light' : 'Dark'} mode • Drag/Hold to move left or right`}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full backdrop-blur-md border shadow-2xl flex items-center justify-center transition-all duration-200 select-none cursor-grab active:cursor-grabbing ${
              isDragging ? 'scale-115 shadow-2xl ring-4 ring-[#E67E22]/40 opacity-95' : 'hover:scale-108 active:scale-95'
            } ${
              isDark
                ? 'bg-[#0A0912]/95 border-white/25 text-amber-300 hover:bg-[#141222] hover:border-amber-400/60 shadow-black/60'
                : 'bg-white/95 border-gray-200 text-gray-800 hover:bg-white hover:border-gray-300 shadow-gray-400/30'
            } ${className}`}
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-amber-300 transition-transform duration-300 group-hover:rotate-45" />
            ) : (
              <Moon className="w-5 h-5 text-gray-800 transition-transform duration-300 group-hover:-rotate-15" />
            )}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <button
      id={id}
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
      title={isDark ? 'Click Sun for Light mode' : 'Click Moon for Dark mode'}
      className={`w-9 h-9 min-w-[36px] min-h-[36px] rounded-full border flex items-center justify-center transition-all duration-200 cursor-pointer select-none active:scale-90 shadow-2xs ${
        isDark
          ? 'bg-[#0A0912] border-white/20 text-amber-300 hover:bg-[#151324] hover:border-amber-400/50 hover:text-amber-200'
          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-black hover:border-gray-300'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-300 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-gray-700 transition-transform duration-300 rotate-0 hover:-rotate-12" />
      )}
    </button>
  );
};
