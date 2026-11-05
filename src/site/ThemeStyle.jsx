import { useEffect, useMemo } from 'react';
import { buildTheme, googleFontsHref } from '../content/theme.js';

// Applies content.theme: sets the color/font CSS variables, loads any Google Fonts,
// and declares uploaded fonts.
export default function ThemeStyle({ theme }) {
  const { css, googleFamilies } = useMemo(() => buildTheme(theme), [theme]);
  const href = googleFontsHref(googleFamilies);

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
