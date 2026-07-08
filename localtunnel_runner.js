const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'public/pinggy_tunnel.txt');
fs.writeFileSync(logFile, 'Initializing Localtunnel...\n', 'utf8');

(async () => {
  try {
    const tunnel = await localtunnel({ port: 3000 });
    
    const url = tunnel.url;
    fs.writeFileSync(logFile, `Your public shareable URL: ${url}\n`, 'utf8');
    console.log(`Tunnel started at: ${url}`);
    
    tunnel.on('close', () => {
      fs.appendFileSync(logFile, 'Tunnel closed.\n', 'utf8');
    });
  } catch (err) {
    fs.writeFileSync(logFile, `Error starting tunnel: ${err.message}\n`, 'utf8');
    console.error(err);
  }
})();
