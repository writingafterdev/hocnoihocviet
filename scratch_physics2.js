const Matter = require('matter-js');

const walls = [
  Matter.Bodies.rectangle(36.3, 45, 20, 80, { angle: -Math.PI / 6 }), // top left
  Matter.Bodies.rectangle(113.7, 45, 20, 80, { angle: Math.PI / 6 }), // top right
  Matter.Bodies.rectangle(36.3, 105, 20, 80, { angle: Math.PI / 6 }), // bottom left
  Matter.Bodies.rectangle(113.7, 105, 20, 80, { angle: -Math.PI / 6 }), // bottom right
];

walls.forEach((w, i) => {
  const closest = w.vertices.reduce((prev, curr) => Math.abs(curr.x - 75) < Math.abs(prev.x - 75) ? curr : prev);
  console.log(`Wall ${i} neck inner edge: (${closest.x.toFixed(1)}, ${closest.y.toFixed(1)})`);
});
