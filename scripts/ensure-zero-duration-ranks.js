/**
 * Insert `0h0m0s` on ranks.txt leaves that have no time standard.
 * Usage: node scripts/ensure-zero-duration-ranks.js [file...]
 * With no args, updates defaults + data/ranks.txt + all localization ranks.
 */

const fs = require('fs');
const path = require('path');

function leafHasDurationToken(main) {
  return /\b\d+h(?:\d+m)?(?:\d+(?:\.\d+)?s)?\b|\b\d+m\d+(?:\.\d+)?s\b|\b\d+m\b|\b\d+(?:\.\d+)?s\b|\b\d+\s*steps\b/i.test(
    main
  );
}

function ensureZeroDurationLine(line) {
  const m = line.match(/^(\t*- )(.*)$/);
  if (!m) return { line, changed: false };
  const prefix = m[1];
  const rest = m[2];
  const noteIdx = rest.indexOf('{');
  const main = noteIdx >= 0 ? rest.slice(0, noteIdx) : rest;
  const notes = noteIdx >= 0 ? rest.slice(noteIdx) : '';
  if (leafHasDurationToken(main)) return { line, changed: false };
  if (!/\bx\d+\b/i.test(main)) return { line, changed: false };
  const nextMain = main.replace(/(\bx\d+\b)/i, '0h0m0s $1');
  return { line: prefix + nextMain + notes, changed: true };
}

function patchFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  let changed = 0;
  const out = lines.map((line) => {
    const result = ensureZeroDurationLine(line);
    if (result.changed) changed += 1;
    return result.line;
  });
  if (changed > 0) {
    fs.writeFileSync(filePath, out.join(nl), 'utf8');
  }
  return changed;
}

function defaultTargets() {
  const root = path.join(__dirname, '..');
  const files = [
    path.join(root, 'data', 'defaults', 'ranks.txt'),
    path.join(root, 'data', 'ranks.txt'),
  ];
  const locRoot = path.join(root, 'data', 'localization');
  for (const dir of fs.readdirSync(locRoot)) {
    const base = path.join(locRoot, dir);
    for (const name of ['ranks.txt', 'ranks.default']) {
      const p = path.join(base, name);
      if (fs.existsSync(p)) files.push(p);
    }
  }
  return files;
}

const args = process.argv.slice(2);
const targets = args.length ? args.map((p) => path.resolve(p)) : defaultTargets();
let total = 0;
for (const file of targets) {
  if (!fs.existsSync(file)) {
    console.warn('skip missing', file);
    continue;
  }
  const n = patchFile(file);
  total += n;
  console.log(`${n}\t${path.relative(process.cwd(), file)}`);
}
console.log(`done: ${total} leaves updated across ${targets.length} files`);
