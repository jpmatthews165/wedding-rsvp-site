// Scope guard for design-change requests. Runs in CI after Claude Code edits
// the files and BEFORE anything is committed. Exits non-zero (and prints a
// GitHub ::error annotation the editor shows to Sneha) if the change:
//   - touches any file outside the allowed visual files,
//   - adds network/storage/HTML-injection/dynamic code,
//   - imports a package other than react / lucide-react,
//   - removes safeUrl() link protection.
// Usage: node .github/design/guard.mjs <base-ref>   (changes must be staged)
import { execFileSync } from 'node:child_process';
import { isAllowed, isGenerated, FORBIDDEN_CODE, ALLOWED_PACKAGES } from './scope.mjs';

const base = process.argv[2] || 'origin/main';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });

const problems = [];

// 1. Which files changed (added, modified, deleted, renamed) vs main.
const changed = git('diff', '--cached', '--name-status', '-M', base).trim().split('\n').filter(Boolean);
for (const line of changed) {
  const [status, ...paths] = line.split('\t');
  for (const p of paths) {
    if (!isAllowed(p)) problems.push(`Not allowed to change ${p} (only the guest site's visual files can change).`);
  }
  if (status.startsWith('D')) problems.push(`Not allowed to delete ${paths[0]}.`);
}

// 2. What was added inside the allowed files.
const diff = git('diff', '--cached', '-U0', base);
let file = '';
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ ')) { file = line.replace(/^\+\+\+ b\//, ''); continue; }
  if (!line.startsWith('+') || line.startsWith('+++') || isGenerated(file)) continue;
  const code = line.slice(1);
  for (const [re, what] of FORBIDDEN_CODE) {
    if (re.test(code)) problems.push(`${file}: adds ${what}, which design changes can't include.`);
  }
  const imp = code.match(/^\s*import\b.*?from\s+['"]([^'"]+)['"]/) || code.match(/^\s*import\s+['"]([^'"]+)['"]/);
  if (imp) {
    const spec = imp[1];
    const ok = spec.startsWith('.') || ALLOWED_PACKAGES.some((p) => spec === p || spec.startsWith(`${p}/`));
    if (!ok) problems.push(`${file}: imports "${spec}", which isn't allowed (only react and lucide-react).`);
  }
}

// 3. Link safety must stay in place.
const count = (ref, path, needle) => {
  try { return (git('show', `${ref}:${path}`).match(new RegExp(needle, 'g')) || []).length; } catch { return 0; }
};
const sections = 'src/site/sections/Sections.jsx';
if (count(':0', sections, 'safeUrl\\(') < count(base, sections, 'safeUrl\\(')) {
  problems.push(`${sections}: removes safeUrl() link protection.`);
}

if (changed.length === 0) {
  console.log('No files changed.');
  process.exit(2);
}

const unique = [...new Set(problems)];
if (unique.length) {
  const msg = unique.slice(0, 8).join(' ');
  console.log(`::error title=Design change blocked::${msg.replace(/[\r\n]+/g, ' ')}`);
  console.error(unique.join('\n'));
  process.exit(1);
}
console.log(`Scope check passed (${changed.length} file${changed.length === 1 ? '' : 's'}).`);
