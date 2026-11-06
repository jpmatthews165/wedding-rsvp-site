import ParallaxBackground from '../components/ParallaxBackground.jsx';
import { useSection } from './editing.jsx';
import { NATIVE_BG_IMAGE, cleanSectionBg, colorCss } from '../content/fieldStyle.js';

// A section's own background color and/or photo (section.bg, set by clicking empty
// space in a section in the editor). Sits behind everything in the section and above
// the design's background ([data-has-bg] in index.css gives the section its own
// stacking context so z-index -1 stays inside it). Put it first inside <section>.
export default function SectionBackground() {
  const { section } = useSection();
  const bg = cleanSectionBg(section.bg);
  const image = !NATIVE_BG_IMAGE.includes(section.type) && bg.image;
  if (!bg.color && !image) return null;
  return (
    <div aria-hidden="true" data-section-bg="" className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: -1 }}>
      {bg.color && (
        <div className="absolute inset-0" style={{ backgroundColor: colorCss(bg.color) }} />
      )}
      {image && (
        <div className="absolute inset-0 overflow-hidden" style={{ opacity: (bg.imageOpacity ?? 100) / 100 }}>
          <ParallaxBackground image={image} pos={bg.imagePos} speed={0.25} />
        </div>
      )}
    </div>
  );
}
