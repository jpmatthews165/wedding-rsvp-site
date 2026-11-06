import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';

// Editor-only drag overlay; loaded only inside the editor preview.
const DragLayer = lazy(() => import('./DragLayer.jsx'));
import { Menu, X } from 'lucide-react';
import { EditContext, SectionContext, SectionFrame } from './editing.jsx';
import { SECTION_TYPES, sectionLabel } from '../content/schema.js';
import {
  HeroSection, DetailsSection, TravelSection, CountdownSection, CardsSection,
  ScheduleSection, TextSection, GallerySection, RegistrySection, FaqSection, scrollToSection,
} from './sections/Sections.jsx';
import RsvpSection from './sections/RsvpSection.jsx';
import ThemeStyle from './ThemeStyle.jsx';
import { usePhoneLayout } from './phoneLayout.js';
import { phoneBuffer, sectionLayoutProps } from '../content/fieldStyle.js';


const COMPONENTS = {
  hero: HeroSection, details: DetailsSection, travel: TravelSection, countdown: CountdownSection,
  cards: CardsSection, schedule: ScheduleSection, text: TextSection, gallery: GallerySection,
  registry: RegistrySection, faq: FaqSection, rsvp: RsvpSection,
};

// Renders the whole wedding site from a content object.
// `edit` (optional) turns on click-to-edit; see editing.jsx.
export default function Site({ content, edit = null }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const { site, sections } = content;

  useEffect(() => {
    if (!edit && site.browserTitle) document.title = site.browserTitle;
  }, [site.browserTitle, edit]);

  useEffect(() => {
    const onScroll = () => setShowStickyHeader(window.scrollY > window.innerHeight * 0.5);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Phones: place automatically-laid-out items from their desktop intent.
  const rootRef = useRef(null);
  usePhoneLayout(rootRef, phoneBuffer(site), [content]);

  // The editor's callbacks plus site settings (grid size etc.) for editing tools.
  const editValue = useMemo(() => (edit ? { ...edit, site } : null), [edit, site]);

  const navItems = sections.filter((s) => s.visible !== false && s.showInNav);
  const go = (id) => { scrollToSection(id); setIsMenuOpen(false); };

  return (
    <EditContext.Provider value={editValue}>
      <ThemeStyle theme={content.theme} />
      <div
        ref={rootRef}
        className={`bg-paper text-ink font-details selection:bg-accent selection:text-paper overflow-x-hidden ${edit ? 'edit-mode' : ''}`}
        onClickCapture={(e) => {
          // In the editor, links shouldn't navigate away from the preview.
          if (edit && e.target.closest('a')) e.preventDefault();
        }}
      >
        <header className={`fixed top-0 left-0 w-full z-50 bg-paper/90 backdrop-blur-md border-b border-brand/15 transition-all duration-500 ease-out ${showStickyHeader ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <span className="font-title text-3xl tracking-wide text-brand">{site.coupleNames}</span>
            <button onClick={() => setIsMenuOpen(true)} aria-label="Open menu" className="text-brand hover:text-ink transition-colors">
              <Menu className="w-8 h-8 stroke-[1.5]" />
            </button>
          </div>
        </header>

        <div className={`fixed inset-0 bg-paper z-[100] flex flex-col items-center justify-center transition-all duration-500 ease-in-out ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <button onClick={() => setIsMenuOpen(false)} aria-label="Close menu" className="absolute top-6 right-6 text-brand hover:text-ink transition-colors">
            <X className="w-10 h-10 stroke-[1]" />
          </button>
          <nav className="flex flex-col items-center space-y-8 md:space-y-12">
            {navItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`font-title text-4xl md:text-6xl text-brand hover:text-ink transition-all duration-500 tracking-wide ${isMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}
                style={{ transitionDelay: isMenuOpen ? `${index * 50}ms` : '0ms' }}
              >
                {item.navLabel || sectionLabel(item)}
              </button>
            ))}
          </nav>
        </div>

        {sections.map((section, i) => {
          if (section.visible === false && !edit) return null;
          const Component = COMPONENTS[section.type];
          if (!Component) return null;
          const hidden = section.visible === false;
          return (
            <SectionContext.Provider key={section.id} value={{ section, base: `sections.${i}` }}>
              <SectionFrame label={`${SECTION_TYPES[section.type].label}${hidden ? ' · hidden' : ''}`}>
                <div
                  {...sectionLayoutProps(section.layout)}
                  className={hidden ? 'opacity-40' : ''}
                  // Desktop reading order, used to re-flow this section on phones (phoneLayout.js).
                  data-phone-order={Array.isArray(section.phoneOrder) && section.phoneOrder.length ? JSON.stringify(section.phoneOrder) : undefined}
                  data-section-base={`sections.${i}`}
                >
                  <Component site={site} />
                </div>
              </SectionFrame>
            </SectionContext.Provider>
          );
        })}

        {edit && <Suspense fallback={null}><DragLayer content={content} edit={edit} /></Suspense>}

        <footer className="py-12 bg-paper border-t border-brand/15 text-center relative z-20">
          <p className="font-title text-brand text-2xl">{site.footerText}</p>
        </footer>
      </div>
    </EditContext.Provider>
  );
}
