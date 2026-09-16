import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import multer from 'multer';
import sharp from 'sharp';
import { randomUUID, timingSafeEqual } from 'crypto';

// Limit sharp to single-thread concurrency and configure cache to prevent CPU starvation
sharp.concurrency(1);
sharp.cache({ memory: 50, files: 20, items: 100 });

const PORT = 3000;

// --- Security Helper Functions ---

/**
 * Constant-time string comparison to prevent timing attacks on keys & passwords.
 */
function safeCompare(a?: string, b?: string): boolean {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Sanitize filename to prevent path traversal (../), null-byte injections, or dangerous characters.
 */
function sanitizeFilename(name: string): string {
  if (!name || typeof name !== 'string') return `photo_${Date.now()}.jpg`;
  return name
    .replace(/\0/g, '')
    .replace(/[/\\]/g, '_')
    .replace(/^\.+/, '')
    .replace(/[^a-zA-Z0-9._\- ]/g, '_')
    .trim()
    .slice(0, 150) || `photo_${Date.now()}.jpg`;
}

/**
 * Validate that an identifier (eventId, photoId, eventCode) is safe and within bounds.
 */
function isValidSafeId(id?: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id.trim());
}

/**
 * Sanitize user input strings (event name, descriptions, guest names) to prevent payload bloat.
 */
function sanitizeInputText(val?: unknown, maxLen = 300): string | undefined {
  if (val === undefined || val === null) return undefined;
  const str = String(val).replace(/\0/g, '').trim();
  return str.slice(0, maxLen);
}

// Block list of dangerous executable and script file extensions
const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.ps1', '.vbs', '.js', '.mjs', '.cjs',
  '.ts', '.html', '.htm', '.xhtml', '.php', '.phtml', '.py', '.rb', '.pl',
  '.dll', '.so', '.dylib', '.apk', '.jar', '.jsp', '.asp', '.aspx', '.cgi', '.msi', '.com', '.scr', '.vbe', '.wsf'
]);

interface MomentoEventRecord {
  id: string;
  code: string;
  hostKey: string;
  name: string;
  date?: string;
  location?: string;
  description?: string;
  coverPhotoId?: string;
  isArchived: boolean;
  allowUploads: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MomentoPhotoRecord {
  id: string;
  eventId: string;
  uploaderSessionId: string;
  uploaderName?: string;
  originalFilename: string;
  originalExt: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  aspectRatio: number;
  createdAt: string;
  mediaType: 'photo' | 'video';
}

interface DatabaseSchema {
  events: MomentoEventRecord[];
  photos: MomentoPhotoRecord[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const DB_FILE = path.join(DATA_DIR, 'momento-db.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// In-memory + file persistence DB helper
let db: DatabaseSchema = { events: [], photos: [] };

function loadDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(content);
    } else {
      db = { events: [], photos: [] };
      saveDatabase();
    }
  } catch (err) {
    console.error('Failed to load database, initializing empty', err);
    db = { events: [], photos: [] };
  }
  return db;
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save database', err);
  }
}

loadDatabase();

/**
 * Secure Event Resolver:
 * Matches ID (UUID) or Code (e.g. 'golden-sunset-42') strictly and securely.
 * Rejects invalid/malformed identifiers and strictly prevents cross-event data leakage.
 */
function findEvent(identifier?: string): MomentoEventRecord | undefined {
  if (!identifier || typeof identifier !== 'string') return undefined;
  const clean = identifier.trim().toLowerCase();
  if (!isValidSafeId(clean)) return undefined;

  // 1. Direct match by UUID or Event Code in memory
  let event = db.events.find(e => e.id.toLowerCase() === clean || e.code.toLowerCase() === clean);
  if (event) return event;

  // 2. Reload database from disk in case disk was updated by another process/request
  loadDatabase();
  event = db.events.find(e => e.id.toLowerCase() === clean || e.code.toLowerCase() === clean);
  if (event) return event;

  return undefined;
}

// Event code generator (clean, human-readable words or random slugs)
const WORDS = ['golden', 'sunset', 'summer', 'vibes', 'party', 'moment', 'coastal', 'neon', 'rooftop', 'solstice', 'retro', 'celebrate', 'festival', 'night', 'memories'];
function generateCleanCode(name?: string): string {
  if (name) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 18);
    const rand = Math.floor(100 + Math.random() * 900);
    const candidate = `${slug}-${rand}`;
    if (!db.events.some(e => e.code === candidate)) {
      return candidate;
    }
  }
  const w1 = WORDS[Math.floor(Math.random() * WORDS.length)];
  const w2 = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = Math.floor(10 + Math.random() * 90);
  const code = `${w1}-${w2}-${num}`;
  if (db.events.some(e => e.code === code)) {
    return `${code}-${Math.floor(Math.random() * 100)}`;
  }
  return code;
}

// SSE clients map by eventCode
const sseClients = new Map<string, Set<express.Response>>();

function broadcastToEvent(eventCode: string, payload: { type: string; data: unknown }) {
  const clients = sseClients.get(eventCode);
  if (clients && clients.size > 0) {
    const message = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of clients) {
      try {
        res.write(message);
      } catch (err) {
        clients.delete(res);
      }
    }
  }
}

// Multer storage for uploads with strict file verification
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per photo for untouched originals
    files: 50
  },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const ext = path.extname(name).toLowerCase();
    
    // 1. Strict rejection of dangerous executables
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return cb(new Error(`File type "${ext}" is not allowed for security reasons.`));
    }

    const mime = (file.mimetype || '').toLowerCase();
    const isLikelyImage = 
      mime.startsWith('image/') || 
      mime.startsWith('video/') ||
      mime === 'application/octet-stream' ||
      mime === 'binary/octet-stream' ||
      name.match(/\.(jpe?g|png|webp|heic|heif|avif|gif|bmp|tiff|svg|dng|raw|cr2|nef|arw|mp4|mov)$/i) ||
      !name.includes('.'); // Allow mobile camera blobs

    if (isLikelyImage) {
      cb(null, true);
    } else {
      cb(null, true);
    }
  }
});

function formatPhotoOutput(photo: MomentoPhotoRecord, baseUrl = '') {
  return {
    id: photo.id,
    eventId: photo.eventId,
    uploaderSessionId: photo.uploaderSessionId,
    uploaderName: photo.uploaderName,
    originalFilename: photo.originalFilename,
    mimeType: photo.mimeType,
    fileSize: photo.fileSize,
    width: photo.width,
    height: photo.height,
    aspectRatio: photo.aspectRatio,
    thumbnailUrl: `${baseUrl}/api/events/${photo.eventId}/photos/${photo.id}/thumbnail`,
    previewUrl: `${baseUrl}/api/events/${photo.eventId}/photos/${photo.id}/preview`,
    originalUrl: `${baseUrl}/api/events/${photo.eventId}/photos/${photo.id}/original`,
    createdAt: photo.createdAt,
    mediaType: photo.mediaType || 'photo'
  };
}

async function seedDemoPhotosIfEmpty() {
  const demoEvent = db.events.find(e => e.id === 'demo-event-01');
  if (!demoEvent) return;

  const existingPhotos = db.photos.filter(p => p.eventId === 'demo-event-01');
  if (existingPhotos.length > 0) return;

  const sampleMoments = [
    { title: 'Golden Hour Toast 🥂', subtitle: 'Captured by Maya', color1: '#F97316', color2: '#EA580C', w: 1200, h: 1600, name: 'Maya' },
    { title: 'Rooftop DJ Set 🎧', subtitle: 'Captured by Marcus', color1: '#4F46E5', color2: '#7C3AED', w: 1600, h: 1200, name: 'Marcus' },
    { title: 'Sunset Over the River 🌅', subtitle: 'Captured by Sofia', color1: '#DB2777', color2: '#F43F5E', w: 1200, h: 1500, name: 'Sofia' },
    { title: 'Sparklers & Confetti ✨', subtitle: 'Captured by Jordan', color1: '#059669', color2: '#10B981', w: 1400, h: 1400, name: 'Jordan' },
    { title: 'Late Night Tacos 🌮', subtitle: 'Captured by Elena', color1: '#D97706', color2: '#B45309', w: 1200, h: 1600, name: 'Elena' },
    { title: 'Group Photo on the Deck 📸', subtitle: 'Captured by Sam', color1: '#0284C7', color2: '#2563EB', w: 1800, h: 1200, name: 'Sam' },
  ];

  const eventUploadDir = path.join(UPLOADS_DIR, 'events', demoEvent.id);
  const originalsDir = path.join(eventUploadDir, 'originals');
  const thumbnailsDir = path.join(eventUploadDir, 'thumbnails');
  const previewsDir = path.join(eventUploadDir, 'previews');

  fs.mkdirSync(originalsDir, { recursive: true });
  fs.mkdirSync(thumbnailsDir, { recursive: true });
  fs.mkdirSync(previewsDir, { recursive: true });

  for (let i = 0; i < sampleMoments.length; i++) {
    const s = sampleMoments[i];
    const photoId = `demo-photo-${i + 1}`;
    const ext = '.jpg';
    const originalFilepath = path.join(originalsDir, `${photoId}${ext}`);
    const thumbnailFilepath = path.join(thumbnailsDir, `${photoId}.webp`);
    const previewFilepath = path.join(previewsDir, `${photoId}.webp`);

    const svg = `
      <svg width="${s.w}" height="${s.h}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g${i}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${s.color1}"/>
            <stop offset="100%" stop-color="${s.color2}"/>
          </linearGradient>
        </defs>
        <rect width="${s.w}" height="${s.h}" fill="url(#g${i})"/>
        <circle cx="${s.w * 0.5}" cy="${s.h * 0.4}" r="${Math.min(s.w, s.h) * 0.28}" fill="#ffffff" opacity="0.18"/>
        <circle cx="${s.w * 0.75}" cy="${s.h * 0.25}" r="${Math.min(s.w, s.h) * 0.12}" fill="#ffffff" opacity="0.1"/>
        <text x="50%" y="46%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="${Math.round(s.w / 18)}px" font-weight="bold" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${s.title}</text>
        <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" opacity="0.85" font-size="${Math.round(s.w / 30)}px" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${s.subtitle}</text>
      </svg>
    `;

    try {
      const buffer = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
      fs.writeFileSync(originalFilepath, buffer);

      await sharp(buffer)
        .resize({ width: 600, withoutEnlargement: true })
        .webp({ quality: 76, effort: 1 })
        .toFile(thumbnailFilepath);

      await sharp(buffer)
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 82, effort: 1 })
        .toFile(previewFilepath);

      db.photos.push({
        id: photoId,
        eventId: demoEvent.id,
        uploaderSessionId: `session-${s.name.toLowerCase()}`,
        uploaderName: s.name,
        originalFilename: `IMG_${202600 + i}.jpg`,
        originalExt: '.jpg',
        mimeType: 'image/jpeg',
        fileSize: buffer.length,
        width: s.w,
        height: s.h,
        aspectRatio: Number((s.w / s.h).toFixed(3)),
        createdAt: new Date(Date.now() - (sampleMoments.length - i) * 1000 * 60 * 18).toISOString(),
        mediaType: 'photo'
      });
    } catch (err) {
      console.warn('Seed photo generation error:', err);
    }
  }

  saveDatabase();
}

export async function createApp() {
  const app = express();
  const archiverModule = await import('archiver');
  const archiver = (archiverModule as any).default || archiverModule;

  // 1. Security Headers Middleware
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // 2. In-memory Rate Limiter with automatic periodic cleanup
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (now > entry.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }, 60000).unref();

  const rateLimiter = (maxRequests = 120, windowMs = 60000) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'client';
      const key = `${req.path}:${ip}`;
      const now = Date.now();
      const entry = rateLimitMap.get(key);

      if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
        return next();
      }

      entry.count++;
      if (entry.count > maxRequests) {
        return res.status(429).json({
          error: 'Too many requests. Please slow down and try again shortly.',
          retryAfterMs: Math.max(0, entry.resetAt - now)
        });
      }
      next();
    };
  };

  app.use(express.json({ limit: '2mb' }));

  // --- API Routes ---

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0', time: new Date().toISOString() });
  });

  // Local development helper for QR codes scanned from another device on the LAN.
  app.get('/api/network-address', (_req, res) => {
    const interfaces = os.networkInterfaces();
    const addresses = Object.values(interfaces)
      .flatMap((entries) => entries || [])
      .filter((entry) => entry.family === 'IPv4' && !entry.internal)
      .map((entry) => entry.address);

    res.json({ address: addresses[0] || null, port: PORT });
  });

  // 1. Create Event (Rate-limited, strictly validated)
  app.post('/api/events', rateLimiter(30, 60000), (req, res) => {
    const { name, date, location, description } = req.body;
    const cleanName = sanitizeInputText(name, 120);
    if (!cleanName) {
      return res.status(400).json({ error: 'Event name is required (max 120 characters)' });
    }

    const eventId = randomUUID();
    const hostKey = randomUUID();
    const code = generateCleanCode(cleanName);

    const newEvent: MomentoEventRecord = {
      id: eventId,
      code,
      hostKey,
      name: cleanName,
      date: sanitizeInputText(date, 80),
      location: sanitizeInputText(location, 150),
      description: sanitizeInputText(description, 600),
      isArchived: false,
      allowUploads: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.events.unshift(newEvent);
    saveDatabase();

    // Prepare directories safely
    const eventUploadDir = path.join(UPLOADS_DIR, 'events', eventId);
    fs.mkdirSync(path.join(eventUploadDir, 'originals'), { recursive: true });
    fs.mkdirSync(path.join(eventUploadDir, 'thumbnails'), { recursive: true });
    fs.mkdirSync(path.join(eventUploadDir, 'previews'), { recursive: true });

    res.status(201).json({
      event: {
        id: newEvent.id,
        code: newEvent.code,
        name: newEvent.name,
        date: newEvent.date,
        location: newEvent.location,
        description: newEvent.description,
        isArchived: newEvent.isArchived,
        allowUploads: newEvent.allowUploads,
        createdAt: newEvent.createdAt,
        updatedAt: newEvent.updatedAt,
      },
      hostKey,
      publicUrl: `/e/${newEvent.code}`,
      hostUrl: `/host/${newEvent.id}?key=${hostKey}`
    });
  });

  // 2. Get Public Event by Code or ID
  app.get(['/api/events/by-code/:code', '/api/events/:code'], (req, res) => {
    const { code } = req.params;
    if (!isValidSafeId(code)) {
      return res.status(400).json({ error: 'Invalid event identifier format' });
    }

    const event = findEvent(code);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const eventPhotos = db.photos
      .filter(p => p.eventId === event.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const contributors = new Set(eventPhotos.map(p => p.uploaderSessionId)).size;

    const publicEvent = {
      id: event.id,
      code: event.code,
      name: event.name,
      date: event.date,
      location: event.location,
      description: event.description,
      coverPhotoId: event.coverPhotoId,
      isArchived: event.isArchived,
      allowUploads: event.allowUploads,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };

    res.json({
      event: publicEvent,
      photos: eventPhotos.map(p => formatPhotoOutput(p)),
      stats: {
        photoCount: eventPhotos.length,
        contributorCount: contributors,
      }
    });
  });

  // 3. Get Host Event View & Stats (Constant-time key check)
  app.get('/api/events/:id/host', (req, res) => {
    const { id } = req.params;
    if (!isValidSafeId(id)) {
      return res.status(400).json({ error: 'Invalid event identifier' });
    }

    const hostKey = (req.headers['x-host-key'] || req.query.key) as string;
    const event = findEvent(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!hostKey || !safeCompare(event.hostKey, hostKey)) {
      return res.status(403).json({ error: 'Unauthorized: Invalid host key' });
    }

    const eventPhotos = db.photos
      .filter(p => p.eventId === event.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const contributors = new Set(eventPhotos.map(p => p.uploaderSessionId)).size;
    const totalSizeBytes = eventPhotos.reduce((acc, p) => acc + (p.fileSize || 0), 0);

    res.json({
      event,
      photos: eventPhotos.map(p => formatPhotoOutput(p)),
      stats: {
        photoCount: eventPhotos.length,
        contributorCount: contributors,
        totalSizeBytes
      }
    });
  });

  // 4. Update Event Settings (Host only - with safe comparisons & input validation)
  app.patch('/api/events/:id', (req, res) => {
    const { id } = req.params;
    if (!isValidSafeId(id)) {
      return res.status(400).json({ error: 'Invalid event identifier' });
    }

    const hostKey = (req.headers['x-host-key'] || req.query.key) as string;
    const event = findEvent(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!hostKey || !safeCompare(event.hostKey, hostKey)) {
      return res.status(403).json({ error: 'Unauthorized: Invalid host key' });
    }

    const { name, date, location, description, allowUploads, isArchived, coverPhotoId } = req.body;

    if (name !== undefined) {
      const cleanName = sanitizeInputText(name, 120);
      if (cleanName) event.name = cleanName;
    }
    if (date !== undefined) event.date = sanitizeInputText(date, 80);
    if (location !== undefined) event.location = sanitizeInputText(location, 150);
    if (description !== undefined) event.description = sanitizeInputText(description, 600);
    if (allowUploads !== undefined) event.allowUploads = Boolean(allowUploads);
    if (isArchived !== undefined) event.isArchived = Boolean(isArchived);
    if (coverPhotoId !== undefined) {
      event.coverPhotoId = isValidSafeId(coverPhotoId) ? coverPhotoId : undefined;
    }
    event.updatedAt = new Date().toISOString();

    saveDatabase();

    broadcastToEvent(event.code, {
      type: 'EVENT_UPDATED',
      data: {
        id: event.id,
        name: event.name,
        date: event.date,
        location: event.location,
        description: event.description,
        isArchived: event.isArchived,
        allowUploads: event.allowUploads
      }
    });

    res.json({ event });
  });

  // 5. SSE Real-time Updates Endpoint
  app.get('/api/events/:code/stream', (req, res) => {
    const { code } = req.params;
    if (!isValidSafeId(code)) {
      return res.status(400).end();
    }

    const event = findEvent(code);
    if (!event) {
      return res.status(404).end();
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send initial keep-alive comment
    res.write(': connected\n\n');

    if (!sseClients.has(event.code)) {
      sseClients.set(event.code, new Set());
    }
    const clientSet = sseClients.get(event.code)!;
    clientSet.add(res);

    req.on('close', () => {
      clientSet.delete(res);
      if (clientSet.size === 0) {
        sseClients.delete(event.code);
      }
    });
  });

  // 6. Upload Photos (Guest or Host - supports event UUID or event code)
  app.post(['/api/events/:id/photos', '/api/events/by-code/:id/photos'], rateLimiter(60, 60000), upload.array('photos', 50), async (req, res) => {
    const { id } = req.params;
    if (!isValidSafeId(id)) {
      return res.status(400).json({ error: 'Invalid event identifier' });
    }

    const uploaderSessionId = sanitizeInputText(req.body?.uploaderSessionId, 64) || 'anonymous';
    const uploaderName = sanitizeInputText(req.body?.uploaderName, 60);
    const files = req.files as Express.Multer.File[];

    const event = findEvent(id);
    if (!event) {
      return res.status(404).json({ error: `Event "${id}" was not found. Please verify the QR code or link.` });
    }

    if (event.isArchived) {
      return res.status(403).json({ error: 'This event has been archived. New uploads are not permitted.' });
    }

    if (!event.allowUploads) {
      return res.status(403).json({ error: 'Uploads are currently closed by the host.' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No image files were attached to the upload request.' });
    }

    const eventUploadDir = path.join(UPLOADS_DIR, 'events', event.id);
    const originalsDir = path.join(eventUploadDir, 'originals');
    const thumbnailsDir = path.join(eventUploadDir, 'thumbnails');
    const previewsDir = path.join(eventUploadDir, 'previews');

    fs.mkdirSync(originalsDir, { recursive: true });
    fs.mkdirSync(thumbnailsDir, { recursive: true });
    fs.mkdirSync(previewsDir, { recursive: true });

    const createdPhotos: MomentoPhotoRecord[] = [];

    for (const file of files) {
      try {
        const photoId = randomUUID();
        const safeOriginalName = sanitizeFilename(file.originalname);
        let ext = path.extname(safeOriginalName).toLowerCase();
        if (!ext || ext.length < 2) {
          const m = (file.mimetype || '').toLowerCase();
          ext = m.includes('png') ? '.png' : m.includes('webp') ? '.webp' : m.includes('gif') ? '.gif' : '.jpg';
        }

        if (DANGEROUS_EXTENSIONS.has(ext)) {
          console.warn(`[SECURITY BLOCKED] Disallowed file extension: ${ext}`);
          continue;
        }

        const originalFilepath = path.join(originalsDir, `${photoId}${ext}`);

        // 1. Save original untouched buffer
        fs.writeFileSync(originalFilepath, file.buffer);

        // 2. Process WebP thumbnail and preview with sharp
        let width = 1200;
        let height = 800;
        let processedThumb = false;
        let processedPrev = false;

        const thumbnailFilepath = path.join(thumbnailsDir, `${photoId}.webp`);
        const previewFilepath = path.join(previewsDir, `${photoId}.webp`);

        try {
          const metadata = await sharp(file.buffer).metadata();
          if (metadata.width) width = metadata.width;
          if (metadata.height) height = metadata.height;

          await sharp(file.buffer)
            .rotate()
            .resize({ width: 600, withoutEnlargement: true })
            .webp({ quality: 78, effort: 1 })
            .toFile(thumbnailFilepath);
          processedThumb = true;

          await sharp(file.buffer)
            .rotate()
            .resize({ width: 1600, withoutEnlargement: true })
            .webp({ quality: 82, effort: 1 })
            .toFile(previewFilepath);
          processedPrev = true;
        } catch {
          // Fallback without rotate in case of corrupted EXIF orientation
          try {
            await sharp(file.buffer)
              .resize({ width: 600, withoutEnlargement: true })
              .webp({ quality: 78, effort: 1 })
              .toFile(thumbnailFilepath);
            processedThumb = true;

            await sharp(file.buffer)
              .resize({ width: 1600, withoutEnlargement: true })
              .webp({ quality: 82, effort: 1 })
              .toFile(previewFilepath);
            processedPrev = true;
          } catch {
            // Buffer fallback
          }
        }

        if (!processedThumb && !fs.existsSync(thumbnailFilepath)) {
          if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext)) {
            fs.writeFileSync(thumbnailFilepath, file.buffer);
          } else {
            const fallbackSvg = `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1A1A1A"/><text x="50%" y="45%" fill="#E67E22" font-size="36" font-weight="bold" font-family="sans-serif" text-anchor="middle">MOMENTO</text><text x="50%" y="55%" fill="#ffffff" font-size="22" font-family="sans-serif" text-anchor="middle">${safeOriginalName}</text></svg>`;
            try {
              const svgBuf = await sharp(Buffer.from(fallbackSvg)).webp().toBuffer();
              fs.writeFileSync(thumbnailFilepath, svgBuf);
            } catch {
              fs.writeFileSync(thumbnailFilepath, file.buffer);
            }
          }
        }

        if (!processedPrev && !fs.existsSync(previewFilepath)) {
          if (fs.existsSync(thumbnailFilepath)) {
            fs.copyFileSync(thumbnailFilepath, previewFilepath);
          } else {
            fs.writeFileSync(previewFilepath, file.buffer);
          }
        }

        const aspectRatio = width > 0 && height > 0 ? Number((width / height).toFixed(3)) : 1.333;

        const photoRecord: MomentoPhotoRecord = {
          id: photoId,
          eventId: event.id,
          uploaderSessionId,
          uploaderName,
          originalFilename: safeOriginalName,
          originalExt: ext,
          mimeType: file.mimetype || 'image/jpeg',
          fileSize: file.size,
          width,
          height,
          aspectRatio,
          createdAt: new Date().toISOString(),
          mediaType: 'photo'
        };

        db.photos.unshift(photoRecord);
        createdPhotos.push(photoRecord);
      } catch (err) {
        console.error('[SERVER UPLOAD ERROR]', err);
      }
    }

    saveDatabase();

    // Broadcast new photos to all connected viewers in real time
    if (createdPhotos.length > 0) {
      broadcastToEvent(event.code, {
        type: 'PHOTOS_ADDED',
        data: {
          photos: createdPhotos.map(p => formatPhotoOutput(p))
        }
      });
    }

    res.status(201).json({
      success: true,
      count: createdPhotos.length,
      photos: createdPhotos.map(p => formatPhotoOutput(p))
    });
  });

  // 6b. Get Metadata for a Single Newly Uploaded Photo
  app.get(['/api/events/:eventId/photos/:photoId/metadata', '/api/events/by-code/:eventId/photos/:photoId/metadata'], (req, res) => {
    const { eventId, photoId } = req.params;
    if (!isValidSafeId(eventId) || !isValidSafeId(photoId)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const event = findEvent(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const photo = db.photos.find(p => p.id === photoId && p.eventId === event.id);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    res.json({
      success: true,
      photo: formatPhotoOutput(photo)
    });
  });

  // 6c. Get Delta Photos (Photos uploaded after a given timestamp or ID)
  app.get(['/api/events/:code/photos/delta', '/api/events/by-code/:code/photos/delta'], (req, res) => {
    const { code } = req.params;
    if (!isValidSafeId(code)) {
      return res.status(400).json({ error: 'Invalid event identifier' });
    }

    const since = req.query.since as string;
    const afterId = req.query.afterId as string;

    const event = findEvent(code);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    let deltaPhotos = db.photos.filter(p => p.eventId === event.id);

    if (since) {
      const sinceTime = new Date(since).getTime();
      if (!isNaN(sinceTime)) {
        deltaPhotos = deltaPhotos.filter(p => new Date(p.createdAt).getTime() > sinceTime);
      }
    } else if (afterId && isValidSafeId(afterId)) {
      const targetIndex = deltaPhotos.findIndex(p => p.id === afterId);
      if (targetIndex !== -1) {
        deltaPhotos = deltaPhotos.slice(0, targetIndex);
      }
    }

    deltaPhotos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      count: deltaPhotos.length,
      photos: deltaPhotos.map(p => formatPhotoOutput(p))
    });
  });

  // 7. Serve Thumbnail (Fast WebP - strictly path-traversal guarded)
  app.get(['/api/events/:eventId/photos/:photoId/thumbnail', '/api/events/by-code/:eventId/photos/:photoId/thumbnail'], (req, res) => {
    const { eventId, photoId } = req.params;
    if (!isValidSafeId(eventId) || !isValidSafeId(photoId)) {
      return res.status(400).send('Invalid identifier');
    }

    const event = findEvent(eventId);
    if (!event) {
      return res.status(404).send('Event not found');
    }

    const photo = db.photos.find(p => p.id === photoId && p.eventId === event.id);
    if (!photo) {
      return res.status(404).send('Photo not found');
    }

    const thumbnailPath = path.join(UPLOADS_DIR, 'events', event.id, 'thumbnails', `${photoId}.webp`);

    if (fs.existsSync(thumbnailPath)) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return fs.createReadStream(thumbnailPath).pipe(res);
    }

    // Fallback if preview or original exists
    const origPath = path.join(UPLOADS_DIR, 'events', event.id, 'originals', `${photoId}${photo.originalExt}`);
    if (fs.existsSync(origPath)) {
      res.setHeader('Content-Type', photo.mimeType || 'image/jpeg');
      return fs.createReadStream(origPath).pipe(res);
    }

    res.status(404).send('Thumbnail not found');
  });

  // 8. Serve Preview (High-Res WebP - strictly path-traversal guarded)
  app.get(['/api/events/:eventId/photos/:photoId/preview', '/api/events/by-code/:eventId/photos/:photoId/preview'], (req, res) => {
    const { eventId, photoId } = req.params;
    if (!isValidSafeId(eventId) || !isValidSafeId(photoId)) {
      return res.status(400).send('Invalid identifier');
    }

    const event = findEvent(eventId);
    if (!event) {
      return res.status(404).send('Event not found');
    }

    const photo = db.photos.find(p => p.id === photoId && p.eventId === event.id);
    if (!photo) {
      return res.status(404).send('Photo not found');
    }

    const previewPath = path.join(UPLOADS_DIR, 'events', event.id, 'previews', `${photoId}.webp`);

    if (fs.existsSync(previewPath)) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return fs.createReadStream(previewPath).pipe(res);
    }

    const origPath = path.join(UPLOADS_DIR, 'events', event.id, 'originals', `${photoId}${photo.originalExt}`);
    if (fs.existsSync(origPath)) {
      res.setHeader('Content-Type', photo.mimeType || 'image/jpeg');
      return fs.createReadStream(origPath).pipe(res);
    }

    res.status(404).send('Preview not found');
  });

  // 9. Download ORIGINAL untouched file
  app.get(['/api/events/:eventId/photos/:photoId/original', '/api/events/by-code/:eventId/photos/:photoId/original'], (req, res) => {
    const { eventId, photoId } = req.params;
    if (!isValidSafeId(eventId) || !isValidSafeId(photoId)) {
      return res.status(400).send('Invalid identifier');
    }

    const event = findEvent(eventId);
    if (!event) {
      return res.status(404).send('Event not found');
    }

    const photo = db.photos.find(p => p.id === photoId && p.eventId === event.id);
    if (!photo) {
      return res.status(404).send('Photo not found');
    }

    const origPath = path.join(UPLOADS_DIR, 'events', event.id, 'originals', `${photoId}${photo.originalExt}`);
    if (!fs.existsSync(origPath)) {
      return res.status(404).send('Original file not found');
    }

    const filename = sanitizeFilename(photo.originalFilename || `momento-${photoId}${photo.originalExt}`);
    res.setHeader('Content-Type', photo.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Content-Length', fs.statSync(origPath).size);

    fs.createReadStream(origPath).pipe(res);
  });

  // 10. Delete Photo (Host or uploader session - safe auth compare)
  app.delete(['/api/events/:eventId/photos/:photoId', '/api/events/by-code/:eventId/photos/:photoId'], (req, res) => {
    const { eventId, photoId } = req.params;
    if (!isValidSafeId(eventId) || !isValidSafeId(photoId)) {
      return res.status(400).json({ error: 'Invalid identifier' });
    }

    const hostKey = (req.headers['x-host-key'] || req.query.key) as string;
    const sessionId = (req.headers['x-session-id'] || req.query.sessionId) as string;

    const event = findEvent(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const photoIndex = db.photos.findIndex(p => p.id === photoId && p.eventId === event.id);
    if (photoIndex === -1) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photo = db.photos[photoIndex];
    const isHost = hostKey && safeCompare(event.hostKey, hostKey);
    const isUploader = sessionId && safeCompare(photo.uploaderSessionId, sessionId);

    if (!isHost && !isUploader) {
      return res.status(403).json({ error: 'Unauthorized to delete this photo' });
    }

    // Remove files
    try {
      const origPath = path.join(UPLOADS_DIR, 'events', event.id, 'originals', `${photoId}${photo.originalExt}`);
      const thumbPath = path.join(UPLOADS_DIR, 'events', event.id, 'thumbnails', `${photoId}.webp`);
      const prevPath = path.join(UPLOADS_DIR, 'events', event.id, 'previews', `${photoId}.webp`);

      if (fs.existsSync(origPath)) fs.unlinkSync(origPath);
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
      if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath);
    } catch (e) {
      console.warn('Error deleting photo files from disk:', e);
    }

    db.photos.splice(photoIndex, 1);
    saveDatabase();

    broadcastToEvent(event.code, {
      type: 'PHOTO_DELETED',
      data: { photoId }
    });

    res.json({ success: true, photoId });
  });

  // 10b. Clear All Photos from Current Event Gallery (Host Only - safe compare & rate limited)
  app.post(['/api/events/:eventId/clear-photos', '/api/events/by-code/:eventId/clear-photos'], rateLimiter(10, 60000), (req, res) => {
    const { eventId } = req.params;
    if (!isValidSafeId(eventId)) {
      return res.status(400).json({ error: 'Invalid event identifier' });
    }

    const hostKey = (req.headers['x-host-key'] || req.query.key || req.body?.hostKey) as string;

    const event = findEvent(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!hostKey || !safeCompare(event.hostKey, hostKey)) {
      return res.status(403).json({ error: 'Unauthorized: Invalid host key' });
    }

    const eventPhotos = db.photos.filter(p => p.eventId === event.id);
    const photoCountBefore = eventPhotos.length;

    // Purge physical files on disk
    const eventUploadDir = path.join(UPLOADS_DIR, 'events', event.id);
    try {
      const originalsDir = path.join(eventUploadDir, 'originals');
      const thumbnailsDir = path.join(eventUploadDir, 'thumbnails');
      const previewsDir = path.join(eventUploadDir, 'previews');

      if (fs.existsSync(originalsDir)) {
        fs.rmSync(originalsDir, { recursive: true, force: true });
        fs.mkdirSync(originalsDir, { recursive: true });
      }
      if (fs.existsSync(thumbnailsDir)) {
        fs.rmSync(thumbnailsDir, { recursive: true, force: true });
        fs.mkdirSync(thumbnailsDir, { recursive: true });
      }
      if (fs.existsSync(previewsDir)) {
        fs.rmSync(previewsDir, { recursive: true, force: true });
        fs.mkdirSync(previewsDir, { recursive: true });
      }
    } catch (e) {
      console.warn('Error clearing event photos directory from disk:', e);
    }

    // Purge database records for this event
    db.photos = db.photos.filter(p => p.eventId !== event.id);
    saveDatabase();

    // Broadcast SSE real-time event to all connected guests & screens
    broadcastToEvent(event.code, {
      type: 'PHOTOS_CLEARED',
      data: { eventId: event.id, message: 'All gallery photos were cleared by the host' }
    });

    console.log(`[HOST ACTION] Host cleared all ${photoCountBefore} photos from event "${event.name}" (${event.code})`);

    res.json({
      success: true,
      eventId: event.id,
      clearedCount: photoCountBefore,
      message: `Successfully cleared all ${photoCountBefore} photo(s) and storage files from this event.`
    });
  });

  // 11. Download All Photos as ZIP (Streaming, safe memory management, traversal protection)
  app.get(['/api/events/:eventId/download-zip', '/api/events/by-code/:eventId/download-zip'], (req, res) => {
    const { eventId } = req.params;
    if (!isValidSafeId(eventId)) {
      return res.status(400).send('Invalid event identifier');
    }

    const event = findEvent(eventId);
    if (!event) {
      return res.status(404).send('Event not found');
    }

    const eventPhotos = db.photos.filter(p => p.eventId === event.id);
    if (eventPhotos.length === 0) {
      return res.status(400).send('No photos to download');
    }

    const safeCleanTitle = event.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    const zipFilename = `${safeCleanTitle}_moments.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"; filename*=UTF-8''${encodeURIComponent(zipFilename)}`);

    const archive = archiver('zip', {
      zlib: { level: 1 } // Fast compression for pre-compressed media, reduces CPU drastically
    });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).send({ error: err.message });
      }
    });

    archive.pipe(res);

    for (let i = 0; i < eventPhotos.length; i++) {
      const p = eventPhotos[i];
      const origPath = path.join(UPLOADS_DIR, 'events', event.id, 'originals', `${p.id}${p.originalExt}`);
      if (fs.existsSync(origPath)) {
        const safeOriginalName = sanitizeFilename(p.originalFilename);
        const safeName = `${String(i + 1).padStart(3, '0')}_${safeOriginalName}`;
        archive.file(origPath, { name: safeName });
      }
    }

    archive.finalize();
  });

  // --- 12. Master Admin Portal Endpoints ---
  const ADMIN_MASTER_KEY = '0903';

  const checkAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = req.headers['x-admin-key'] as string;
    if (!key || !safeCompare(key, ADMIN_MASTER_KEY)) {
      return res.status(401).json({ error: 'Unauthorized: Invalid Admin Master Key' });
    }
    next();
  };

  // Get full system overview, all events, and all photos with deep metadata
  app.get('/api/admin/overview', rateLimiter(60, 60000), checkAdminAuth, (_req, res) => {
    const totalSizeBytes = db.photos.reduce((acc, p) => acc + (p.fileSize || 0), 0);
    const contributors = new Set(db.photos.map(p => p.uploaderSessionId)).size;

    const eventMap = new Map<string, MomentoEventRecord>();
    db.events.forEach(e => eventMap.set(e.id, e));

    const photosWithEventInfo = db.photos.map(p => {
      const parentEvent = eventMap.get(p.eventId);
      return {
        ...formatPhotoOutput(p),
        originalExt: p.originalExt,
        eventName: parentEvent ? parentEvent.name : 'Unknown Event',
        eventCode: parentEvent ? parentEvent.code : 'unknown'
      };
    });

    const eventsWithStats = db.events.map(ev => {
      const evPhotos = db.photos.filter(p => p.eventId === ev.id);
      const evSize = evPhotos.reduce((acc, p) => acc + (p.fileSize || 0), 0);
      return {
        id: ev.id,
        code: ev.code,
        name: ev.name,
        hostKey: ev.hostKey,
        date: ev.date,
        location: ev.location,
        isArchived: ev.isArchived,
        allowUploads: ev.allowUploads,
        createdAt: ev.createdAt,
        photoCount: evPhotos.length,
        totalSizeBytes: evSize
      };
    });

    res.json({
      stats: {
        eventCount: db.events.length,
        photoCount: db.photos.length,
        totalSizeBytes,
        contributorCount: contributors
      },
      photos: photosWithEventInfo,
      events: eventsWithStats
    });
  });

  // Admin Delete Photo Globally
  app.delete('/api/admin/photos/:photoId', rateLimiter(60, 60000), checkAdminAuth, (req, res) => {
    const { photoId } = req.params;
    if (!isValidSafeId(photoId)) {
      return res.status(400).json({ error: 'Invalid photo identifier' });
    }

    const eventId = req.query.eventId as string;

    const photoIndex = db.photos.findIndex(p => p.id === photoId);
    if (photoIndex === -1) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photo = db.photos[photoIndex];
    const targetEventId = (eventId && isValidSafeId(eventId)) ? eventId : photo.eventId;

    try {
      const origPath = path.join(UPLOADS_DIR, 'events', targetEventId, 'originals', `${photo.id}${photo.originalExt}`);
      const thumbPath = path.join(UPLOADS_DIR, 'events', targetEventId, 'thumbnails', `${photo.id}.webp`);
      const prevPath = path.join(UPLOADS_DIR, 'events', targetEventId, 'previews', `${photo.id}.webp`);

      if (fs.existsSync(origPath)) fs.unlinkSync(origPath);
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
      if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath);
    } catch (e) {
      console.warn('Admin photo deletion disk error:', e);
    }

    const event = db.events.find(e => e.id === photo.eventId);
    db.photos.splice(photoIndex, 1);
    saveDatabase();

    if (event) {
      broadcastToEvent(event.code, {
        type: 'PHOTO_DELETED',
        data: { photoId }
      });
    }

    res.json({ success: true, photoId });
  });

  // Admin Delete Event Globally
  app.delete('/api/admin/events/:eventId', rateLimiter(30, 60000), checkAdminAuth, (req, res) => {
    const { eventId } = req.params;
    if (!isValidSafeId(eventId)) {
      return res.status(400).json({ error: 'Invalid event identifier' });
    }

    const eventIndex = db.events.findIndex(e => e.id === eventId);
    if (eventIndex === -1) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Delete all photo files and folder
    const eventUploadDir = path.join(UPLOADS_DIR, 'events', eventId);
    try {
      if (fs.existsSync(eventUploadDir)) {
        fs.rmSync(eventUploadDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn('Admin event directory purge error:', e);
    }

    db.photos = db.photos.filter(p => p.eventId !== eventId);
    db.events.splice(eventIndex, 1);
    saveDatabase();

    res.json({ success: true, eventId });
  });

  // Admin Clear All Existing Galleries & Photos System-Wide
  app.post('/api/admin/clear-all', rateLimiter(5, 60000), checkAdminAuth, (_req, res) => {
    try {
      const eventsUploadsDir = path.join(UPLOADS_DIR, 'events');
      if (fs.existsSync(eventsUploadsDir)) {
        fs.rmSync(eventsUploadsDir, { recursive: true, force: true });
        fs.mkdirSync(eventsUploadsDir, { recursive: true });
      }
    } catch (e) {
      console.warn('Error clearing uploads directory:', e);
    }

    // Broadcast clear event to any active SSE clients
    db.events.forEach(ev => {
      broadcastToEvent(ev.code, {
        type: 'GALLERY_CLEARED',
        data: { eventId: ev.id }
      });
    });

    db = { events: [], photos: [] };
    saveDatabase();

    res.json({
      success: true,
      message: 'All existing galleries and photos have been cleared successfully.'
    });
  });

  // Admin Download Event Photos Batch as ZIP
  app.get('/api/admin/events/:eventId/download-zip', checkAdminAuth, (req, res) => {
    const { eventId } = req.params;
    if (!isValidSafeId(eventId)) {
      return res.status(400).json({ error: 'Invalid event identifier' });
    }

    const event = db.events.find(e => e.id === eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const eventPhotos = db.photos.filter(p => p.eventId === eventId);
    if (eventPhotos.length === 0) {
      return res.status(400).json({ error: 'No photos found in this event to download' });
    }

    const safeCleanTitle = event.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    const zipFilename = `MOMENTO_${event.code}_${safeCleanTitle}_all_originals.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"; filename*=UTF-8''${encodeURIComponent(zipFilename)}`);

    const archive = archiver('zip', {
      zlib: { level: 1 }
    });

    archive.on('error', (err: Error) => {
      console.error('Admin ZIP error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });

    archive.pipe(res);

    for (let i = 0; i < eventPhotos.length; i++) {
      const p = eventPhotos[i];
      const origPath = path.join(UPLOADS_DIR, 'events', eventId, 'originals', `${p.id}${p.originalExt}`);
      if (fs.existsSync(origPath)) {
        const safeOriginalName = sanitizeFilename(p.originalFilename);
        const safeName = `${String(i + 1).padStart(3, '0')}_${safeOriginalName}`;
        archive.file(origPath, { name: safeName });
      }
    }

    archive.finalize();
  });

  // Admin Master Batch Download (All Events System-Wide ZIP)
  app.get('/api/admin/download-all-zip', checkAdminAuth, (_req, res) => {
    if (db.photos.length === 0) {
      return res.status(400).json({ error: 'No photos in the entire system to download' });
    }

    const zipFilename = `MOMENTO_MASTER_VAULT_ALL_EVENTS_${Date.now()}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"; filename*=UTF-8''${encodeURIComponent(zipFilename)}`);

    const archive = archiver('zip', {
      zlib: { level: 1 }
    });

    archive.on('error', (err: Error) => {
      console.error('Master Admin ZIP error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });

    archive.pipe(res);

    const eventMap = new Map<string, MomentoEventRecord>();
    db.events.forEach(e => eventMap.set(e.id, e));

    for (let i = 0; i < db.photos.length; i++) {
      const p = db.photos[i];
      const ev = eventMap.get(p.eventId);
      const folderName = ev ? `${ev.code}_${ev.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30)}` : 'unassigned';
      const origPath = path.join(UPLOADS_DIR, 'events', p.eventId, 'originals', `${p.id}${p.originalExt}`);
      if (fs.existsSync(origPath)) {
        const safeOriginalName = sanitizeFilename(p.originalFilename);
        const safeName = path.join(folderName, `${String(i + 1).padStart(4, '0')}_${safeOriginalName}`);
        archive.file(origPath, { name: safeName });
      }
    }

    archive.finalize();
  });

  // Global Error Handler for API routes (Multer size limit, parsing errors, etc.)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      console.error('[SERVER GLOBAL ERROR HANDLER]', {
        path: req.path,
        method: req.method,
        code: err.code,
        message: err.message,
        stack: err.stack
      });

      if (!res.headersSent) {
        let status = err.status || 500;
        let errorMessage = err.message || 'An error occurred while processing the request.';

        if (err.code === 'LIMIT_FILE_SIZE') {
          status = 413;
          errorMessage = 'Photo exceeds the 100MB file size limit. Please choose a smaller photo.';
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          status = 400;
          errorMessage = 'Too many photos in a single batch. Maximum limit is 50 photos.';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          status = 400;
          errorMessage = 'Unexpected upload payload format received by the server.';
        }

        return res.status(status).json({
          error: errorMessage,
          code: err.code || 'API_ERROR',
          statusCode: status
        });
      }
    }
    next();
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Explicit fallback for mobile browsers & QR scanner webviews that may not send accept: text/html
    app.use('*', async (req, res, next) => {
      if (req.method !== 'GET' || req.originalUrl.startsWith('/api/')) {
        return next();
      }
      try {
        const indexHtmlPath = path.resolve(process.cwd(), 'index.html');
        let html = fs.readFileSync(indexHtmlPath, 'utf-8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

async function startServer() {
  const app = await createApp();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MOMENTO server running on http://localhost:${PORT}`);
  });
}

if (process.env.VERCEL !== '1') {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
  });
}
