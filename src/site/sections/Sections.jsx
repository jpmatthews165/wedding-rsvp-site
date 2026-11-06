import { useEffect, useState } from 'react';
import ParallaxBackground from '../../components/ParallaxBackground.jsx';
import RevealOnScroll from '../RevealOnScroll.jsx';
import CoverImage from '../CoverImage.jsx';
import SectionBackground from '../SectionBackground.jsx';
import { safeUrl } from '../../lib/safeUrl.js';
import { T, useShow, useSection, useEdit, useLink, ImageButton, Movable, Group } from '../editing.jsx';
import { zonedTimeToDate, toIcsUtc } from '../../content/time.js';

const btnOutline = 'font-subtitle border border-brand text-brand px-8 py-3 text-xs tracking-[0.15em] uppercase hover:bg-brand hover:text-paper transition-colors text-center';
const btnSolid = 'font-subtitle border border-brand bg-brand text-paper px-8 py-3 text-xs tracking-[0.15em] uppercase hover:bg-brand-dark hover:border-brand-dark transition-colors shadow-sm';
// Decorative line under headings. Selectable/resizable in the editor (layout key "_divider").
const Divider = ({ center = true, className = '' }) => (
  <Movable f="_divider" kind="line" className={`h-px w-24 bg-brand/40 ${center ? 'mx-auto' : 'mx-auto md:mx-0'} ${className}`} />
);
const H2 = ({ f = 'title', className = '' }) => (
  <T f={f} as="h2" className={`font-title text-5xl md:text-7xl text-brand mb-6 ${className}`} placeholder="Heading" />
);

// A button that links to a section on this page ("#rsvp" scrolls there) or a web
// address (opens in a new tab). The editor's format bar sets where it goes.
// field: the content field holding its link, if the section type has one.
function LinkButton({ f, field, fallback, className = '', children }) {
  const edit = useEdit();
  const { href, internal, linkProps } = useLink(f, field, fallback);
  return (
    <Movable as="a" kind="button" f={f} {...linkProps}
      href={href || '#'} target={internal || !href ? undefined : '_blank'} rel={internal ? undefined : 'noopener noreferrer'}
      onClick={(e) => {
        if (edit || !href) { e.preventDefault(); return; }
        if (internal) { e.preventDefault(); scrollToSection(href.slice(1)); }
      }}
      className={`${className} ${!href && !edit ? 'opacity-60 cursor-default' : ''}`}>
      {children}
    </Movable>
  );
}

// A list item's fields are edited at e.g. "items.2.title".
const itemPath = (list, i, key) => `${list}.${i}.${key}`;

// "Add item" placeholder hint shown only in the editor when a list is empty.
const EmptyListHint = ({ label }) => {
  const edit = useEdit();
  if (!edit) return null;
  return <p className="text-center font-sans text-sm text-ink/50 italic py-6">No {label} yet. Add them in the side panel.</p>;
};

export const scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

// ---------------------------------------------------------------- HERO
export function HeroSection() {
  const { section } = useSection();
  return (
    <section id={section.id} className="relative h-screen flex items-center justify-center overflow-hidden bg-paper">
      <SectionBackground />
      <ParallaxBackground image={section.image} pos={section.imagePos} speed={0.35} />
      <ImageButton f="image" className="bottom-6 right-6" />
      <div className="absolute inset-0 bg-gradient-to-b from-paper via-paper/40 to-transparent z-10 pointer-events-none" />
      <RevealOnScroll loadImmediately className="relative z-20 text-center p-4 -mt-32 md:-mt-48">
        <Group f="_head" className="space-y-8">
          <RevealOnScroll loadImmediately delay={0}>
            <T f="eyebrow" as="p" className="font-subtitle tracking-[0.15em] uppercase text-sm md:text-base text-ink-soft" />
          </RevealOnScroll>
          <RevealOnScroll loadImmediately delay={150}>
            <T f="title" as="h1" multiline className="font-title text-7xl md:text-[10rem] leading-none text-brand drop-shadow-sm" />
          </RevealOnScroll>
        </Group>
      </RevealOnScroll>
      {useShow('buttonText') && (
        <div className="absolute bottom-12 w-full text-center z-20">
          <RevealOnScroll loadImmediately delay={300}>
            <LinkButton f="_btn" fallback="#rsvp" className="inline-flex items-center justify-center font-subtitle border border-brand bg-paper/60 backdrop-blur-sm text-brand px-8 py-3 text-xs tracking-[0.15em] uppercase hover:bg-brand hover:text-paper transition-colors shadow-sm">
              <T f="buttonText" />
            </LinkButton>
          </RevealOnScroll>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- DETAILS
export function DetailsSection({ site }) {
  const { section } = useSection();
  const edit = useEdit();

  const handleAddToCalendar = () => {
    if (edit) return;
    const start = zonedTimeToDate(site.weddingStart, site.timeZone);
    const end = zonedTimeToDate(site.weddingEnd || site.weddingStart, site.timeZone);
    if (!start || !end) return;
    const title = site.calendarTitle || site.coupleNames;
    const location = site.calendarLocation || '';
    if (/Mac|iPod|iPhone|iPad/.test(navigator.userAgent)) {
      const ics = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wedding//EN', 'BEGIN:VEVENT',
        `UID:wedding-${toIcsUtc(start)}@joshandsneha2027.com`, `DTSTAMP:${toIcsUtc(new Date())}`,
        `DTSTART:${toIcsUtc(start)}`, `DTEND:${toIcsUtc(end)}`,
        `SUMMARY:${title.replace(/,/g, '\\,')}`, `LOCATION:${location.replace(/,/g, '\\,')}`,
        'END:VEVENT', 'END:VCALENDAR',
      ].join('\r\n');
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'Wedding.ics';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      const g = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${toIcsUtc(start)}/${toIcsUtc(end)}&location=${encodeURIComponent(location)}`;
      window.open(g, '_blank', 'noopener');
    }
  };

  return (
    <section id={section.id} className="relative flex items-center justify-center py-32 px-6 md:px-12 bg-paper">
      <SectionBackground />
      <div className="max-w-6xl w-full grid md:grid-cols-2 gap-16 md:gap-24 items-center">
        <div className="space-y-10 text-center md:text-left">
          <RevealOnScroll>
            <Group f="_head">
              <H2 />
              <Divider center={false} />
            </Group>
          </RevealOnScroll>
          <RevealOnScroll delay={100}>
            <Group f="_when" className="space-y-2">
              <T f="whenLabel" as="p" className="font-subtitle tracking-[0.1em] uppercase text-sm md:text-base text-ink-soft" />
              <T f="dateText" as="p" className="font-title text-4xl md:text-5xl text-brand" />
              <T f="timeText" as="p" className="font-details text-xl text-ink tracking-wide mt-2" />
            </Group>
          </RevealOnScroll>
          <RevealOnScroll delay={200}>
            <Group f="_where" className="space-y-2">
              <T f="whereLabel" as="p" className="font-subtitle tracking-[0.1em] uppercase text-sm md:text-base text-ink-soft" />
              <T f="venueName" as="p" className="font-title text-4xl md:text-5xl text-brand" />
              <T f="venueAddress" as="p" multiline className="font-details text-xl text-ink tracking-wide mt-2" />
            </Group>
          </RevealOnScroll>
          <RevealOnScroll delay={300} className="pt-4 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            {section.showCalendarButton && (
              <Movable as="button" kind="button" f="_btnCalendar" onClick={handleAddToCalendar} className="inline-flex items-center justify-center font-subtitle border border-brand/40 text-brand px-8 py-3 text-xs tracking-[0.15em] uppercase hover:border-brand hover:bg-brand/10 transition-colors">
                <T f="calendarButtonText" />
              </Movable>
            )}
            {useShow('rsvpButtonText') && (
              <LinkButton f="_btnRsvp" fallback="#rsvp" className={`inline-flex items-center justify-center ${btnSolid}`}><T f="rsvpButtonText" /></LinkButton>
            )}
          </RevealOnScroll>
          {section.showMap && section.mapQuery && (
            <RevealOnScroll delay={400}>
              <Movable f="_map" kind="map" className="w-full h-64 mt-4 relative overflow-hidden rounded shadow-sm bg-paper z-10 border border-brand/20">
                <iframe
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(section.mapQuery)}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                  title={`${section.venueName || 'Venue'} map`}
                  className="absolute inset-0 w-full h-full opacity-70 grayscale contrast-125 mix-blend-multiply"
                  style={{ border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="absolute inset-0 bg-ink mix-blend-color opacity-30 pointer-events-none" />
                <div className="absolute inset-0 bg-paper mix-blend-screen opacity-40 pointer-events-none" />
              </Movable>
            </RevealOnScroll>
          )}
        </div>
        {(section.image || edit) && (
          <RevealOnScroll delay={200}>
            <Movable f="image" className="relative h-[80vh] w-full bg-paper2 overflow-hidden rounded-sm z-10 shadow-lg border border-accent2/40">
              <CoverImage src={section.image} pos={section.imagePos} />
              <ImageButton f="image" className="top-4 right-4" />
            </Movable>
          </RevealOnScroll>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- TRAVEL
export function TravelSection() {
  const { section } = useSection();
  const edit = useEdit();
  const airports = section.airports || [];
  const hotels = section.hotels || [];
  return (
    <section id={section.id} className="py-32 px-6 md:px-12 bg-paper border-t border-brand/15">
      <SectionBackground />
      <div className="max-w-5xl mx-auto text-center">
        <RevealOnScroll>
          <Group f="_head" className="mb-16">
            <H2 />
            <Divider />
          </Group>
        </RevealOnScroll>
        <div className="grid md:grid-cols-2 gap-16 text-left">
          <RevealOnScroll delay={100} className="space-y-8">
            <Group f="_left" className="space-y-8">
              <T f="leftTitle" as="h3" className="font-subtitle text-3xl md:text-4xl tracking-normal text-brand" />
              <T f="leftIntro" as="p" multiline className="font-details text-lg text-ink leading-relaxed" />
            </Group>
            <ul className="space-y-6">
              {airports.map((_, i) => (
                <Group as="li" key={i} f={itemPath('airports', i, '_item')} className="border-l-2 border-accent2 pl-4">
                  <T f={itemPath('airports', i, 'name')} className="font-subtitle text-lg tracking-normal block text-brand" />
                  <T f={itemPath('airports', i, 'note')} multiline className="font-details text-ink leading-relaxed block" />
                </Group>
              ))}
            </ul>
          </RevealOnScroll>
          <RevealOnScroll delay={200} className="space-y-8">
            <Group f="_right" className="space-y-8">
              <T f="rightTitle" as="h3" className="font-subtitle text-3xl md:text-4xl tracking-normal text-brand" />
              <T f="rightIntro" as="p" multiline className="font-details text-lg text-ink leading-relaxed" />
            </Group>
            {hotels.map((h, i) => (
              <Movable key={i} f={itemPath('hotels', i, '_box')} kind="box" className="bg-paper2 p-8 shadow-sm border border-ink/15 space-y-4">
                <T f={itemPath('hotels', i, 'name')} as="p" className="font-subtitle text-2xl md:text-3xl tracking-normal text-brand" />
                <T f={itemPath('hotels', i, 'address')} as="p" className="font-details text-lg text-ink" />
                {(h.code || edit) && (
                  <div className="pt-4 space-y-2">
                    <T f={itemPath('hotels', i, 'codeLabel')} as="p" className="font-subtitle text-xs uppercase tracking-[0.15em] text-ink" />
                    <T f={itemPath('hotels', i, 'code')} as="p" className="font-subtitle text-lg tracking-normal text-brand" placeholder="Discount code" />
                  </div>
                )}
                {(safeUrl(h.url) || edit) && (h.buttonText || edit) && (
                  <LinkButton f={itemPath('hotels', i, '_btn')} field={itemPath('hotels', i, 'url')} className={`mt-4 flex items-center justify-center w-full ${btnOutline}`}>
                    <T f={itemPath('hotels', i, 'buttonText')} />
                  </LinkButton>
                )}
              </Movable>
            ))}
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- COUNTDOWN
const timeLeft = (target) => {
  const d = Math.max(0, target - Date.now());
  return {
    Days: Math.floor(d / 86400000),
    Hours: Math.floor((d % 86400000) / 3600000),
    Minutes: Math.floor((d % 3600000) / 60000),
    Seconds: Math.floor((d % 60000) / 1000),
  };
};

export function CountdownSection({ site }) {
  const { section } = useSection();
  const target = zonedTimeToDate(site.weddingStart, site.timeZone)?.getTime() ?? 0;
  const [left, setLeft] = useState(() => timeLeft(target));
  useEffect(() => {
    const id = setInterval(() => setLeft(timeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target]);
  return (
    <section id={section.id} className="py-24 bg-brand text-paper relative z-20 shadow-inner">
      <SectionBackground />
      <div className="max-w-4xl mx-auto px-6 text-center">
        <RevealOnScroll>
          <T f="eyebrow" as="p" className="font-subtitle tracking-[0.15em] uppercase text-sm md:text-lg mb-12 opacity-90 text-paper" />
        </RevealOnScroll>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {Object.entries(left).map(([label, value], i) => (
            <RevealOnScroll key={label} delay={i * 100}>
              <div className="space-y-2">
                <p className="font-title text-7xl md:text-8xl lg:text-9xl font-light text-paper drop-shadow-sm">{value}</p>
                <p className="font-subtitle tracking-[0.15em] uppercase text-sm md:text-base opacity-90 text-paper">{label}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- CARDS
export function CardsSection() {
  const { section } = useSection();
  const edit = useEdit();
  const items = section.items || [];
  return (
    <section id={section.id} className="py-32 px-6 md:px-12 bg-paper2">
      <SectionBackground />
      <div className="max-w-5xl mx-auto">
        <RevealOnScroll className="text-center mb-16">
          <Group f="_head">
            <H2 />
            <Divider />
            <T f="intro" as="p" multiline className="mt-8 font-details text-ink text-lg max-w-2xl mx-auto" />
          </Group>
        </RevealOnScroll>
        <EmptyListHint label="cards" />
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-8">
          {items.map((item, i) => {
            const inner = (
              <Movable f={itemPath('items', i, '_card')} kind="box" className="border border-ink/10 bg-paper/80 h-full flex flex-col text-center hover:shadow-md transition-shadow overflow-hidden">
                {item.image && <Movable f={itemPath('items', i, 'image')} className="relative h-48 overflow-hidden"><CoverImage src={item.image} pos={item.imagePos} /><ImageButton f={itemPath('items', i, 'image')} className="top-2 right-2" /></Movable>}
                <div className="p-8 flex-1 flex flex-col justify-center space-y-4">
                  <T f={itemPath('items', i, 'title')} as="h4" className="font-subtitle text-xl md:text-2xl tracking-normal text-brand" />
                  <T f={itemPath('items', i, 'text')} as="p" multiline className="font-details text-ink leading-relaxed" />
                </div>
              </Movable>
            );
            return (
              <RevealOnScroll key={i} delay={(i % 3 + 1) * 100}>
                {safeUrl(item.url) && !edit ? <a href={safeUrl(item.url)} target="_blank" rel="noopener noreferrer" className="block h-full">{inner}</a> : inner}
              </RevealOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- SCHEDULE
export function ScheduleSection() {
  const { section } = useSection();
  const edit = useEdit();
  const items = section.items || [];
  return (
    <section id={section.id} className="py-32 px-6 md:px-12 bg-paper border-t border-brand/15">
      <SectionBackground />
      <div className="max-w-3xl mx-auto">
        <RevealOnScroll className="text-center mb-16">
          <Group f="_head">
            <H2 />
            <Divider />
            <T f="intro" as="p" multiline className="mt-8 font-details text-ink text-lg max-w-2xl mx-auto" />
          </Group>
        </RevealOnScroll>
        <EmptyListHint label="events" />
        <ol className="relative border-l border-brand/30 ml-3 space-y-12">
          {items.map((ev, i) => (
            <RevealOnScroll key={i} delay={i * 100}>
              <Group as="li" f={itemPath('items', i, '_item')} className="pl-8 relative">
                <span className="absolute -left-[7px] top-2 w-3 h-3 rounded-full bg-brand" />
                <T f={itemPath('items', i, 'name')} as="h3" className="font-subtitle text-2xl md:text-3xl tracking-normal text-brand" />
                <p className="font-subtitle text-xs md:text-sm tracking-[0.15em] uppercase text-ink-soft mt-2 flex flex-wrap gap-x-3">
                  <T f={itemPath('items', i, 'date')} placeholder="Date" />
                  <T f={itemPath('items', i, 'time')} placeholder="Time" />
                </p>
                <T f={itemPath('items', i, 'location')} as="p" className="font-details text-lg text-ink mt-2" placeholder="Location" />
                {(ev.attire || edit) && (
                  <p className="font-details text-ink/80 italic mt-1">Attire: <T f={itemPath('items', i, 'attire')} placeholder="Attire" /></p>
                )}
                <T f={itemPath('items', i, 'description')} as="p" multiline className="font-details text-ink leading-relaxed mt-3" placeholder="Description" />
              </Group>
            </RevealOnScroll>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- TEXT
export function TextSection() {
  const { section } = useSection();
  const edit = useEdit();
  const hasImage = !!section.image || !!edit;
  return (
    <section id={section.id} className="py-32 px-6 md:px-12 bg-paper border-t border-brand/15">
      <SectionBackground />
      <div className={`max-w-6xl mx-auto grid gap-16 items-center ${hasImage ? 'md:grid-cols-2' : 'max-w-3xl'}`}>
        <RevealOnScroll className={hasImage ? 'text-center md:text-left' : 'text-center'}>
          <Group f="_text">
            <T f="eyebrow" as="p" className="font-subtitle tracking-[0.15em] uppercase text-sm text-ink-soft mb-4" />
            <H2 />
            <Divider center={!hasImage} className="mb-10" />
            <T f="body" as="div" multiline className="font-details text-xl text-ink leading-relaxed" />
          </Group>
          {(section.buttonText && safeUrl(section.buttonUrl)) || edit ? (
            <div className="mt-10">
              <LinkButton f="_btn" field="buttonUrl" className={`inline-flex items-center justify-center ${btnOutline}`}>
                <T f="buttonText" placeholder="Button text (optional)" />
              </LinkButton>
            </div>
          ) : null}
        </RevealOnScroll>
        {hasImage && (
          <RevealOnScroll delay={200}>
            <Movable f="image" className="relative h-[60vh] w-full bg-paper2 overflow-hidden rounded-sm shadow-lg">
              <CoverImage src={section.image} pos={section.imagePos} />
              {!section.image && <p className="absolute inset-0 flex items-center justify-center font-sans text-sm text-ink/50">No photo — optional</p>}
              <ImageButton f="image" className="top-4 right-4" />
            </Movable>
          </RevealOnScroll>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- GALLERY
export function GallerySection() {
  const { section } = useSection();
  const photos = (section.photos || []).filter((p) => p.image);
  return (
    <section id={section.id} className="py-32 px-6 md:px-12 bg-paper2">
      <SectionBackground />
      <div className="max-w-6xl mx-auto">
        <RevealOnScroll className="text-center mb-16">
          <Group f="_head">
            <H2 />
            <Divider />
            <T f="intro" as="p" multiline className="mt-8 font-details text-ink text-lg max-w-2xl mx-auto" />
          </Group>
        </RevealOnScroll>
        {photos.length === 0 && <EmptyListHint label="photos" />}
        <div className="columns-1 sm:columns-2 md:columns-3 gap-6 [&>*]:mb-6">
          {(section.photos || []).map((p, i) => p.image && (
            <RevealOnScroll key={i} delay={(i % 3) * 100}>
              <Movable f={itemPath('photos', i, 'image')} as="figure" className="break-inside-avoid relative">
                <img src={p.image} alt={p.caption || ''} loading="lazy" className="w-full rounded-sm shadow-md" />
                <ImageButton f={itemPath('photos', i, 'image')} className="top-3 right-3" />
                <T f={itemPath('photos', i, 'caption')} as="figcaption" className="font-details text-sm text-ink/80 mt-2 text-center" placeholder="Caption (optional)" />
              </Movable>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- REGISTRY
export function RegistrySection() {
  const { section } = useSection();
  const links = section.links || [];
  return (
    <section id={section.id} className="relative py-40 flex items-center justify-center overflow-hidden bg-paper2">
      <SectionBackground />
      {section.image && <ParallaxBackground image={section.image} pos={section.imagePos} speed={0.3} />}
      <ImageButton f="image" className="bottom-6 right-6" />
      <RevealOnScroll className="relative z-10 max-w-2xl mx-6">
        <Movable f="_panel" kind="box" className="text-center bg-paper/90 backdrop-blur-sm p-12 md:p-24 border border-ink/10 shadow-2xl">
          <Group f="_head">
            <H2 />
            <T f="text" as="p" multiline className="font-details text-ink text-xl leading-relaxed mb-12" />
          </Group>
          <div className="flex flex-col sm:flex-row flex-wrap gap-6 justify-center">
            {links.map((l, i) => (
              <LinkButton key={i} f={itemPath('links', i, '_btn')} field={itemPath('links', i, 'url')} className={`inline-flex items-center justify-center ${btnOutline} py-4`}>
                <T f={itemPath('links', i, 'label')} />
              </LinkButton>
            ))}
          </div>
          <EmptyListHint label="registry links" />
        </Movable>
      </RevealOnScroll>
    </section>
  );
}

// ---------------------------------------------------------------- FAQ
export function FaqSection() {
  const { section } = useSection();
  const items = section.items || [];
  return (
    <section id={section.id} className="py-32 px-6 md:px-12 bg-paper2">
      <SectionBackground />
      <div className="max-w-3xl mx-auto">
        <RevealOnScroll className="text-center mb-16">
          <Group f="_head">
            <H2 />
            <Divider />
          </Group>
        </RevealOnScroll>
        <EmptyListHint label="questions" />
        <div className="space-y-12">
          {items.map((_, i) => (
            <RevealOnScroll key={i} delay={Math.min(i, 4) * 100}>
              <Group f={itemPath('items', i, '_item')} className="text-center md:text-left border-b border-ink/10 pb-8">
                <T f={itemPath('items', i, 'q')} as="h4" className="font-subtitle text-xl md:text-2xl tracking-normal text-brand mb-3" />
                <T f={itemPath('items', i, 'a')} as="p" multiline className="font-details text-ink text-lg leading-relaxed" />
              </Group>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
