/**
 * MOMENTO Slideshow Audio Engine
 * Provides procedural Web Audio ambient harmonic soundscapes matching event themes
 * + custom user MP3 / audio file / audio stream playback support.
 */

export type MusicTheme = 'acoustic' | 'party' | 'birthday' | 'sunset' | 'lofi' | 'cinematic' | 'custom' | 'off' | 'birthday-classic' | 'birthday-celebration' | 'summer-party' | 'party-pop' | 'indian-wedding' | 'wedding-romance' | 'wedding-romance-alt' | 'wedding-romance-live' | 'lofi-gathering';

export interface SoundtrackOption {
  id: MusicTheme;
  title: string;
  subtitle: string;
  icon: string;
  vibe: string;
  source?: string;
}

export const SOUNDTRACK_OPTIONS: SoundtrackOption[] = [
  {
    id: 'birthday-classic',
    title: 'Happy Birthday Classic',
    subtitle: 'A cheerful birthday celebration track',
    icon: '🎂',
    vibe: 'Bright, familiar & festive',
    source: '/freemusicforvideo-happy-birthday-401919.mp3'
  },
  {
    id: 'birthday-celebration',
    title: 'Birthday Celebration',
    subtitle: 'An upbeat birthday party soundtrack',
    icon: '🎈',
    vibe: 'Bouncy, joyful & playful',
    source: '/gr0za-birthday-happy-birthday-503371.mp3'
  },
  {
    id: 'summer-party',
    title: 'Summer Party',
    subtitle: 'Sunny music for outdoor memories',
    icon: '☀️',
    vibe: 'Warm, carefree & energetic',
    source: '/atlasaudio-summer-party-590004.mp3'
  },
  {
    id: 'party-pop',
    title: 'Party Pop',
    subtitle: 'A lively all-purpose celebration track',
    icon: '🎉',
    vibe: 'Upbeat, colorful & high-energy',
    source: '/aurectheme-party-music-591808.mp3'
  },
  {
    id: 'indian-wedding',
    title: 'Indian Wedding Glow',
    subtitle: 'Festive music for wedding celebrations',
    icon: '💛',
    vibe: 'Joyful, rich & ceremonial',
    source: '/mondamusic-indian-wedding-589122.mp3'
  },
  {
    id: 'wedding-romance',
    title: 'Wedding Romance',
    subtitle: 'Warm romantic music for treasured moments',
    icon: '💍',
    vibe: 'Tender, elegant & heartfelt',
    source: '/leberch-wedding-584474.mp3'
  },
  {
    id: 'wedding-romance-alt',
    title: 'Wedding Romance II',
    subtitle: 'A second romantic wedding selection',
    icon: '🌹',
    vibe: 'Soft, intimate & timeless',
    source: '/paulyudin-wedding-485932.mp3'
  },
  {
    id: 'wedding-romance-live',
    title: 'Wedding Romance III',
    subtitle: 'An alternate edit for wedding memories',
    icon: '✨',
    vibe: 'Graceful, warm & cinematic',
    source: '/paulyudin-wedding-485932%20(1).mp3'
  },
  {
    id: 'lofi-gathering',
    title: 'Lofi Gathering',
    subtitle: 'Relaxed background music for cozy moments',
    icon: '☕',
    vibe: 'Chill, intimate & mellow',
    source: '/zephiramusic-lofi-music-577896.mp3'
  },
  {
    id: 'custom',
    title: 'Your Song',
    subtitle: 'Upload an MP3, WAV, M4A, or AAC file',
    icon: '🎵',
    vibe: 'Use the song you choose'
  },
  {
    id: 'off',
    title: 'Muted (Silent)',
    subtitle: 'Visual slideshow only with no background music',
    icon: '🔇',
    vibe: 'Quiet & serene'
  }
];

class SlideshowAudioEngine {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying = false;
  private currentTheme: MusicTheme = 'acoustic';
  private timerId: number | null = null;
  private volume = 0.5;
  private customAudio: HTMLAudioElement | null = null;
  private customAudioUrl: string | null = null;
  private customObjectUrl: string | null = null;
  private customAudioTitle: string = 'Custom Track';
  private startedAt = 0;

  private initAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
    if (this.customAudio) {
      this.customAudio.volume = this.volume;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setCustomAudio(fileOrUrl: File | string, title?: string) {
    if (this.customAudio) {
      this.customAudio.pause();
      this.customAudio.src = '';
    }
    if (this.customObjectUrl) {
      URL.revokeObjectURL(this.customObjectUrl);
      this.customObjectUrl = null;
    }

    if (typeof fileOrUrl === 'string') {
      this.customAudioUrl = fileOrUrl;
      this.customAudioTitle = title || 'Streamed Audio Track';
    } else {
      this.customAudioUrl = URL.createObjectURL(fileOrUrl);
      this.customObjectUrl = this.customAudioUrl;
      this.customAudioTitle = title || fileOrUrl.name.replace(/\.[^/.]+$/, '');
    }

    this.customAudio = new Audio(this.customAudioUrl);
    this.customAudio.muted = false;
    this.customAudio.setAttribute('playsinline', 'true');
    this.customAudio.preload = 'auto';
    this.customAudio.loop = true;
    this.customAudio.volume = this.volume;
    this.customAudio.load();

    if (this.isPlaying && this.currentTheme === 'custom') {
      this.customAudio.play().catch(e => console.warn('Custom audio playback error:', e));
    }
  }

  public playCustomAudio() {
    if (!this.customAudio) {
      return Promise.reject(new Error('No custom audio has been selected.'));
    }
    this.currentTheme = 'custom';
    this.isPlaying = true;
    this.initAudioContext();
    this.customAudio.muted = false;

    const audio = this.customAudio;
    const start = () => audio.play().catch((error) => {
      const mediaError = audio.error;
      throw new Error(mediaError ? `Audio playback failed (code ${mediaError.code}).` : error?.message || 'Audio playback was blocked.');
    });

    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      return start();
    }

    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);
      };
      const onCanPlay = () => {
        cleanup();
        start().then(resolve).catch(reject);
      };
      const onError = () => {
        cleanup();
        reject(new Error(`Audio file could not be loaded (code ${audio.error?.code || 'unknown'}).`));
      };
      audio.addEventListener('canplay', onCanPlay, { once: true });
      audio.addEventListener('error', onError, { once: true });
      audio.load();
    });
  }

  public getCustomAudioTitle(): string {
    return this.customAudioTitle;
  }

  public hasCustomAudio(): boolean {
    return !!this.customAudioUrl;
  }

  public start(theme: MusicTheme = 'acoustic') {
    this.currentTheme = theme;
    if (theme === 'off') {
      this.stop();
      return;
    }

    this.initAudioContext();
    this.isPlaying = true;
    this.startedAt = performance.now();

    if (theme === 'custom') {
      if (this.customAudio) {
        this.customAudio.play().catch(e => console.warn('Custom audio play error:', e));
      }
      return;
    }

    if (this.customAudio) {
      this.customAudio.pause();
    }

    this.scheduleNotes();
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerId) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.customAudio) {
      this.customAudio.pause();
    }
  }

  public switchTheme(theme: MusicTheme) {
    const wasPlaying = this.isPlaying;
    this.stop();
    this.currentTheme = theme;
    if (wasPlaying) {
      this.start(theme);
    }
  }

  public getPlaybackTime(): number {
    if (this.currentTheme === 'custom' && this.customAudio) {
      return this.customAudio.currentTime;
    }
    return this.isPlaying ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  private scheduleNotes() {
    if (!this.isPlaying || !this.audioCtx || !this.masterGain || this.currentTheme === 'off' || this.currentTheme === 'custom') {
      return;
    }

    const now = this.audioCtx.currentTime;

    // Harmonic Chord Progressions per theme (Frequencies in Hz)
    const themesScales: Record<string, number[][]> = {
      acoustic: [
        [261.63, 329.63, 392.00, 523.25], // C major
        [220.00, 261.63, 329.63, 440.00], // A minor
        [174.61, 220.00, 261.63, 349.23], // F major
        [196.00, 246.94, 293.66, 392.00]  // G major
      ],
      sunset: [
        [293.66, 369.99, 440.00, 587.33], // D major
        [246.94, 293.66, 369.99, 493.88], // B minor
        [196.00, 246.94, 293.66, 392.00], // G major
        [220.00, 277.18, 329.63, 440.00]  // A major
      ],
      party: [
        [329.63, 415.30, 493.88, 659.25], // E major
        [277.18, 329.63, 415.30, 554.37], // C# minor
        [220.00, 277.18, 329.63, 440.00], // A major
        [246.94, 311.13, 369.99, 493.88]  // B major
      ],
      birthday: [
        [261.63, 329.63, 392.00, 523.25], // C major sparkle
        [293.66, 369.99, 440.00, 587.33], // D major lift
        [329.63, 415.30, 493.88, 659.25], // E major lift
        [392.00, 493.88, 587.33, 783.99]  // G major celebration
      ],
      lofi: [
        [261.63, 311.13, 392.00, 466.16], // C minor 7
        [220.00, 261.63, 329.63, 392.00], // A minor 7
        [174.61, 220.00, 261.63, 329.63], // F major 7
        [196.00, 246.94, 293.66, 349.23]  // G dominant 7
      ],
      cinematic: [
        [220.00, 261.63, 329.63, 440.00, 523.25], // A minor add9
        [174.61, 220.00, 261.63, 349.23, 440.00], // F maj7
        [261.63, 329.63, 392.00, 523.25, 659.25], // C maj9
        [196.00, 246.94, 293.66, 392.00, 493.88]  // G maj9
      ]
    };

    const chords = themesScales[this.currentTheme] || themesScales.acoustic;
    const chordIndex = Math.floor((now / 3.6) % chords.length);
    const chord = chords[chordIndex];

    // Play lush pad chords
    chord.forEach((freq, i) => {
      if (!this.audioCtx || !this.masterGain) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const filter = this.audioCtx.createBiquadFilter();

      // Soft tone shaping
      osc.type = this.currentTheme === 'party' || this.currentTheme === 'birthday' ? 'triangle' : (this.currentTheme === 'lofi' ? 'sine' : 'triangle');
      osc.frequency.setValueAtTime(freq, now + i * 0.12);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(this.currentTheme === 'party' || this.currentTheme === 'birthday' ? 2600 : 1200, now);

      gain.gain.setValueAtTime(0.001, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.035, now + i * 0.12 + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 3.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 3.4);
    });

    if (this.currentTheme === 'birthday') {
      const melody = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 659.25];
      const note = melody[Math.floor((now * 2) % melody.length)];
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.7);
    }

    // Schedule next harmonic phrase
    this.timerId = window.setTimeout(() => {
      this.scheduleNotes();
    }, 2800);
  }
}

export const slideshowAudio = new SlideshowAudioEngine();
