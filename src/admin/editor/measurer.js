// Hidden desktop (1280 px) and phone (390 px) copies of the preview, used by
// "Clean up" to measure both layouts of the same draft (src/site/measure.js runs
// inside them). Create, use, then close():
//   const m = createMeasurer(); await m.open();
//   const d = await m.measure('desktop', content, ['sections.1']);
const SIZES = { desktop: [1280, 800], phone: [390, 844] };
const TIMEOUT = 25000;

export function createMeasurer() {
  const frames = {};
  const listeners = new Set();
  const listen = (fn) => { listeners.add(fn); window.addEventListener('message', fn); };
  const unlisten = (fn) => { listeners.delete(fn); window.removeEventListener('message', fn); };
  const fromFrame = (e, f) => e.origin === window.location.origin && e.source === f.contentWindow && e.data?.source === 'wedding-measure';

  const make = (device) => new Promise((resolve, reject) => {
    const [w, h] = SIZES[device];
    const f = document.createElement('iframe');
    f.src = `/preview-frame?measure=${device}`;
    f.title = `Hidden ${device} layout`;
    f.setAttribute('aria-hidden', 'true');
    f.tabIndex = -1;
    f.style.cssText = `position:fixed;left:-40000px;top:0;width:${w}px;height:${h}px;border:0;visibility:hidden;pointer-events:none`;
    const timer = setTimeout(() => { unlisten(onMsg); reject(new Error('The layout preview took too long to load.')); }, TIMEOUT);
    const onMsg = (e) => {
      if (fromFrame(e, f) && e.data.type === 'ready') { clearTimeout(timer); unlisten(onMsg); resolve(f); }
    };
    listen(onMsg);
    frames[device] = f;
    document.body.appendChild(f);
  });

  const ask = (device, msg) => new Promise((resolve, reject) => {
    const f = frames[device];
    if (!f?.contentWindow) { reject(new Error('The layout preview is not open.')); return; }
    const id = Math.random().toString(36).slice(2);
    const timer = setTimeout(() => { unlisten(onMsg); reject(new Error('Measuring the layout took too long.')); }, TIMEOUT);
    const onMsg = (e) => {
      if (!fromFrame(e, f) || e.data.type !== 'measured' || e.data.id !== id) return;
      clearTimeout(timer);
      unlisten(onMsg);
      if (e.data.error) reject(new Error(e.data.error)); else resolve(e.data.data);
    };
    listen(onMsg);
    f.contentWindow.postMessage({ source: 'wedding-editor', type: 'measure', id, ...msg }, window.location.origin);
  });

  return {
    open: () => Promise.all([make('desktop'), make('phone')]),
    measure: (device, content, bases) => ask(device, { task: 'layout', content, bases }),
    phoneIntent: (content, bases) => ask('desktop', { task: 'phoneIntent', content, bases }),
    close: () => {
      listeners.forEach((fn) => window.removeEventListener('message', fn));
      listeners.clear();
      Object.values(frames).forEach((f) => f.remove());
    },
  };
}
