const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  
  // Handle specific selection styling first
  content = content.replace(/selection:bg-\[#(E3120B|E71319)\] selection:text-white/gi, 'selection:bg-neutral-200 selection:text-[#111]');
  content = content.replace(/selection:bg-\[#(E3120B|E71319)\]/gi, 'selection:bg-neutral-200 selection:text-[#111]');

  // Replace all remaining vibrant reds with pure black #111
  content = content.replace(/#E3120B/gi, '#111');
  content = content.replace(/#E71319/gi, '#111');

  if (original !== content) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
