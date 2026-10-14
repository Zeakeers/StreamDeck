const os = require('os');
const qrcode = require('qrcode-terminal');

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // IPv4 and not internal/loopback
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({
          interface: name,
          ip: net.address
        });
      }
    }
  }

  // Prioritize common local subnet patterns: 192.168.*, 10.*, 172.16-31.*
  addresses.sort((a, b) => {
    const isPreferredA = a.ip.startsWith('192.168.') || a.ip.startsWith('10.');
    const isPreferredB = b.ip.startsWith('192.168.') || b.ip.startsWith('10.');
    if (isPreferredA && !isPreferredB) return -1;
    if (!isPreferredA && isPreferredB) return 1;
    return 0;
  });

  return addresses;
}

function getPrimaryIp() {
  const list = getLocalIpAddresses();
  return list.length > 0 ? list[0].ip : '127.0.0.1';
}

function printServerBanner(port) {
  const ip = getPrimaryIp();
  const localUrl = `http://localhost:${port}`;
  const networkUrl = `http://${ip}:${port}`;

  console.log('\n' + '='.repeat(54));
  console.log('       STREAMDECK WEB - READY & RUNNING       ');
  console.log('='.repeat(54));
  console.log(` PC Browser : ${localUrl}`);
  console.log(` HP Browser : ${networkUrl}`);
  console.log('='.repeat(54));
  console.log(' Scan QR code di bawah menggunakan kamera HP kamu:');
  console.log(' (Pastikan HP & PC terhubung ke Wi-Fi yang sama)\n');

  qrcode.generate(networkUrl, { small: true }, (qr) => {
    console.log(qr);
  });
  console.log('='.repeat(54) + '\n');
}

module.exports = {
  getLocalIpAddresses,
  getPrimaryIp,
  printServerBanner
};
