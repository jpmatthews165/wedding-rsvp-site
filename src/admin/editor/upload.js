import { upload } from '@vercel/blob/client';

const FONT_TYPES = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' };

// Uploads a file to Vercel Blob via /api/upload (admins only). Returns its public URL.
export const uploadFile = async (file, getToken, folder = 'site') => {
  const ext = file.name.split('.').pop().toLowerCase();
  const contentType = FONT_TYPES[ext] || file.type || 'application/octet-stream';
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
  const token = await getToken();
  const blob = await upload(`${folder}/${Date.now()}-${safeName}`, file, {
    access: 'public',
    handleUploadUrl: '/api/upload',
    clientPayload: token,
    contentType,
  });
  return blob.url;
};

export const isFontFile = (file) => /\.(woff2?|ttf|otf)$/i.test(file?.name || '');
