const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('/Users/writingafterx/Downloads/The Economist’s glass-ceiling index _ The Economist.html', 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;

const svg = doc.querySelector('svg');
if (svg) {
  console.log(svg.outerHTML.substring(0, 1000));
} else {
  console.log('No SVG found.');
}
