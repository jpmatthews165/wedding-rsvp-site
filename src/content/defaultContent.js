// The site's starting content — exactly what was hard-coded before the editor existed.
// The live site reads the published copy from Firestore (settings/content) and falls
// back to this if nothing has been published yet.
//
// Shape notes (keep in sync with schema.js and api/assistant.js):
// - Text fields may contain "\n" for line breaks.
// - Every section has: id (unique), type, visible, showInNav, navLabel.

export const DEFAULT_CONTENT = {
  version: 1,
  site: {
    coupleNames: 'Josh & Sneha',
    browserTitle: 'Josh & Sneha · May 29, 2027',
    weddingStart: '2027-05-29T10:00',
    weddingEnd: '2027-05-29T16:00',
    timeZone: 'America/New_York',
    calendarTitle: 'Josh & Sneha Wedding',
    calendarLocation: "Lucien's Manor, 81 W White Horse Pike, Berlin, NJ 08009",
    footerText: 'J & S',
  },
  sections: [
    {
      id: 'home', type: 'hero', visible: true, showInNav: true, navLabel: 'Home',
      eyebrow: 'We invite you to celebrate with us',
      title: 'Josh &\nSneha',
      buttonText: 'RSVP Now',
      image: '/hero.jpg',
    },
    {
      id: 'details', type: 'details', visible: true, showInNav: true, navLabel: 'Details',
      title: 'The Wedding',
      whenLabel: 'When',
      dateText: 'Saturday, May 29th',
      timeText: "Ten O'Clock in the Morning",
      whereLabel: 'Where',
      venueName: "Lucien's Manor",
      venueAddress: '81 W White Horse Pike\nBerlin, NJ 08009',
      mapQuery: "Lucien's Manor, 81 W White Horse Pike, Berlin, NJ",
      showMap: true,
      showCalendarButton: true,
      calendarButtonText: 'Add to Calendar',
      rsvpButtonText: 'RSVP',
      image: '/details.jpg',
    },
    {
      id: 'travel', type: 'travel', visible: true, showInNav: true, navLabel: 'Travel',
      title: 'Travel & Stay',
      leftTitle: 'Getting Here',
      leftIntro: 'For our out-of-town guests, there are two primary airports we recommend flying into:',
      airports: [
        { name: 'Philadelphia International (PHL)', note: 'Approx. 40 minutes from the venue. The most convenient option.' },
        { name: 'Newark Liberty International (EWR)', note: 'Approx. 90 minutes from the venue. May offer more direct flights.' },
      ],
      rightTitle: 'Accommodations',
      rightIntro: 'We have secured a block of rooms at a special rate for our guests. Please book before April 29th to ensure availability.',
      hotels: [
        { name: 'The Grand Hotel Placeholder', address: '123 Hotel Avenue, Mount Laurel, NJ', codeLabel: 'Discount Code', code: 'MATTHEWS27', buttonText: 'Book Room', url: '' },
      ],
    },
    {
      id: 'countdown', type: 'countdown', visible: true, showInNav: false, navLabel: 'Countdown',
      eyebrow: 'Counting down the days',
    },
    {
      id: 'activities', type: 'cards', visible: true, showInNav: false, navLabel: 'Local Favorites',
      title: 'Local Favorites',
      intro: 'If you have some extra time during the weekend, here are a few of our favorite spots to eat, drink, and explore.',
      items: [
        { title: 'Reading Terminal Market', text: 'A historic public market in Philly with incredible food stalls. Grab a roast pork sandwich!', url: '' },
        { title: 'Sharrott Winery', text: 'Located nearby in South Jersey, this is a beautiful spot to relax with a glass of wine and live music.', url: '' },
        { title: 'Philadelphia Historic District', text: 'Take a stroll past the Liberty Bell and Independence Hall just across the bridge.', url: '' },
      ],
    },
    {
      id: 'registry', type: 'registry', visible: true, showInNav: true, navLabel: 'Registry',
      title: 'Registry',
      text: 'Your presence at our wedding is the greatest gift we could ask for. Should you wish to honor us with a gift, we are registered at the links below.',
      image: '/registry.jpg',
      links: [
        { label: 'Cash Fund', url: '' },
        { label: 'Amazon', url: '' },
      ],
    },
    {
      id: 'faq', type: 'faq', visible: true, showInNav: true, navLabel: 'FAQ',
      title: 'FAQ',
      items: [
        { q: 'What is the dress code?', a: 'We request formal / black-tie optional attire. Please avoid wearing white.' },
        { q: 'Are children invited?', a: 'While we love your little ones, our wedding is going to be an adults-only event so that everyone can relax and enjoy the evening. We appreciate you making arrangements ahead of time.' },
        { q: 'Will there be parking at the venue?', a: "Yes, Lucien's Manor offers complimentary valet and self-parking for all guests." },
        { q: 'When is the RSVP deadline?', a: 'Please kindly respond by April 29th using the form below so we can have a final headcount.' },
      ],
    },
    {
      id: 'rsvp', type: 'rsvp', visible: true, showInNav: true, navLabel: 'RSVP',
      eyebrow: 'We eagerly await your reply',
      title: 'RSVP',
      placeholder: 'Enter Full Name',
      buttonText: 'Find RSVP',
      completeButtonText: 'Complete RSVP',
      image: 'https://images.unsplash.com/photo-1618108571494-7065bc619e68?q=80&w=1600&auto=format&fit=crop',
    },
  ],
};
