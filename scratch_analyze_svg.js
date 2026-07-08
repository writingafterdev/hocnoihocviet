const fs = require('fs');

function parsePath(d) {
    const coords = d.match(/-?\d+(\.\d+)?/g);
    if (!coords) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let currX = 0, currY = 0;
    
    // Simplistic bounding box (just using the raw control points/endpoints)
    // Good enough to locate the general area of the path
    let isRelative = false;
    let i = 0;
    
    // Just grab all pairs of numbers and treat them as x,y
    // Since some commands have 1 number (v, h), this is a rough approximation,
    // but we can just accumulate absolute values roughly.
    // Actually, let's just use a proper SVG path parser or simple regex
    let parts = d.match(/[a-zA-Z]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
    let cmd = 'M';
    for (let j=0; j<parts.length; j++) {
        let p = parts[j];
        if (/[a-zA-Z]/.test(p)) {
            cmd = p;
            isRelative = (cmd === cmd.toLowerCase());
        } else {
            // Very rough, but if we just take all numbers, let's see min/max 
        }
    }
}

// Let's just use an easier approach: regex for all numbers, but since it's relative, we need to track.
// Better: let's just log the paths and see if we can identify them by their start points.

const svg = fs.readFileSync('/Users/writingafterx/Documents/readernwriter/svgs/vectorized_019eb1d9-db0e-7a6b-9b60-86b81ee695cc.svg', 'utf8');

const paths = [...svg.matchAll(/<path[^>]*d="([^"]+)"/g)];

paths.forEach((match, index) => {
    let d = match[1];
    let classMatch = match[0].match(/class="([^"]+)"/);
    let fillMatch = match[0].match(/fill="([^"]+)"/);
    console.log(`Path ${index}: start=${d.substring(0, 30)}... class=${classMatch ? classMatch[1] : 'none'} fill=${fillMatch ? fillMatch[1] : 'none'} length=${d.length}`);
});
