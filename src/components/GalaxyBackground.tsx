import React, { useEffect, useMemo, useRef } from 'react';
import { useTheme } from '../lib/theme';

interface StarDot {
  id: number;
  cx: number;
  cy: number;
  r: number;
  opacity: number;
  color: string;
  twinkle?: boolean;
  twinkleDuration?: number;
  twinkleDelay?: number;
  hasSpike?: boolean;
  spikeLen?: number;
}

interface GlowingCluster {
  id: number;
  x: number;
  y: number;
  size: number;
  gradient: string;
  opacity: number;
}

interface LightweightSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

const FIREWORK_COLORS = ['#FFD700', '#38BDF8', '#C084FC', '#34D399', '#FB7185', '#FFFFFF'];

/**
 * Deterministic PRNG using Mulberry32.
 * Ensures perfectly repeatable, non-linear pseudo-randomness across renders
 * with zero grid-line or diagonal alignment artifacts.
 */
function createPrng(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GalaxyBackground: React.FC = () => {
  const { isDark } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sparksRef = useRef<LightweightSpark[]>([]);
  const animFrameIdRef = useRef<number | null>(null);
  const isTabVisibleRef = useRef<boolean>(true);

  // Generate an organic, crowded, artistic celestial starfield
  const stars = useMemo<StarDot[]>(() => {
    const random = createPrng(8492041);
    const starList: StarDot[] = [];
    let starId = 0;

    const palette = [
      '#FFFFFF', // Diamond White Spark
      '#FFFFFF',
      '#FFFBEB', // Warm Champagne Sparkle
      '#FEF3C7', // Pale Golden Light
      '#FDE047', // Warm Solar Gold
      '#F59E0B', // Amber Flare Pinprick
      '#FBBF24', // Festival Gold
      '#E0E7FF'  // Cosmic Frost Starlight
    ];

    // Helper for clamped coords
    const clamp = (val: number, min = 1, max = 99) => Math.max(min, Math.min(max, val));

    // 1. DENSE GALACTIC RIFT (The Milky Way Band)
    // ~180 micro-stardust and stars flowing diagonally across the cosmos
    for (let i = 0; i < 180; i++) {
      const progress = random();
      // Diagonal curve with organic wave distortion
      const baseX = progress * 100;
      const baseY = progress * 100 + Math.sin(progress * Math.PI * 2.5) * 14;

      // Heavy concentration along the center with exponential falloff
      const offsetFactor = (random() - 0.5) * (random() - 0.5) * 58;
      const cx = clamp(baseX + offsetFactor * 0.9);
      const cy = clamp(baseY - offsetFactor * 0.9);

      const isMicro = random() > 0.28;
      const r = isMicro ? 0.18 + random() * 0.22 : 0.42 + random() * 0.35;
      const opacity = Number((0.18 + random() * 0.65).toFixed(2));
      const color = palette[Math.floor(random() * palette.length)];
      const twinkle = random() < 0.08;

      starList.push({
        id: starId++,
        cx: Number(cx.toFixed(2)),
        cy: Number(cy.toFixed(2)),
        r: Number(r.toFixed(2)),
        opacity,
        color,
        twinkle,
        twinkleDuration: twinkle ? 3 + Math.floor(random() * 4) : undefined,
        twinkleDelay: twinkle ? Math.floor(random() * 5) : undefined
      });
    }

    // 2. CELESTIAL OPEN CLUSTERS (Pleiades-like organic focal gatherings)
    // 3 distinct cluster epicenters with tight core density and loose halo stars
    const clusterCenters = [
      { x: 28, y: 24, radius: 14, count: 42, colorBias: '#BAE6FD' },
      { x: 74, y: 68, radius: 16, count: 48, colorBias: '#DDD6FE' },
      { x: 82, y: 22, radius: 12, count: 32, colorBias: '#FDE047' }
    ];

    clusterCenters.forEach((cluster) => {
      // Cluster core focal jewel star with 4-point diffraction spike
      starList.push({
        id: starId++,
        cx: cluster.x,
        cy: cluster.y,
        r: 1.1,
        opacity: 0.95,
        color: '#FFFFFF',
        twinkle: true,
        twinkleDuration: 4,
        twinkleDelay: 0.5,
        hasSpike: true,
        spikeLen: 2.8
      });

      for (let i = 0; i < cluster.count; i++) {
        // Square radial falloff for natural gravitational clustering
        const angle = random() * Math.PI * 2;
        const dist = Math.pow(random(), 1.6) * cluster.radius;
        const cx = clamp(cluster.x + Math.cos(angle) * dist);
        const cy = clamp(cluster.y + Math.sin(angle) * dist);

        const r = 0.2 + random() * 0.45;
        const opacity = Number((0.25 + random() * 0.65).toFixed(2));
        const color = random() < 0.4 ? cluster.colorBias : palette[Math.floor(random() * palette.length)];
        const twinkle = random() < 0.12;

        starList.push({
          id: starId++,
          cx: Number(cx.toFixed(2)),
          cy: Number(cy.toFixed(2)),
          r: Number(r.toFixed(2)),
          opacity,
          color,
          twinkle,
          twinkleDuration: twinkle ? 3 + Math.floor(random() * 4) : undefined,
          twinkleDelay: twinkle ? Math.floor(random() * 6) : undefined
        });
      }
    });

    // 3. BROAD ABSTRACT SCATTER (Fills deep space without any geometric grids)
    // ~140 organic field stars distributed across the entire canvas
    for (let i = 0; i < 140; i++) {
      const cx = clamp(random() * 100);
      const cy = clamp(random() * 100);
      const isBright = random() < 0.1;
      const r = isBright ? 0.75 + random() * 0.4 : 0.22 + random() * 0.38;
      const opacity = Number((0.2 + random() * 0.7).toFixed(2));
      const color = palette[Math.floor(random() * palette.length)];
      const twinkle = random() < 0.1;
      const hasSpike = isBright && random() < 0.5;

      starList.push({
        id: starId++,
        cx: Number(cx.toFixed(2)),
        cy: Number(cy.toFixed(2)),
        r: Number(r.toFixed(2)),
        opacity,
        color,
        twinkle,
        twinkleDuration: twinkle ? 3.5 + Math.floor(random() * 4) : undefined,
        twinkleDelay: twinkle ? Math.floor(random() * 5) : undefined,
        hasSpike,
        spikeLen: hasSpike ? 2.2 + random() * 1.0 : undefined
      });
    }

    return starList;
  }, []);

  // Generate subtle, glowing static 'star clusters' using randomized circular div elements
  const starClusters = useMemo<GlowingCluster[]>(() => {
    const random = createPrng(9273415);
    const clusters: GlowingCluster[] = [];

    const clusterTints = [
      { inner: 'rgba(245, 158, 11, 0.16)', mid: 'rgba(217, 119, 6, 0.05)' }, // Warm Amber Bokeh
      { inner: 'rgba(251, 191, 36, 0.15)', mid: 'rgba(245, 158, 11, 0.04)' }, // Golden Candlelight
      { inner: 'rgba(254, 243, 199, 0.15)', mid: 'rgba(251, 191, 36, 0.04)' }, // Champagne Sparkle
      { inner: 'rgba(255, 255, 255, 0.16)', mid: 'rgba(254, 243, 199, 0.04)' }, // Core Diamond Glint
      { inner: 'rgba(230, 126, 34, 0.14)', mid: 'rgba(194, 65, 12, 0.04)' },  // Ember Orange
      { inner: 'rgba(99, 102, 241, 0.09)', mid: 'rgba(49, 46, 129, 0.02)' }, // Deep Night Indigo
      { inner: 'rgba(244, 114, 182, 0.09)', mid: 'rgba(190, 24, 93, 0.02)' }, // Rose Amber
    ];

    // 1. Primary clusters aligned near major stellar gatherings
    const focalPositions = [
      { x: 28, y: 24, tintIdx: 1, size: 260 },
      { x: 74, y: 68, tintIdx: 2, size: 280 },
      { x: 82, y: 22, tintIdx: 3, size: 220 },
      { x: 45, y: 48, tintIdx: 0, size: 320 }, // Central galactic diffuse glow
    ];

    focalPositions.forEach((pos, idx) => {
      const tint = clusterTints[pos.tintIdx];
      clusters.push({
        id: idx,
        x: pos.x,
        y: pos.y,
        size: pos.size + Math.floor(random() * 60),
        gradient: `radial-gradient(circle, ${tint.inner} 0%, ${tint.mid} 45%, transparent 70%)`,
        opacity: Number((0.8 + random() * 0.2).toFixed(2))
      });
    });

    // 2. Randomized abstract celestial clusters
    for (let i = 4; i < 18; i++) {
      const x = Number((6 + random() * 88).toFixed(1));
      const y = Number((6 + random() * 88).toFixed(1));
      const size = Math.floor(130 + random() * 180);
      const tint = clusterTints[Math.floor(random() * clusterTints.length)];
      const opacity = Number((0.5 + random() * 0.45).toFixed(2));

      clusters.push({
        id: i,
        x,
        y,
        size,
        gradient: `radial-gradient(circle, ${tint.inner} 0%, ${tint.mid} 42%, transparent 70%)`,
        opacity
      });
    }

    return clusters;
  }, []);

  // Spawn lightweight sparks on tap/click
  const spawnSparkBurst = (x: number, y: number) => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const isLowEnd = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 4) <= 2;
    if (isLowEnd) return;

    const baseColor = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    const sparkCount = 14;

    for (let i = 0; i < sparkCount; i++) {
      const angle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.4;
      const speed = 1.8 + Math.random() * 2.8;

      sparksRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 1.5,
        color: baseColor,
        alpha: 0.9,
        decay: 0.025 + Math.random() * 0.018
      });
    }

    if (sparksRef.current.length > 40) {
      sparksRef.current.splice(0, sparksRef.current.length - 40);
    }

    if (!animFrameIdRef.current && isTabVisibleRef.current) {
      animFrameIdRef.current = requestAnimationFrame(runAnimationLoop);
    }
  };

  const runAnimationLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas || !isDark || !isTabVisibleRef.current) {
      animFrameIdRef.current = null;
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animFrameIdRef.current = null;
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, width, height);

    const sparks = sparksRef.current;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.04;
      s.vx *= 0.98;
      s.alpha -= s.decay;

      if (s.alpha <= 0.02) {
        sparks.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, s.alpha);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (sparks.length > 0 && isTabVisibleRef.current) {
      animFrameIdRef.current = requestAnimationFrame(runAnimationLoop);
    } else {
      animFrameIdRef.current = null;
      ctx.clearRect(0, 0, width, height);
    }
  };

  useEffect(() => {
    if (!isDark) return;

    const handleVisibilityChange = () => {
      isTabVisibleRef.current = !document.hidden;
      if (document.hidden) {
        if (animFrameIdRef.current) {
          cancelAnimationFrame(animFrameIdRef.current);
          animFrameIdRef.current = null;
        }
        sparksRef.current = [];
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const setupCanvas = () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = window.innerWidth;
      const h = window.innerHeight;

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    setupCanvas();
    window.addEventListener('resize', setupCanvas);

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== undefined && e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const isInteractive = target.closest(
          'button, a, input, textarea, select, [role="button"], [id^="photo-card"], [id^="btn-"], dialog, aside, header'
        );
        if (isInteractive) return;
      }
      spawnSparkBurst(e.clientX, e.clientY);
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', setupCanvas);
      window.removeEventListener('pointerdown', handlePointerDown);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      sparksRef.current = [];
    };
  }, [isDark]);

  if (!isDark) {
    return null;
  }

  return (
    <div
      id="galaxy-cosmic-backdrop"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      style={{
        contain: 'strict',
        contentVisibility: 'auto'
      }}
    >
      {/* 
        High-Performance Static Cosmic Mesh Background 
        Rich interstellar color grades with zero blur overhead and 0% CPU 
      */}
      <div 
        className="absolute inset-0 bg-[#020104]"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 85% 65% at 50% 65%, rgba(230, 126, 34, 0.08) 0%, transparent 60%),
            radial-gradient(ellipse 70% 55% at 22% 22%, rgba(245, 158, 11, 0.06) 0%, transparent 55%),
            radial-gradient(ellipse 75% 60% at 78% 28%, rgba(251, 191, 36, 0.05) 0%, transparent 55%),
            radial-gradient(ellipse 90% 80% at 65% 85%, rgba(30, 27, 46, 0.28) 0%, transparent 65%),
            radial-gradient(circle at 50% 50%, rgba(2, 1, 4, 0.9) 0%, #020104 100%)
          `
        }}
      />

      {/* 
        Subtle Glowing 'Star Clusters' (Randomized Circular Divs with Low-Opacity Gradients)
        Static and abstract - adds celestial depth and luminous aura with zero CPU load
      */}
      <div 
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        {starClusters.map((cluster) => (
          <div
            key={`star-cluster-${cluster.id}`}
            className="absolute rounded-full pointer-events-none select-none"
            style={{
              left: `${cluster.x}%`,
              top: `${cluster.y}%`,
              width: `${cluster.size}px`,
              height: `${cluster.size}px`,
              transform: 'translate(-50%, -50%)',
              background: cluster.gradient,
              opacity: cluster.opacity,
              mixBlendMode: 'screen',
              contain: 'layout paint'
            }}
          />
        ))}
      </div>

      {/* 
        Abstract & Crowded Artistic SVG Celestial Field
        Rendered as a single GPU layer with zero layout reflows and zero CPU churn
      */}
      <svg 
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="celestial-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.4" />
          </filter>
        </defs>

        {stars.map((star) => (
          <g key={star.id}>
            {/* Diffuse soft halo for brighter stars */}
            {star.r > 0.65 && (
              <circle
                cx={star.cx}
                cy={star.cy}
                r={star.r * 1.8}
                fill={star.color}
                opacity={star.opacity * 0.3}
                filter="url(#celestial-glow)"
              />
            )}

            {/* Primary Star Core */}
            <circle
              cx={star.cx}
              cy={star.cy}
              r={star.r * 0.35}
              fill={star.color}
              opacity={star.opacity}
              className={star.twinkle ? 'animate-pulse' : undefined}
              style={
                star.twinkle
                  ? {
                      animationDuration: `${star.twinkleDuration || 4}s`,
                      animationDelay: `${star.twinkleDelay || 0}s`
                    }
                  : undefined
              }
            />

            {/* Artistic 4-Point Astronomical Cross Flare for Jewel Stars */}
            {star.hasSpike && star.spikeLen && (
              <path
                d={`
                  M ${star.cx} ${star.cy - star.spikeLen * 0.4}
                  Q ${star.cx} ${star.cy} ${star.cx + star.spikeLen * 0.4} ${star.cy}
                  Q ${star.cx} ${star.cy} ${star.cx} ${star.cy + star.spikeLen * 0.4}
                  Q ${star.cx} ${star.cy} ${star.cx - star.spikeLen * 0.4} ${star.cy}
                  Q ${star.cx} ${star.cy} ${star.cx} ${star.cy - star.spikeLen * 0.4} Z
                `}
                fill={star.color}
                opacity={star.opacity * 0.7}
                className={star.twinkle ? 'animate-pulse' : undefined}
                style={
                  star.twinkle
                    ? {
                        animationDuration: `${star.twinkleDuration || 4}s`,
                        animationDelay: `${star.twinkleDelay || 0}s`
                      }
                    : undefined
                }
              />
            )}
          </g>
        ))}
      </svg>

      {/* Subtle Shooting Meteor */}
      <div className="galaxy-shooting-star shooting-star-1" />

      {/* On-Demand Spark Burst Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />
    </div>
  );
};
