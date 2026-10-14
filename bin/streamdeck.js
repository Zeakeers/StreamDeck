#!/usr/bin/env node
const path = require('path');

// Pastikan working directory selalu di folder project streamdeck
const rootDir = path.resolve(__dirname, '..');
process.chdir(rootDir);

require('../server.js');
