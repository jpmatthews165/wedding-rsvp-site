// POST /api/upload — issues short-lived upload tokens for Vercel Blob so the editor can
// upload photos and fonts straight from the browser. Only signed-in admins get a token.
//
// Required: a Vercel Blob store connected to this project (Vercel → Storage → Blob),
// which adds the BLOB_READ_WRITE_TOKEN environment variable automatically.
import { handleUpload } from '@vercel/blob/client';
import { verifyAdminToken } from './_admin.js';
import { readJsonBody } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const result = await handleUpload({
      request: req,
      body: readJsonBody(req),
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        await verifyAdminToken(clientPayload);
        if (!pathname.startsWith('site/') && !pathname.startsWith('fonts/')) throw new Error('Invalid path');
        return {
          allowedContentTypes: pathname.startsWith('fonts/')
            ? ['font/woff2', 'font/woff', 'font/ttf', 'font/otf']
            : ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          maximumSizeInBytes: 15 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('upload failed', err);
    return res.status(400).json({ error: err.message });
  }
}
