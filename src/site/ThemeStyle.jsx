import { useEffect, useMemo } from 'react';
import { buildTheme, googleFontsHref } from '../content/theme.js';

// Applies content.theme: sets the color/font CSS variables, loads any Google Fonts,
// and declares uploaded fonts. extraFamilies: Google fonts picked for single elements.
export default function ThemeStyle({ theme, extraFamilies = [] }) {
  const { css, googleFamilies } = useMemo(() => buildTheme(theme), [theme]);
  const extra = extraFamilies.join('|');
  const href = useMemo(() => googleFontsHref([...new Set([...googleFamilies, ...(extra ? extra.split('|') : [])])]), [googleFamilies, extra]);

  useEffect(() => {
    if (!href) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.themeFonts = '';
    document.head.appendChild(link);
    return () => link.remove();
  }, [href]);

  return <style>{css}</style>;
}
