// Converts a wall-clock time at the venue ("2027-05-29T10:00" in America/New_York)
// into a real instant, regardless of the viewer's own time zone.
export const zonedTimeToDate = (local, timeZone) => {
  if (!local) return null;
  const [d, t = '00:00'] = local.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  const asUtc = Date.UTC(y, mo - 1, da, h, mi);
  if (Number.isNaN(asUtc)) return null;
  // Find the zone's offset at that moment, then correct for it.
  const offsetAt = (ms) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ms));
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms;
  };
  try {
    let guess = asUtc - offsetAt(asUtc);
    guess = asUtc - offsetAt(guess);
    return new Date(guess);
  } catch {
    return new Date(asUtc);
  }
};

// 20270529T140000Z
export const toIcsUtc = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export const COMMON_TIME_ZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'Pacific/Honolulu', 'Europe/London', 'Asia/Kolkata', 'Asia/Dubai',
];
