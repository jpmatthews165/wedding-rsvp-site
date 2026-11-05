import { useEffect, useState } from 'react';

// A photo that fills its box (like background-size: cover), with an adjustable
// focal point and zoom saved in content as `<field>Pos`:
//   { x, y, zoom, mobile?: { x, y, zoom } }
//   x, y   — 0–100, the point of the photo that stays in view (50/50 = center).
//            Lower y shows more of the top of the photo, which moves people down.
//   zoom   — 1–3, zooms in around that point.
//   mobile — optional separate position for phones (screens up to 600px wide),
//            because phones crop the sides of a photo instead of the top/bottom.
const clamp = (n, lo, hi, d) => (Number.isFinite(+n) ? Math.min(hi, Math.max(lo, +n)) : d);

export const PHONE_QUERY = '(max-width: 600px)';

export const normalizePos = (pos) => ({
  x: clamp(pos?.x, 0, 100, 50),
  y: clamp(pos?.y, 0, 100, 50),
  zoom: clamp(pos?.zoom, 1, 3, 1),
});

// The position to use for a given screen: the phone override if there is one.
export const pickPos = (pos, phone) => normalizePos(phone && pos?.mobile ? pos.mobile : pos);

export const coverStyle = (pos) => {
  const { x, y, zoom } = normalizePos(pos);
  return {
    objectFit: 'cover',
    objectPosition: `${x}% ${y}%`,
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
    transformOrigin: `${x}% ${y}%`,
  };
};

export const useIsPhone = () => {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
};

// `device` forces 'phone' or 'desktop' (used by the editor's previews); otherwise
// it follows the current screen width.
export default function CoverImage({ src, pos, device, className = '', alt = '' }) {
  const isPhone = useIsPhone();
  if (!src) return null;
  const phone = device ? device === 'phone' : isPhone;
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      decoding="async"
      className={`absolute inset-0 w-full h-full select-none ${className}`}
      style={coverStyle(pickPos(pos, phone))}
    />
  );
}
