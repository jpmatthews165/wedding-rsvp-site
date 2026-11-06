// Reading order of a section's items as laid out on DESKTOP, used to re-flow the
// section on phones (src/site/phoneLayout.js).
//
// Rule: split the section into horizontal bands at real horizontal gaps (nothing
// spans across them). Inside a band, read column by column from left to right, each
// column top to bottom — unless the band is a grid (rows of same-sized items, like
// cards), which reads row by row. Then the next band down. So a photo moved to the
// left of some text comes before it on the phone; a centred heading above two
// columns comes first, then the left column, then the right.
//
// items: [{ key, left, top, width, height }] in any shared coordinate space.
// Returns the keys in reading order.

const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

export function readingOrder(items) {
  const list = items
    .filter((i) => i.width > 0 && i.height > 0)
    .map((i) => ({ ...i, right: i.left + i.width, bottom: i.top + i.height }))
    .sort((a, b) => a.top - b.top || a.left - b.left);

  // 1. Bands: a new band starts only at a clear horizontal gap.
  const BAND_GAP = 40;
  const bands = [];
  for (const it of list) {
    const band = bands[bands.length - 1];
    if (band && it.top < band.bottom + BAND_GAP) {
      band.items.push(it);
      band.bottom = Math.max(band.bottom, it.bottom);
    } else {
      bands.push({ bottom: it.bottom, items: [it] });
    }
  }

  // 2. Columns inside each band: items that overlap horizontally by at least half
  //    of the narrower one share a column. Columns are read left to right.
  const order = [];
  for (const band of bands) {
    const cols = [];
    for (const it of [...band.items].sort((a, b) => a.left - b.left)) {
      const col = cols.find((c) => overlap(c.left, c.right, it.left, it.right) >= 0.5 * Math.min(it.width, c.right - c.left));
      if (col) {
        col.items.push(it);
        col.left = Math.min(col.left, it.left);
        col.right = Math.max(col.right, it.right);
      } else {
        cols.push({ left: it.left, right: it.right, items: [it] });
      }
    }
    cols.sort((a, b) => a.left - b.left);

    // Grid? Rows of items that start together and are about the same size.
    const rows = [];
    for (const it of [...band.items].sort((a, b) => a.top - b.top)) {
      const row = rows.find((r) => Math.abs(r.top - it.top) <= 12);
      if (row) row.items.push(it); else rows.push({ top: it.top, items: [it] });
    }
    const similar = (r) => {
      const hs = r.items.map((i) => i.height);
      const ws = r.items.map((i) => i.width);
      return Math.max(...hs) / Math.min(...hs) <= 1.33 && Math.max(...ws) / Math.min(...ws) <= 1.33;
    };
    const isGrid = cols.length >= 2 && rows.length >= 2
      && rows.slice(0, -1).every((r) => r.items.length >= 2 && similar(r));

    if (isGrid) rows.forEach((r) => r.items.sort((a, b) => a.left - b.left).forEach((it) => order.push(it.key)));
    else for (const c of cols) c.items.sort((a, b) => a.top - b.top).forEach((it) => order.push(it.key));
  }
  return order;
}
