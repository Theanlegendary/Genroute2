const fs = require('fs');

const routes = JSON.parse(fs.readFileSync('data/routes.json', 'utf-8'));
const pickup = JSON.parse(fs.readFileSync('data/pickup_branches.json', 'utf-8'));

console.log('--- Search in routes.json ---');
routes.forEach(r => {
  const str = JSON.stringify(r);
  if (str.toLowerCase().includes('stua007') || str.toLowerCase().includes('sesan') || str.toLowerCase().includes('kampong cham market')) {
    console.log(JSON.stringify(r, null, 2));
  }
});

console.log('--- Search in pickup_branches.json ---');
pickup.forEach(b => {
  const str = JSON.stringify(b);
  if (str.toLowerCase().includes('stua007') || str.toLowerCase().includes('sesan') || str.toLowerCase().includes('kampong cham market')) {
    console.log(JSON.stringify(b, null, 2));
  }
});
