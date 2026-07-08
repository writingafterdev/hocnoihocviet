const Matter = require('matter-js');

const walls = [
  Matter.Bodies.rectangle(25, 45, 20, 80, { angle: -Math.PI / 6 }), // top left
  Matter.Bodies.rectangle(125, 45, 20, 80, { angle: Math.PI / 6 }), // top right
  Matter.Bodies.rectangle(25, 105, 20, 80, { angle: Math.PI / 6 }), // bottom left
  Matter.Bodies.rectangle(125, 105, 20, 80, { angle: -Math.PI / 6 }), // bottom right
];

walls.forEach((w, i) => {
  // Find the rightmost point for left walls, leftmost for right walls
  const xs = w.vertices.map(v => v.x);
  const ys = w.vertices.map(v => v.y);
  console.log(`Wall ${i}: x:[${Math.min(...xs).toFixed(1)}, ${Math.max(...xs).toFixed(1)}], y:[${Math.min(...ys).toFixed(1)}, ${Math.max(...ys).toFixed(1)}]`);
  
  // print the vertex closest to center x=75
  const closest = w.vertices.reduce((prev, curr) => Math.abs(curr.x - 75) < Math.abs(prev.x - 75) ? curr : prev);
  console.log(`Closest to center: (${closest.x.toFixed(1)}, ${closest.y.toFixed(1)})`);
});
