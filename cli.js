#!/usr/bin/env node

const Node = {
  child: require('child_process'),
  fs: require('fs'),
  path: require('path'),
  process: process
};

const Waterfall = require('./index.js');

var source = undefined;
var target = undefined;
const args = Node.process.argv.slice(2);
const options = { barcolor: [], exclude: [], unit: 'ms' };
var valid = true;
for (var index = 0; index < args.length; index++) {
  var arg = args[index];
  if (/^--/.test(arg)) {
    var parts = arg.split('=');
    if (parts.length != 2) {
      valid = false;
      break;
    }
    var key = parts[0].toLowerCase().replace(/[_-]+/g, '');
    var value = parts[1];
    if (key === 'barcolor') {
      options.barcolor.push(value);
    } else if (key === 'exclude') {
      options.exclude.push(value);
    } else {
      valid = false;
      break;
    }
  } else if (source === undefined) {
    source = arg;
  } else if (target === undefined) {
    target = arg;
  } else {
    valid = false;
    break;
  }
}
if (!source || !valid) {
  return console.error(
    'usage: waterfall [--BAR-COLOR=hex] [--BAR-COLOR=label prefix:hex]\n' +
    '                 [--EXCLUDE=label prefix] ' + 
    ' <data-file> [png-file]'
  );
}
if (!target) {
  target = source;
  let parts = target.split('.');
  let extension = parts.pop();
  if (parts.length > 0 && parts[0].length > 0) {
    target = target.split('.').slice(0, -1).join('.');
  }
  target += '.png';
}
if (!/\.png$/.test(target)) {
  return console.error(
    '<png-file> does not have a ".png" extension: ' + target
  );
}

if (!Node.fs.existsSync(source)) {
  return console.error('<data-file> does not exist: ' + source);
}

const buffer = Node.fs.readFileSync(source);
const png = Waterfall.chart(buffer, options);

Node.fs.writeFileSync(target, png);

// Perform platform and path safety checks, and degrade gracefully.
if (
  Node.process.platform === 'darwin' &&
  !/"/.test(target) &&
  !/^-/.test(target)
) {
  Node.child.execSync('open "' + target + '"');
}
