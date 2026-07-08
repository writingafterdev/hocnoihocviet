const fs = require('fs');
const path = require('path');

const htmlPath = '/Users/writingafterx/Downloads/The Economist’s glass-ceiling index _ The Economist.html';
const filesDir = path.join(__dirname, 'The Economist’s glass-ceiling index _ The Economist_files');
const outputPath = path.join(__dirname, 'The Economist_bundled.html');

let html = fs.readFileSync(htmlPath, 'utf8');

// Find all link tags that point to the _files directory
const linkRegex = /<link[^>]*href=["']\.\/The Economist’s glass-ceiling index _ The Economist_files\/([^"']+)["'][^>]*>/g;

let match;
const styles = [];

while ((match = linkRegex.exec(html)) !== null) {
  const filename = match[1];
  if (filename.endsWith('.css')) {
    const cssPath = path.join(filesDir, filename);
    if (fs.existsSync(cssPath)) {
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      styles.push(`<style>${cssContent}</style>`);
      console.log(`Bundled: ${filename}`);
    }
  }
}

// Inject all styles into the head
html = html.replace('</head>', `${styles.join('\n')}\n</head>`);

fs.writeFileSync(outputPath, html, 'utf8');
console.log(`\nSuccess! Bundled HTML saved to: The Economist_bundled.html`);
