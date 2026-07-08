const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/Users/writingafterx/Documents/readernwriter/The Economist_bundled.html', 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;

const svgs = doc.querySelectorAll('svg.svelte-nb4xh7, svg.svelte-1srghcq, div[class*="svelte-"] svg');
if (svgs.length > 0) {
  let el = svgs[svgs.length - 1]; // get a deep one
  for (let i = 0; i < 15; i++) {
    console.log(el.tagName, el.className);
    if (!el.parentElement) break;
    el = el.parentElement;
  }
} else {
  console.log('no svgs found with svelte class');
}
