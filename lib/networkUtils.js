const os = require('os');
const qrcode = require('qrcode-terminal');

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
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

function getTailscaleIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const isTsInterface = name.toLowerCase().includes('tailscale') || name.startsWith('utun');
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        if (isTsInterface || net.address.startsWith('100.')) {
          return net.address;
        }
      }
    }
  }
  return null;
}

function getPrimaryIp() {
  const list = getLocalIpAddresses();
  return list.length > 0 ? list[0].ip : '127.0.0.1';
}

function printServerBanner(port) {
  const lanIp = getPrimaryIp();
  const tailscaleIp = getTailscaleIp();
  const localUrl = `http://localhost:${port}`;
  const networkUrl = `http://${lanIp}:${port}`;
  const tailscaleUrl = tailscaleIp ? `http://${tailscaleIp}:${port}` : null;

  console.log('\n' + '='.repeat(54));
  console.log('       STREAMDECK WEB - READY & RUNNING       ');
  console.log('='.repeat(54));
  console.log(` Local PC  : ${localUrl}`);
  if (lanIp && lanIp !== '127.0.0.1') {
    console.log(` Wi-Fi LAN : ${networkUrl}`);
  }
  if (tailscaleUrl) {
    console.log(` Tailscale : ${tailscaleUrl}`);
  }
  console.log('='.repeat(54));

  const targetQrUrl = tailscaleUrl || networkUrl;
  const label = tailscaleUrl ? 'Tailscale (Anywhere)' : 'Wi-Fi LAN';
  console.log(` Scan QR code for ${label}:`);
  console.log(` URL: ${targetQrUrl}\n`);

  qrcode.generate(targetQrUrl, { small: true }, (qr) => {
    console.log(qr);
  });
  console.log('='.repeat(54) + '\n');
}

module.exports = {
  getLocalIpAddresses,
  getTailscaleIp,
  getPrimaryIp,
  printServerBanner
};
