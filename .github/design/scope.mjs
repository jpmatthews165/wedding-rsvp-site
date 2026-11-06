// What a design-change request (from the website editor) may touch.
// Shared by the guard (.github/design/guard.mjs) and the Claude Code
// permission flags in .github/workflows/design-change.yml. Keep them in sync.
//
// Rule of thumb: how the GUEST site looks — yes. How anything works — no.

// Files (or new files) Claude may edit. Matched against repo-relative paths.
export const ALLOWED = [
  /^src\/site\/Site\.jsx$/,
  /^src\/site\/RevealOnScroll\.jsx$/,
  /^src\/site\/CoverImage\.jsx$/,
  /^src\/site\/ThemeStyle\.jsx$/,
  /^src\/site\/sections\/[A-Za-z0-9]+\.jsx$/,   // section components, incl. new ones
  /^src\/components\/[A-Za-z0-9]+\.jsx$/,        // e.g. ParallaxBackground
  /^src\/index\.css$/,
  /^src\/content\/schema\.js$/,                 // section types & editable fields
  /^src\/content\/defaultContent\.js$/,
  /^src\/content\/theme\.js$/,                  // palettes & font choices
  /^tailwind\.config\.js$/,
];

// Inside allowed folders but still off-limits (behaviour / editor wiring).
export const PROTECTED = [
  /^src\/site\/sections\/useRsvp\.js$/,
  /^src\/site\/editing\.jsx$/,
  /^src\/site\/PreviewFrame\.jsx$/,
  /^src\/site\/PublicSite\.jsx$/,
  /^src\/site\/DragLayer\.jsx$/,
];

// Written by the pipeline itself (.github/design/pending.mjs), never by Claude:
// the "Clean up" content patch + the draft it was made from. Data, not code, so the
// code checks below don't apply to it. Reset to null before a change is merged.
export const GENERATED = [/^src\/content\/designPending\.json$/];
export const isGenerated = (path) => GENERATED.some((r) => r.test(path));

export const isAllowed = (path) => isGenerated(path) || (ALLOWED.some((r) => r.test(path)) && !PROTECTED.some((r) => r.test(path)));

// Added lines may not contain these: no network, storage, secrets, raw HTML,
// dynamic code, or Firebase from visual files.
export const FORBIDDEN_CODE = [
  [/\bfetch\s*\(/, 'network request (fetch)'],
  [/XMLHttpRequest|WebSocket|EventSource|sendBeacon/, 'network request'],
  [/\/api\//, 'call to the site API'],
  [/firebase/i, 'Firebase access'],
  [/dangerouslySetInnerHTML|\.innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML/, 'raw HTML injection'],
  [/\beval\s*\(|new\s+Function\s*\(/, 'dynamic code'],
  [/\bimport\s*\(/, 'dynamic import'],
  [/document\.cookie|localStorage|sessionStorage|indexedDB/, 'browser storage'],
  [/process\.env|import\.meta\.env/, 'environment variables'],
  [/<script\b/i, 'script tag'],
  [/postMessage\s*\(/, 'cross-window messaging'],
];

// Packages visual files may import (besides relative files and CSS).
export const ALLOWED_PACKAGES = ['react', 'lucide-react'];
