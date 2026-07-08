const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('/Users/writingafterx/Documents/readernwriter/The Economist_bundled.html', 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;

const svgs = doc.querySelectorAll('svg');
let container = svgs[3].closest('figure') || svgs[3].closest('[class*="svelte-"]');
if (!container) container = svgs[3];

fs.writeFileSync('/Users/writingafterx/Documents/readernwriter/scratch_chart.html', container.outerHTML, 'utf8');
