const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'public/pinggy_tunnel.txt');
fs.writeFileSync(logFile, 'Initializing SSH Tunnel (localhost.run)...\n', 'utf8');

// Spawn SSH with localhost.run
const ssh = spawn('ssh', [
  '-o', 'StrictHostKeyChecking=no',
  '-R', '80:localhost:3000',
  'nokey@localhost.run'
]);

ssh.stdout.on('data', (data) => {
  const text = data.toString('utf8');
  fs.appendFileSync(logFile, text, 'utf8');
  console.log(text);
});

ssh.stderr.on('data', (data) => {
  const text = data.toString('utf8');
  fs.appendFileSync(logFile, '[stderr] ' + text, 'utf8');
  console.error(text);
});

ssh.on('close', (code) => {
  fs.appendFileSync(logFile, `\nTunnel exited with code ${code}\n`, 'utf8');
});
