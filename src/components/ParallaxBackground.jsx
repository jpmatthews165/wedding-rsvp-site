import { useEffect, useRef } from 'react';
import CoverImage from '../site/CoverImage.jsx';

// --------------------------------------------------------
// UNIVERSAL PARALLAX BACKGROUND
// --------------------------------------------------------
// Drop inside any `relative overflow-hidden` section. The image layer moves at
// `speed` × the scroll rate relative to its section, using a GPU transform.
//
// Works the same on desktop and mobile. (CSS `background-attachment: fixed`
// is ignored by iOS Safari and breaks under any transformed ancestor, which is
// why the old desktop/mobile split was needed.)
//
// The layer is sized from the section's real height and the viewport so the
// image always covers the section at every scroll position — no gaps, and no
// more zoom than necessary.
export default function ParallaxBackground({ image, speed = 0.25, pos }) {
  const layerRef = useRef(null);

  useEffect(() => {
    const layer = layerRef.current;
    const section = layer?.parentElement;
    if (!layer || !section) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let lastKey = '';

    const update = () => {
      frame = 0;
      if (reduceMotion.matches) {
        layer.style.top = '0px';
        layer.style.height = '100%';
        layer.style.transform = 'none';
        return;
      }

      const vh = window.innerHeight;
      const rect = section.getBoundingClientRect();
      const h = rect.height;

      // Skip work while the section is well off-screen.
      if (rect.bottom < -50 || rect.top > vh + 50) return;

      // The furthest down the section's top can ever be on screen: the viewport
      // height, or less for sections near the top of the page (e.g. the hero).
      const docTop = rect.top + window.scrollY;
      const maxTop = Math.min(vh, docTop);

      // translate = -rect.top × speed ranges over [-maxTop×speed, h×speed].
      // Size the layer so it covers the section across that whole range.
      const extraAbove = h * speed;
      const height = h + extraAbove + maxTop * speed;
      const key = `${Math.round(extraAbove)}|${Math.round(height)}`;
      if (key !== lastKey) {
        layer.style.top = `${-extraAbove}px`;
        layer.style.height = `${height}px`;
        lastKey = key;
      }
      layer.style.transform = `translate3d(0, ${(-rect.top * speed).toFixed(1)}px, 0)`;
    };

    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reduceMotion.addEventListener?.('change', schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(section);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reduceMotion.removeEventListener?.('change', schedule);
      ro.disconnect();
    };
  }, [speed]);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="absolute left-0 w-full z-0 pointer-events-none overflow-hidden"
      style={{
        top: 0,
        height: '100%',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
    >
      <CoverImage src={image} pos={pos} />
    </div>
  );
}
