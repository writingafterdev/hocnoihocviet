const Matter = require('matter-js');
try {
  const w = Matter.Bodies.fromVertices(40, 45, [[ {x: 35, y: 15}, {x: 65, y: 75}, {x: 45, y: 75}, {x: 15, y: 15} ]]);
  console.log("Success! Vertices created:", w.vertices.length);
} catch (e) {
  console.log("Failed:", e.message);
}
