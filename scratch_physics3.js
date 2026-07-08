const Matter = require('matter-js');

// Top Left: inner edge from (35,20) to (65,75)
// cx = 41.3, cy = 52.3, length = 62.6, thickness = 20, angle = 61.4 deg
const w0 = Matter.Bodies.rectangle(41.3, 52.3, 62.6, 20, { angle: 61.4 * (Math.PI / 180) });

// Top Right: mirrored
const w1 = Matter.Bodies.rectangle(150 - 41.3, 52.3, 62.6, 20, { angle: -61.4 * (Math.PI / 180) });

// Bottom Left: inner edge from (65,75) to (35,130)
// dx = -30, dy = 55. length = 62.6.
// angle = atan2(55, -30) = 118.6 deg = -61.4 deg
// nx = -55 / 62.6 = -0.87. ny = -30 / 62.6 = -0.48.
// shiftX = -8.7. shiftY = -4.8.
// inner cx = 50, cy = 102.5.
// cx = 50 - 8.7 = 41.3. cy = 102.5 - 4.8 = 97.7.
const w2 = Matter.Bodies.rectangle(41.3, 97.7, 62.6, 20, { angle: -61.4 * (Math.PI / 180) });

// Bottom Right: mirrored
const w3 = Matter.Bodies.rectangle(150 - 41.3, 97.7, 62.6, 20, { angle: 61.4 * (Math.PI / 180) });

const walls = [w0, w1, w2, w3];

walls.forEach((w, i) => {
  // Print all 4 vertices
  console.log(`Wall ${i}:`);
  w.vertices.forEach(v => console.log(`  (${v.x.toFixed(1)}, ${v.y.toFixed(1)})`));
});
