const assert = require('assert');
const os = require('os');
const {
  getLocalIpAddresses,
  getTailscaleIp,
  getPrimaryIp,
  printServerBanner
} = require('../src/services/networkUtils');

// 1. getLocalIpAddresses
const addresses = getLocalIpAddresses();
assert.ok(Array.isArray(addresses), 'getLocalIpAddresses must return array');
addresses.forEach((entry) => {
  assert.ok(typeof entry.interface === 'string', 'interface must be string');
  assert.ok(typeof entry.ip === 'string', 'ip must be string');
  assert.ok(!entry.ip.startsWith('127.'), 'must not contain loopback');
});

// 2. getPrimaryIp
const primary = getPrimaryIp();
assert.ok(typeof primary === 'string', 'primary IP must be string');
if (addresses.length > 0) {
  assert.strictEqual(primary, addresses[0].ip, 'primary IP must match first sorted address');
} else {
  assert.strictEqual(primary, '127.0.0.1', 'fallback must be localhost');
}

// 3. getTailscaleIp
const tsIp = getTailscaleIp();
assert.ok(tsIp === null || typeof tsIp === 'string', 'tailscale IP must be string or null');

// 4. Mock os.networkInterfaces to verify sorting and tailscale detection
const originalInterfaces = os.networkInterfaces;
try {
  os.networkInterfaces = () => ({
    eth0: [
      { family: 'IPv6', internal: false, address: 'fe80::1' },
      { family: 'IPv4', internal: true, address: '127.0.0.1' },
      { family: 'IPv4', internal: false, address: '172.20.10.2' }
    ],
    wlan0: [
      { family: 'IPv4', internal: false, address: '192.168.1.50' }
    ],
    tailscale0: [
      { family: 'IPv4', internal: false, address: '100.80.90.100' }
    ]
  });

  const mockedList = getLocalIpAddresses();
  assert.strictEqual(mockedList.length, 3);
  assert.strictEqual(mockedList[0].ip, '192.168.1.50', '192.168.* must be prioritized');

  const mockedTs = getTailscaleIp();
  assert.strictEqual(mockedTs, '100.80.90.100', 'must detect tailscale IP');

  const mockedPrimary = getPrimaryIp();
  assert.strictEqual(mockedPrimary, '192.168.1.50', 'primary IP must use top preferred IP');
} finally {
  os.networkInterfaces = originalInterfaces;
}

// 5. printServerBanner executes without throw
let bannerOutput = '';
const originalLog = console.log;
console.log = (...args) => {
  bannerOutput += args.join(' ') + '\n';
};
try {
  printServerBanner(3000);
  assert.ok(bannerOutput.includes('STREAMDECK WEB - READY & RUNNING'), 'banner title must be printed');
  assert.ok(bannerOutput.includes('3000'), 'port must be in banner');
} finally {
  console.log = originalLog;
}

console.log('networkUtils tests passed.');
