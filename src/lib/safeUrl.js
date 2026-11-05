// Only allow ordinary links from editable content: web pages, email, phone,
// and same-site paths/anchors. Anything else (e.g. "javascript:…") becomes "".
export const safeUrl = (url) => {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (u.startsWith('//')) return `https:${u}`;
  if (/^[/#]/.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return ''; // some other scheme
  return `https://${u}`; // "amazon.com/registry" → https://amazon.com/registry
};
