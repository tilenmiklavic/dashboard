// Generates public/ds/tokens.css from the design system's tokens.json (the page that normally generates it isn't part of the export).
import fs from 'node:fs';

const t = JSON.parse(fs.readFileSync('public/ds/tokens.json', 'utf8'));
const [light, dark] = t.color.themes.map((x) => x.id);
const val = (v) => (typeof v === 'string' && v.startsWith('{') ? `var(--${v.slice(1, -1)})` : v);
const pick = (v, theme) => val(typeof v === 'object' ? (v[theme] ?? v[light]) : v);
const vars = (theme) => [...t.color.tokens, ...t.shadow.tokens].map((x) => `  --${x.name}: ${pick(x.value, theme)};`).join('\n');
const fixed = [
  ...t.spacing.tokens, ...t.radius.tokens,
].map((x) => `  --${x.name}: ${x.value};`).join('\n');
const fam = Object.entries(t.type.families).map(([k, v]) => `  --font-${k}: ${v};`).join('\n');
const classes = t.type.groups.flatMap((g) => g.styles.map((s) =>
  `.${s.name} { font-family: var(--font-${g.family}); font-size: ${s.fontSize}; line-height: ${s.lineHeight}; font-weight: ${s.fontWeight};${s.letterSpacing ? ` letter-spacing: ${s.letterSpacing};` : ''} }`)).join('\n');

const css = `/* ${t.name} — generated from tokens.json by scripts/build-tokens.mjs. Do not edit. */
:root {
  color-scheme: light dark;
${vars(light)}
${fixed}
${fam}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${vars(dark).replace(/^/gm, '  ')}
  }
}
:root[data-theme="dark"] {
${vars(dark)}
}
${classes}
`;
fs.writeFileSync('public/ds/tokens.css', css);
console.log('wrote public/ds/tokens.css');
