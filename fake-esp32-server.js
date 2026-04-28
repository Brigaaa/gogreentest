// fake-esp32-server.js
const http = require('http');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.url === '/data') {
    const fakeData = {
      temperature: parseFloat((23.5 + Math.random() * 4).toFixed(2)),
      humidity: parseFloat((42 + Math.random() * 15).toFixed(2)),
      pressure: parseFloat((1005 + Math.random() * 12).toFixed(2)),
      air_raw: Math.floor(1450 + Math.random() * 650)
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(fakeData));
    console.log('✅ Vraćeni podaci:', fakeData);
  } else {
    res.writeHead(404);
    res.end('Not found - koristi /data');
  }
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Fake ESP32 server pokrenut!`);
  console.log(`   → http://localhost:${PORT}/data`);
  console.log(`   → Na telefonu koristi IP računara:3000`);
});