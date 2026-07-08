const fs = require('fs');

const html = fs.readFileSync('/Users/writingafterx/Documents/readernwriter/The Economist_bundled.html', 'utf8');

const matches = html.match(/.{0,20}\\n\\n.{0,20}/g);
if (matches) {
  console.log("Found literal \\n\\n:", matches);
} else {
  console.log("No literal \\n\\n found.");
}
