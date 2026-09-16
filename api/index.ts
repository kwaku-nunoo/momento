import { createApp } from '../server.ts';

let appPromise: Promise<any> | null = null;

export default async function handler(req: any, res: any) {
  try {
    if (!appPromise) {
      appPromise = createApp();
    }
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('[Vercel API startup failure]', error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: `API startup failed: ${message}` });
  }
}
