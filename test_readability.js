const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const { Readability } = require('@mozilla/readability');

const html = fs.readFileSync('The best places to be a working woman in 2025 (4_6_2026 15：37：37).html', 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;

const svgs = doc.querySelectorAll('svg');
let chartIndex = 0;
svgs.forEach(svg => {
  let container = svg.closest('figure') || svg.closest('[class*="svelte-"]');
  if (!container) container = svg;
  if (container.dataset.sandboxed === 'true') return;
  container.dataset.sandboxed = 'true';
  const p = doc.createElement('p');
  p.id = `CHART_SANDBOX_PLACEHOLDER_${chartIndex++}`;
  p.textContent = p.id;
  container.replaceWith(p);
});

const reader = new Readability(doc);
const article = reader.parse();
const matches = article.content.match(/CHART_SANDBOX_PLACEHOLDER/g);
console.log('Placeholders found in output:', matches ? matches.length : 0);
console.log('Original SVGs:', chartIndex);
