import { useEffect, useState } from 'react';
import ParallaxBackground from '../../components/ParallaxBackground.jsx';
import RevealOnScroll from '../RevealOnScroll.jsx';
import { T, useShow, useSection, useEdit, ImageButton } from '../editing.jsx';
import { zonedTimeToDate, toIcsUtc } from '../../content/time.js';

const btnOutline = 'font-subtitle border border-[#6c5d84] text-[#6c5d84] px-8 py-3 text-xs tracking-[0.15em] uppercase hover:bg-[#6c5d84] hover:text-[#e6dbcc] transition-colors text-center';
const btnSolid = 'font-subtitle border border-[#6c5d84] bg-[#6c5d84] text-[#e6dbcc] px-8 py-3 text-xs tracking-[0.15em] uppercase hover:bg-[#524569] hover:border-[#524569] transition-colors shadow-sm';
const Divider = ({ center = true }) => <div className={`h-px w-24 bg-[#6c5d84]/40 ${center ? 'mx-auto' : 'mx-auto md:mx-0'}`} />;
const H2 = ({ f = 'title', className = '' }) => (
  <T f={f} as="h2" className={`font-title text-5xl md:text-7xl text-[#6c5d84] mb-6 ${className}`} placeholder="Heading" />
);

// A list item's fields are edited at e.g. "items.2.title".
const itemPath = (list, i, key) => `${list}.${i}.${key}`;

// "Add item" placeholder hint shown only in the editor when a list is empty.
const EmptyListHint = ({ label }) => {
  const edit = useEdit();
  if (!edit) return null;
  return <p className="text-center font-sans text-sm text-[#333036]/50 italic py-6">No {label} yet. Add them in the side panel.</p>;
};

export const scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

// ---------------------------------------------------------------- HERO
export function HeroSection() {
  const { section } = useSection();
  return (
    <section id={section.id} className="relative h-screen flex items-center justify-center overflow-hidden bg-[#e6dbcc]">
      <ParallaxBackground image={section.image} speed={0.35} />
      <ImageButton f="image" className="bottom-6 right-6" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#e6dbcc] via-[#e6dbcc]/40 to-transparent z-10 pointer-events-none" />
      <RevealOnScroll loadImmediately className="relative z-20 text-center space-y-8 p-4 -mt-32 md:-mt-48">
        <RevealOnScroll loadImmediately delay={0}>
          <T f="eyebrow" as="p" className="font-subtitle tracking-[0.15em] uppercase text-sm md:text-base text-[#4a4552]" />
        </RevealOnScroll>
        <RevealOnScroll loadImmediately delay={150}>
          <T f="title" as="h1" multiline className="font-title text-7xl md:text-[10rem] leading-none text-[#6c5d84] drop-shadow-sm" />
        </RevealOnScroll>
      </RevealOnScroll>
      {useShow('buttonText') && (
        <div className="absolute bottom-12 w-full text-center z-20">
          <RevealOnScroll loadImmediately delay={300}>
            <button onClick={() => scrollToSection('rsvp')} className="font-subtitle border border-[#6c5d84] bg-[#e6dbcc]/60 backdrop-blur-sm text-[#6c5d84] px-8 py-3 text-xs tracking-[0.15em] uppercase hover:bg-[#6c5d84] hover:text-[#e6dbcc] transition-colors shadow-sm">
              <T f="buttonText" />
            </button>
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
    <section id={section.id} className="relative flex items-center justify-center py-32 px-6 md:px-12 bg-[#e6dbcc]">
      <div className="max-w-6xl w-full grid md:grid-cols-2 gap-16 md:gap-24 items-center">
        <div className="space-y-10 text-center md:text-left">
          <RevealOnScroll>
            <H2 />
            <Divider center={false} />
          </RevealOnScroll>
          <RevealOnScroll delay={100} className="space-y-2">
            <T f="whenLabel" as="p" className="font-subtitle tracking-[0.1em] uppercase text-sm md:text-base text-[#4a4552]" />
            <T f="dateText" as="p" className="font-title text-4xl md:text-5xl text-[#6c5d84]" />
            <T f="timeText" as="p" className="font-details text-xl text-[#333036] tracking-wide mt-2" />
          </RevealOnScroll>
          <RevealOnScroll delay={200} className="space-y-2">
            <T f="whereLabel" as="p" className="font-subtitle tracking-[0.1em] uppercase text-sm md:text-base text-[#4a4552]" />
            <T f="venueName" as="p" className="font-title text-4xl md:text-5xl text-[#6c5d84]" />
            <T f="venueAddress" as="p" multiline className="font-details text-xl text-[#333036] tracking-wide mt-2" />
          </RevealOnScroll>
          <RevealOnScroll delay={300} className="pt-4 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            {section.showCalendarButton && (
              <button onClick={handleAddToCalendar} className="font-subtitle border border-[#6c5d84]/40 text-[#6c5d84] px-8 py-3 text-xs tracking-[0.15em] uppercase hover:border-[#6c5d84] hover:bg-[#6c5d84]/10 transition-colors">
                <T f="calendarButtonText" />
              </button>
            )}
            {useShow('rsvpButtonText') && (
              <button onClick={() => scrollToSection('rsvp')} className={btnSolid}><T f="rsvpButtonText" /></button>
            )}
          </RevealOnScroll>
          {section.showMap && section.mapQuery && (
            <RevealOnScroll delay={400}>
              <div className="w-full h-64 mt-4 relative overflow-hidden rounded shadow-sm bg-[#e5dccd] z-10 border border-[#6c5d84]/20">
                <iframe
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(section.mapQuery)}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                  title={`${section.venueName || 'Venue'} map`}
                  className="absolute inset-0 w-full h-full opacity-70 grayscale contrast-125 mix-blend-multiply"
                  style={{ border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="absolute inset-0 bg-[#333036] mix-blend-color opacity-30 pointer-events-none" />
                <div className="absolute inset-0 bg-[#e5dccd] mix-blend-screen opacity-40 pointer-events-none" />
              </div>
            </RevealOnScroll>
          )}
        </div>
        {(section.image || edit) && (
          <RevealOnScroll delay={200}>
            <div className="relative h-[80vh] w-full bg-[#d9cca8] overflow-hidden rounded-sm z-10 shadow-lg border border-[#b0c4de]/40">
              {section.image && <div className="absolute inset-0 w-full h-full bg-cover bg-center" style={{ backgroundImage: `url('${section.image}')` }} />}
              <ImageButton f="image" className="top-4 right-4" />
            </div>
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
    <section id={section.id} className="py-32 px-6 md:px-12 bg-[#e6dbcc] border-t border-[#6c5d84]/15">
      <div className="max-w-5xl mx-auto text-center">
        <RevealOnScroll>
          <H2 />
          <div className="h-px w-24 bg-[#6c5d84]/40 mx-auto mb-16" />
        </RevealOnScroll>
        <div className="grid md:grid-cols-2 gap-16 text-left">
          <RevealOnScroll delay={100} className="space-y-8">
            <T f="leftTitle" as="h3" className="font-subtitle text-3xl md:text-4xl tracking-normal text-[#6c5d84]" />
            <T f="leftIntro" as="p" multiline className="font-details text-lg text-[#333036] leading-relaxed" />
            <ul className="space-y-6">
              {airports.map((_, i) => (
                <li key={i} className="border-l-2 border-[#b0c4de] pl-4">
                  <T f={itemPath('airports', i, 'name')} className="font-subtitle text-lg tracking-normal block text-[#6c5d84]" />
                  <T f={itemPath('airports', i, 'note')} multiline className="font-details text-[#333036] leading-relaxed block" />
                </li>
              ))}
            </ul>
          </RevealOnScroll>
          <RevealOnScroll delay={200} className="space-y-8">
            <T f="rightTitle" as="h3" className="font-subtitle text-3xl md:text-4xl tracking-normal text-[#6c5d84]" />
            <T f="rightIntro" as="p" multiline className="font-details text-lg text-[#333036] leading-relaxed" />
            {hotels.map((h, i) => (
              <div key={i} className="bg-[#dccfb9] p-8 shadow-sm border border-[#333036]/15 space-y-4">
                <T f={itemPath('hotels', i, 'name')} as="p" className="font-subtitle text-2xl md:text-3xl tracking-normal text-[#6c5d84]" />
                <T f={itemPath('hotels', i, 'address')} as="p" className="font-details text-lg text-[#333036]" />
                {(h.code || edit) && (
                  <div className="pt-4 space-y-2">
                    <T f={itemPath('hotels', i, 'codeLabel')} as="p" className="font-subtitle text-xs uppercase tracking-[0.15em] text-[#333036]" />
                    <T f={itemPath('hotels', i, 'code')} as="p" className="font-subtitle text-lg tracking-normal text-[#6c5d84]" placeholder="Discount code" />
                  </div>
                )}
                {(h.url || edit) && (h.buttonText || edit) && (
                  <a href={h.url || '#'} target="_blank" rel="noopener noreferrer" className={`mt-4 block w-full ${btnOutline}`}>
                    <T f={itemPath('hotels', i, 'buttonText')} />
                  </a>
                )}
              </div>
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
    <section id={section.id} className="py-24 bg-[#6c5d84] text-[#e6dbcc] relative z-20 shadow-inner">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <RevealOnScroll>
          <T f="eyebrow" as="p" className="font-subtitle tracking-[0.15em] uppercase text-sm md:text-lg mb-12 opacity-90 text-[#e6dbcc]" />
        </RevealOnScroll>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {Object.entries(left).map(([label, value], i) => (
            <RevealOnScroll key={label} delay={i * 100}>
              <div className="space-y-2">
                <p className="font-title text-7xl md:text-8xl lg:text-9xl font-light text-[#e6dbcc] drop-shadow-sm">{value}</p>
                <p className="font-subtitle tracking-[0.15em] uppercase text-sm md:text-base opacity-90 text-[#e6dbcc]">{label}</p>
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
    <section id={section.id} className="py-32 px-6 md:px-12 bg-[#dccfb9]">
      <div className="max-w-5xl mx-auto">
        <RevealOnScroll className="text-center mb-16">
          <H2 />
          <Divider />
          <T f="intro" as="p" multiline className="mt-8 font-details text-[#333036] text-lg max-w-2xl mx-auto" />
        </RevealOnScroll>
        <EmptyListHint label="cards" />
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-8">
          {items.map((item, i) => {
            const inner = (
              <div className="border border-[#333036]/10 bg-[#e6dbcc]/80 h-full flex flex-col text-center hover:shadow-md transition-shadow overflow-hidden">
                {item.image && <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url('${item.image}')` }} />}
                <div className="p-8 flex-1 flex flex-col justify-center space-y-4">
                  <T f={itemPath('items', i, 'title')} as="h4" className="font-subtitle text-xl md:text-2xl tracking-normal text-[#6c5d84]" />
                  <T f={itemPath('items', i, 'text')} as="p" multiline className="font-details text-[#333036] leading-relaxed" />
                </div>
              </div>
            );
            return (
              <RevealOnScroll key={i} delay={(i % 3 + 1) * 100}>
                {item.url && !edit ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="block h-full">{inner}</a> : inner}
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
    <section id={section.id} className="py-32 px-6 md:px-12 bg-[#e6dbcc] border-t border-[#6c5d84]/15">
      <div className="max-w-3xl mx-auto">
        <RevealOnScroll className="text-center mb-16">
          <H2 />
          <Divider />
          <T f="intro" as="p" multiline className="mt-8 font-details text-[#333036] text-lg max-w-2xl mx-auto" />
        </RevealOnScroll>
        <EmptyListHint label="events" />
        <ol className="relative border-l border-[#6c5d84]/30 ml-3 space-y-12">
          {items.map((ev, i) => (
            <RevealOnScroll key={i} delay={i * 100}>
              <li className="pl-8 relative">
                <span className="absolute -left-[7px] top-2 w-3 h-3 rounded-full bg-[#6c5d84]" />
                <T f={itemPath('items', i, 'name')} as="h3" className="font-subtitle text-2xl md:text-3xl tracking-normal text-[#6c5d84]" />
                <p className="font-subtitle text-xs md:text-sm tracking-[0.15em] uppercase text-[#4a4552] mt-2 flex flex-wrap gap-x-3">
                  <T f={itemPath('items', i, 'date')} placeholder="Date" />
                  <T f={itemPath('items', i, 'time')} placeholder="Time" />
                </p>
                <T f={itemPath('items', i, 'location')} as="p" className="font-details text-lg text-[#333036] mt-2" placeholder="Location" />
                {(ev.attire || edit) && (
                  <p className="font-details text-[#333036]/80 italic mt-1">Attire: <T f={itemPath('items', i, 'attire')} placeholder="Attire" /></p>
                )}
                <T f={itemPath('items', i, 'description')} as="p" multiline className="font-details text-[#333036] leading-relaxed mt-3" placeholder="Description" />
              </li>
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
    <section id={section.id} className="py-32 px-6 md:px-12 bg-[#e6dbcc] border-t border-[#6c5d84]/15">
      <div className={`max-w-6xl mx-auto grid gap-16 items-center ${hasImage ? 'md:grid-cols-2' : 'max-w-3xl'}`}>
        <RevealOnScroll className={hasImage ? 'text-center md:text-left' : 'text-center'}>
          <T f="eyebrow" as="p" className="font-subtitle tracking-[0.15em] uppercase text-sm text-[#4a4552] mb-4" />
          <H2 />
          <div className={`h-px w-24 bg-[#6c5d84]/40 mb-10 ${hasImage ? 'mx-auto md:mx-0' : 'mx-auto'}`} />
          <T f="body" as="div" multiline className="font-details text-xl text-[#333036] leading-relaxed" />
          {(section.buttonText && section.buttonUrl) || edit ? (
            <div className="mt-10">
              <a href={section.buttonUrl || '#'} target="_blank" rel="noopener noreferrer" className={`inline-block ${btnOutline}`}>
                <T f="buttonText" placeholder="Button text (optional)" />
              </a>
            </div>
          ) : null}
        </RevealOnScroll>
        {hasImage && (
          <RevealOnScroll delay={200}>
            <div className="relative h-[60vh] w-full bg-[#d9cca8] overflow-hidden rounded-sm shadow-lg">
              {section.image && <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${section.image}')` }} />}
              {!section.image && <p className="absolute inset-0 flex items-center justify-center font-sans text-sm text-[#333036]/50">No photo — optional</p>}
              <ImageButton f="image" className="top-4 right-4" />
            </div>
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
    <section id={section.id} className="py-32 px-6 md:px-12 bg-[#dccfb9]">
      <div className="max-w-6xl mx-auto">
        <RevealOnScroll className="text-center mb-16">
          <H2 />
          <Divider />
          <T f="intro" as="p" multiline className="mt-8 font-details text-[#333036] text-lg max-w-2xl mx-auto" />
        </RevealOnScroll>
        {photos.length === 0 && <EmptyListHint label="photos" />}
        <div className="columns-1 sm:columns-2 md:columns-3 gap-6 [&>*]:mb-6">
          {(section.photos || []).map((p, i) => p.image && (
            <RevealOnScroll key={i} delay={(i % 3) * 100}>
              <figure className="break-inside-avoid relative">
                <img src={p.image} alt={p.caption || ''} loading="lazy" className="w-full rounded-sm shadow-md" />
                <ImageButton f={itemPath('photos', i, 'image')} className="top-3 right-3" />
                <T f={itemPath('photos', i, 'caption')} as="figcaption" className="font-details text-sm text-[#333036]/80 mt-2 text-center" placeholder="Caption (optional)" />
              </figure>
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
  const edit = useEdit();
  const links = section.links || [];
  return (
    <section id={section.id} className="relative py-40 flex items-center justify-center overflow-hidden bg-[#dccfb9]">
      {section.image && <ParallaxBackground image={section.image} speed={0.3} />}
      <ImageButton f="image" className="bottom-6 right-6" />
      <RevealOnScroll className="relative z-10 text-center max-w-2xl mx-6 bg-[#e6dbcc]/90 backdrop-blur-sm p-12 md:p-24 border border-[#333036]/10 shadow-2xl">
        <H2 />
        <T f="text" as="p" multiline className="font-details text-[#333036] text-xl leading-relaxed mb-12" />
        <div className="flex flex-col sm:flex-row flex-wrap gap-6 justify-center">
          {links.map((l, i) => (
            <a key={i} href={l.url || '#'} target="_blank" rel="noopener noreferrer"
              onClick={(e) => { if (!l.url) e.preventDefault(); }}
              className={`${btnOutline} py-4 ${!l.url && !edit ? 'opacity-60 cursor-default' : ''}`}>
              <T f={itemPath('links', i, 'label')} />
            </a>
          ))}
        </div>
        <EmptyListHint label="registry links" />
      </RevealOnScroll>
    </section>
  );
}

// ---------------------------------------------------------------- FAQ
export function FaqSection() {
  const { section } = useSection();
  const items = section.items || [];
  return (
    <section id={section.id} className="py-32 px-6 md:px-12 bg-[#dccfb9]">
      <div className="max-w-3xl mx-auto">
        <RevealOnScroll className="text-center mb-16">
          <H2 />
          <Divider />
        </RevealOnScroll>
        <EmptyListHint label="questions" />
        <div className="space-y-12">
          {items.map((_, i) => (
            <RevealOnScroll key={i} delay={Math.min(i, 4) * 100}>
              <div className="text-center md:text-left border-b border-[#333036]/10 pb-8">
                <T f={itemPath('items', i, 'q')} as="h4" className="font-subtitle text-xl md:text-2xl tracking-normal text-[#6c5d84] mb-3" />
                <T f={itemPath('items', i, 'a')} as="p" multiline className="font-details text-[#333036] text-lg leading-relaxed" />
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
