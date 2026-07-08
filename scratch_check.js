const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('/Users/writingafterx/Downloads/The Economist’s glass-ceiling index _ The Economist.html', 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;

const svgs = doc.querySelectorAll('svg');
console.log('Number of SVGs:', svgs.length);

const figures = doc.querySelectorAll('figure');
console.log('Number of figures:', figures.length);
figures.forEach((f, i) => {
  console.log(`Figure ${i}: contains img? ${!!f.querySelector('img')} contains svg? ${!!f.querySelector('svg')}`);
});
