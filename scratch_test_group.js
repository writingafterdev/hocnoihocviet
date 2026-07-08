const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/Users/writingafterx/Documents/readernwriter/The Economist_bundled.html', 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;

const svgs = Array.from(doc.querySelectorAll('svg'));
const containers = new Set();

svgs.forEach(svg => {
  const container = svg.closest('.container[class*="svelte-"]') || svg.closest('figure') || svg.closest('[class*="svelte-"]');
  if (container) {
    containers.add(container);
  }
});

console.log(`Found ${containers.size} unique chart containers.`);
containers.forEach(c => {
  console.log(c.className, c.querySelectorAll('svg').length, 'SVGs inside');
});
