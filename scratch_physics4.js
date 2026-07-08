const Matter = require('matter-js');

const w0 = Matter.Bodies.fromVertices(0, 0, [[
  {x: 35, y: 15}, {x: 65, y: 75}, {x: 45, y: 75}, {x: 15, y: 15}
]], { isStatic: true });

const w1 = Matter.Bodies.fromVertices(0, 0, [[
  {x: 115, y: 15}, {x: 135, y: 15}, {x: 105, y: 75}, {x: 85, y: 75}
]], { isStatic: true });

const w2 = Matter.Bodies.fromVertices(0, 0, [[
  {x: 65, y: 75}, {x: 35, y: 135}, {x: 15, y: 135}, {x: 45, y: 75}
]], { isStatic: true });

const w3 = Matter.Bodies.fromVertices(0, 0, [[
  {x: 85, y: 75}, {x: 105, y: 75}, {x: 135, y: 135}, {x: 115, y: 135}
]], { isStatic: true });

const walls = [w0, w1, w2, w3];

walls.forEach((w, i) => {
  console.log(`Wall ${i} center: (${w.position.x.toFixed(1)}, ${w.position.y.toFixed(1)})`);
  console.log(`Wall ${i} vertices:`);
  w.vertices.forEach(v => console.log(`  (${v.x.toFixed(1)}, ${v.y.toFixed(1)})`));
});
