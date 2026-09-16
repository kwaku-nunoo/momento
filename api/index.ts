let appPromise: Promise<any> | null = null;

export default async function handler(req: any, res: any) {
  try {
    if (!appPromise) {
      appPromise = import('../server').then(({ createApp }) => createApp());
    }
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('[Vercel API startup failure]', error);
    return res.status(500).json({ error: 'API startup failed. Check the Vercel function logs.' });
  }
}
