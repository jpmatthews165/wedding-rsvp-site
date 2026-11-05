// Describes every editable field. The editor's forms are generated from this,
// and the AI assistant receives it so it knows what can be changed.
//
// Field types: text, textarea, image, url, toggle, datetime, timezone, list
// A list has `itemFields` and `newItem` (template for "Add" button).

const navFields = [
  { key: 'navLabel', label: 'Menu label', type: 'text', help: 'Name shown in the site menu.' },
  { key: 'showInNav', label: 'Show in menu', type: 'toggle' },
];

export const SITE_FIELDS = [
  { key: 'coupleNames', label: 'Couple names (header)', type: 'text' },
  { key: 'browserTitle', label: 'Browser tab title', type: 'text' },
  { key: 'weddingStart', label: 'Wedding starts', type: 'datetime', help: 'Used for the countdown and calendar invite.' },
  { key: 'weddingEnd', label: 'Wedding ends', type: 'datetime' },
  { key: 'timeZone', label: 'Time zone', type: 'timezone' },
  { key: 'calendarTitle', label: 'Calendar invite title', type: 'text' },
  { key: 'calendarLocation', label: 'Calendar invite location', type: 'text' },
  { key: 'footerText', label: 'Footer text', type: 'text' },
];

export const SECTION_TYPES = {
  hero: {
    label: 'Cover (hero)', description: 'Full-screen photo with your names.', unique: true,
    fields: [
      { key: 'eyebrow', label: 'Small text above names', type: 'text' },
      { key: 'title', label: 'Big title', type: 'textarea', help: 'Press Enter for a new line.' },
      { key: 'buttonText', label: 'Button text', type: 'text' },
      { key: 'image', label: 'Background photo', type: 'image' },
      ...navFields,
    ],
    template: { eyebrow: 'We invite you to celebrate with us', title: 'Our Names', buttonText: 'RSVP Now', image: '/hero.jpg' },
  },
  details: {
    label: 'Wedding details', description: 'When & where, map, calendar button, photo.',
    fields: [
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'whenLabel', label: '"When" label', type: 'text' },
      { key: 'dateText', label: 'Date (as shown)', type: 'text' },
      { key: 'timeText', label: 'Time (as shown)', type: 'text' },
      { key: 'whereLabel', label: '"Where" label', type: 'text' },
      { key: 'venueName', label: 'Venue name', type: 'text' },
      { key: 'venueAddress', label: 'Venue address', type: 'textarea' },
      { key: 'showMap', label: 'Show map', type: 'toggle' },
      { key: 'mapQuery', label: 'Map search address', type: 'text', help: 'What Google Maps should search for.' },
      { key: 'showCalendarButton', label: 'Show "Add to Calendar" button', type: 'toggle' },
      { key: 'calendarButtonText', label: 'Calendar button text', type: 'text' },
      { key: 'rsvpButtonText', label: 'RSVP button text', type: 'text' },
      { key: 'image', label: 'Photo', type: 'image' },
      ...navFields,
    ],
    template: { title: 'The Ceremony', whenLabel: 'When', dateText: 'Date', timeText: 'Time', whereLabel: 'Where', venueName: 'Venue', venueAddress: 'Address', mapQuery: '', showMap: true, showCalendarButton: false, calendarButtonText: 'Add to Calendar', rsvpButtonText: 'RSVP', image: '/details.jpg' },
  },
  travel: {
    label: 'Travel & stay', description: 'Airports/directions and hotel blocks.',
    fields: [
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'leftTitle', label: 'Left column heading', type: 'text' },
      { key: 'leftIntro', label: 'Left column intro', type: 'textarea' },
      { key: 'airports', label: 'Airports / ways to get here', type: 'list', itemLabel: 'name',
        itemFields: [{ key: 'name', label: 'Name', type: 'text' }, { key: 'note', label: 'Details', type: 'textarea' }],
        newItem: { name: 'New airport', note: '' } },
      { key: 'rightTitle', label: 'Right column heading', type: 'text' },
      { key: 'rightIntro', label: 'Right column intro', type: 'textarea' },
      { key: 'hotels', label: 'Hotels', type: 'list', itemLabel: 'name',
        itemFields: [
          { key: 'name', label: 'Hotel name', type: 'text' },
          { key: 'address', label: 'Address', type: 'text' },
          { key: 'codeLabel', label: 'Code label', type: 'text' },
          { key: 'code', label: 'Discount code', type: 'text', help: 'Leave empty to hide.' },
          { key: 'buttonText', label: 'Button text', type: 'text' },
          { key: 'url', label: 'Booking link', type: 'url', help: 'Leave empty to hide the button.' },
        ],
        newItem: { name: 'New hotel', address: '', codeLabel: 'Discount Code', code: '', buttonText: 'Book Room', url: '' } },
      ...navFields,
    ],
    template: { title: 'Travel & Stay', leftTitle: 'Getting Here', leftIntro: '', airports: [], rightTitle: 'Accommodations', rightIntro: '', hotels: [] },
  },
  countdown: {
    label: 'Countdown', description: 'Days/hours/minutes/seconds until the wedding.',
    fields: [{ key: 'eyebrow', label: 'Text above countdown', type: 'text' }, ...navFields],
    template: { eyebrow: 'Counting down the days' },
  },
  cards: {
    label: 'Cards', description: 'A grid of cards — local favorites, things to do, people…',
    fields: [
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'intro', label: 'Intro text', type: 'textarea' },
      { key: 'items', label: 'Cards', type: 'list', itemLabel: 'title',
        itemFields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'text', label: 'Text', type: 'textarea' },
          { key: 'image', label: 'Photo (optional)', type: 'image' },
          { key: 'url', label: 'Link (optional)', type: 'url' },
        ],
        newItem: { title: 'New card', text: '', image: '', url: '' } },
      ...navFields,
    ],
    template: { title: 'New Section', intro: '', items: [{ title: 'Card title', text: 'Card text', image: '', url: '' }] },
  },
  schedule: {
    label: 'Schedule', description: 'A timeline of events (sangeet, mehndi, ceremony, reception…).',
    fields: [
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'intro', label: 'Intro text', type: 'textarea' },
      { key: 'items', label: 'Events', type: 'list', itemLabel: 'name',
        itemFields: [
          { key: 'name', label: 'Event name', type: 'text' },
          { key: 'date', label: 'Date (as shown)', type: 'text' },
          { key: 'time', label: 'Time (as shown)', type: 'text' },
          { key: 'location', label: 'Location', type: 'text' },
          { key: 'attire', label: 'Attire', type: 'text' },
          { key: 'description', label: 'Description', type: 'textarea' },
        ],
        newItem: { name: 'New event', date: '', time: '', location: '', attire: '', description: '' } },
      ...navFields,
    ],
    template: { title: 'Schedule', intro: '', items: [{ name: 'Ceremony', date: 'Saturday, May 29', time: '10:00 AM', location: "Lucien's Manor", attire: '', description: '' }] },
  },
  text: {
    label: 'Text block', description: 'A heading with paragraphs — our story, a note, anything.',
    fields: [
      { key: 'eyebrow', label: 'Small text above heading', type: 'text' },
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'body', label: 'Text', type: 'textarea', help: 'Leave a blank line between paragraphs.' },
      { key: 'image', label: 'Photo (optional)', type: 'image' },
      { key: 'buttonText', label: 'Button text (optional)', type: 'text' },
      { key: 'buttonUrl', label: 'Button link', type: 'url' },
      ...navFields,
    ],
    template: { eyebrow: '', title: 'Our Story', body: 'Write something here.', image: '', buttonText: '', buttonUrl: '' },
  },
  gallery: {
    label: 'Photo gallery', description: 'A grid of photos.',
    fields: [
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'intro', label: 'Intro text', type: 'textarea' },
      { key: 'photos', label: 'Photos', type: 'list', itemLabel: 'caption',
        itemFields: [{ key: 'image', label: 'Photo', type: 'image' }, { key: 'caption', label: 'Caption (optional)', type: 'text' }],
        newItem: { image: '', caption: '' } },
      ...navFields,
    ],
    template: { title: 'Gallery', intro: '', photos: [] },
  },
  registry: {
    label: 'Registry', description: 'Gift message, background photo and registry links.',
    fields: [
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'text', label: 'Message', type: 'textarea' },
      { key: 'image', label: 'Background photo', type: 'image' },
      { key: 'links', label: 'Registry links', type: 'list', itemLabel: 'label',
        itemFields: [{ key: 'label', label: 'Button text', type: 'text' }, { key: 'url', label: 'Link', type: 'url' }],
        newItem: { label: 'New registry', url: '' } },
      ...navFields,
    ],
    template: { title: 'Registry', text: '', image: '/registry.jpg', links: [] },
  },
  faq: {
    label: 'Questions (FAQ)', description: 'Questions and answers.',
    fields: [
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'items', label: 'Questions', type: 'list', itemLabel: 'q',
        itemFields: [{ key: 'q', label: 'Question', type: 'text' }, { key: 'a', label: 'Answer', type: 'textarea' }],
        newItem: { q: 'New question?', a: '' } },
      ...navFields,
    ],
    template: { title: 'FAQ', items: [] },
  },
  rsvp: {
    label: 'RSVP', description: 'Guest lookup and RSVP form.', unique: true,
    fields: [
      { key: 'eyebrow', label: 'Small text above heading', type: 'text' },
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'placeholder', label: 'Search box placeholder', type: 'text' },
      { key: 'buttonText', label: 'Search button text', type: 'text' },
      { key: 'completeButtonText', label: '"Done" button text', type: 'text' },
      { key: 'image', label: 'Background photo', type: 'image' },
      ...navFields,
    ],
    template: { eyebrow: 'We eagerly await your reply', title: 'RSVP', placeholder: 'Enter Full Name', buttonText: 'Find RSVP', completeButtonText: 'Complete RSVP', image: '' },
  },
};

export const sectionLabel = (section) =>
  section.navLabel || section.title || SECTION_TYPES[section.type]?.label || section.type;

export const newSectionId = (type, sections) => {
  const taken = new Set(sections.map((s) => s.id));
  let i = 1;
  let id = type;
  while (taken.has(id)) id = `${type}-${++i}`;
  return id;
};

export const makeSection = (type, sections) => {
  const def = SECTION_TYPES[type];
  return {
    id: newSectionId(type, sections),
    type,
    visible: true,
    showInNav: false,
    navLabel: def.template.title || def.label,
    ...structuredClone(def.template),
  };
};

// Fills in any missing fields from defaults so old drafts keep working when we add fields.
export const normalizeContent = (raw, defaults) => {
  if (!raw || !Array.isArray(raw.sections)) return structuredClone(defaults);
  return {
    ...structuredClone(defaults),
    ...raw,
    site: { ...defaults.site, ...(raw.site || {}) },
    sections: raw.sections.filter((s) => s && SECTION_TYPES[s.type]).map((s) => ({
      visible: true, showInNav: false, ...SECTION_TYPES[s.type].template, ...s,
    })),
  };
};
