require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],2:[function(require,module,exports){
/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],3:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],4:[function(require,module,exports){
// Use explicit path to force usage of installed package over browserify shim
const BufferPkg = require('./node_modules/buffer/index.js');
const misbLib = require('@vidterra/misb.js');

console.log("misb-entry: Loading...");
console.log("misb-entry: misbLib keys:", Object.keys(misbLib));

// Expose Buffer globally for app.js usage
if (typeof window !== 'undefined') {
    window.Buffer = BufferPkg.Buffer;
}

// Create a clean export object
const finalExport = Object.assign({}, misbLib);
finalExport.Buffer = BufferPkg.Buffer;

console.log("misb-entry: Final export keys:", Object.keys(finalExport));

// Explicitly assign to window to avoid browserify -s issues
if (typeof window !== 'undefined') {
    window.MisbLibrary = finalExport;
    console.log("misb-entry: Assigned window.MisbLibrary");
}

module.exports = finalExport;

},{"./node_modules/buffer/index.js":25,"@vidterra/misb.js":5}],5:[function(require,module,exports){
const st0601 = require('./src/st0601')
const st0102 = require('./src/st0102')
const st0104 = require('./src/st0104')
const st0806 = require('./src/st0806')
const st0903 = require('./src/st0903')
const klv = require('./src/klv')

module.exports = {
	st0601,
	st0102,
	st0104,
	st0806,
	st0903,
	klv
}

},{"./src/klv":13,"./src/st0102":14,"./src/st0104":15,"./src/st0601":16,"./src/st0806":17,"./src/st0903":18}],6:[function(require,module,exports){
(function (process,Buffer){(function (){
const klv = require('./klv')

module.exports.parse = function (buffer, options = {}) {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer

	options.debug === true && console.debug('-------Start Parse Algorithm series-------')
	options.debug === true && process.stdout.write(`Buffer ${buffer.toString('hex')} ${buffer.length}\n`)

	let i = 0
	let length = 0
	let read
	do {
		read = packet[i]
		length += read & 0x7F
		i++
	} while (read >>> 7 === 1)

	if (packet.length - 1 < length) {
		throw new Error('Invalid Algorithm Series buffer, not enough content')
	}

	let algorithms = []
	let algorithm = null
	while (i < packet.length) {
		const key = packet[i]
		const length = packet[i + 1]

		if (packet.length < i + 2 + length) {
			throw new Error('Invalid Algorithm Series buffer, not enough content')
		}

		if (key === 1) {
			if (algorithm !== null) {
				algorithms.push(algorithm) // push the completed algorithm
			}
			algorithm = [] // reset for a new algorithm
		}

		const valueBuffer = packet.subarray(i + 2, i + 2 + length)
		const parsed = convert(key, valueBuffer, options)

		if (typeof parsed.value === 'string') parsed.value = parsed.value.replace(/[^\x20-\x7E]+/g, '')

		if (options.debug === true) {
			console.debug(key, length, parsed.name, `${parsed.value}${parsed.unit || ''}`, valueBuffer)
			parsed.packet = valueBuffer
		}

		algorithm.push(parsed)

		i += 1 + 1 + length // advance past key, length and value bytes
	}
	algorithms.push(algorithm)
	options.debug === true && console.debug('-------End Parse Algorithm Series---------')
	return algorithms
}

function convert(key, buffer, options) {
	try {
		switch (key) {
			case 1:
				klv.checkMaxSize(key, buffer, 3)
				return {
					key,
					name: 'ID',
					value: klv.readVariableUInt(buffer)
				}
			case 2:
				return {
					key,
					name: 'Name',
					value: buffer.toString()
				}
			case 3:
				return {
					key,
					name: 'Version',
					value: buffer.toString()
				}
			case 4:
				return {
					key,
					name: 'Class',
					value: buffer.toString()
				}
			case 5:
				return {
					key,
					name: 'nFrames',
					value: klv.readVariableUInt(buffer)
				}
			default:
				if (options.strict === true) {
					throw Error(`Algorithm Series key ${key} not found`)
				}
				return {
					key,
					name: 'Unknown',
					value: buffer.toString()
				}
		}
	} catch (e) {
		throw e
	}
}

}).call(this)}).call(this,require('_process'),require("buffer").Buffer)
},{"./klv":13,"_process":3,"buffer":"buffer"}],7:[function(require,module,exports){
module.exports = require('./GenericLocalSet');

},{"./GenericLocalSet":8}],8:[function(require,module,exports){
const klv = require('./klv')

module.exports.getKeyName = function (key) {
	switch (key) {
		default:
			return 'User Defined LS'
	}
}

module.exports.decodeValue = function (key, type, buffer) {
	switch (type) {
		case 0:
			return buffer.toString()
		case 64:
			return klv.readVariableUInt(buffer)
		case 128:
			return klv.readVariableInt(buffer)
		case 192:
			return buffer.toString('hex')
		default:
			return buffer.toString('hex')
	}
}

},{"./klv":13}],9:[function(require,module,exports){
(function (process,Buffer){(function (){
const klv = require('./klv')

module.exports.parse = function (buffer, options = {}) {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer
	const values = {}

	options.debug === true && console.debug('-------Start Parse Location-------')
	options.debug === true && process.stdout.write(`Buffer ${buffer.toString('hex')} ${buffer.length}\n`)
	values.lat = klv.scale(packet.readUInt32BE(0), [0, 2 ** 32 - 1], [-90, 90])  // todo fix this
	values.lon = klv.scale(packet.readUInt32BE(4), [0, 2 ** 32 - 1], [-180, 180])
	values.hae = klv.scale(packet.readUInt16BE(8), [0, 2 ** 16 - 1], [-900, 19000])

	options.debug === true && console.debug('Lat', values.lat, packet.slice(0, 4))
	options.debug === true && console.debug('Lon', values.lon, packet.slice(4, 8))
	options.debug === true && console.debug('HAE', values.hae, packet.slice(8, 10))

	// todo add Standard Deviations and Correlation Coefficients pg 51 0903.5

	options.debug === true && console.debug('-------End Parse Location---------')
	return values
}

}).call(this)}).call(this,require('_process'),require("buffer").Buffer)
},{"./klv":13,"_process":3,"buffer":"buffer"}],10:[function(require,module,exports){
(function (process,Buffer){(function (){
const klv = require('./klv')

module.exports.parse = function (buffer, options = {}) {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer

	options.debug === true && console.debug('-------Start Parse Ontology-------')
	options.debug === true && process.stdout.write(`Buffer ${buffer.toString('hex')} ${buffer.length}\n`)

	if (buffer.length === 0) { // 0x67 0x00 is an empty Ontology
		return
	}

	let ontologies = []

	let i = 0
	while (i < packet.length) {
		let length = 0
		let read
		do {
			read = packet[i]
			length += read & 0x7F
			i++
		} while (read >>> 7 === 1)

		if (packet.length - 1 < length) {
			throw new Error(`Invalid Ontology buffer, not enough content ${packet.length} < ${length}`)
		}

		let j = i
		let ontology = []
		while (j < i + length) {
			const key = packet[j]
			const contentLength = packet[j + 1]
			const berHeader = 1
			const berLength = 1

			const valueBuffer = packet.subarray(j + berHeader + berLength, j + berHeader + berLength + contentLength)
			const parsed = convert(key, valueBuffer, options)

			if (typeof parsed.value === 'string') parsed.value = parsed.value.replace(/[^\x20-\x7E]+/g, '')

			if (options.debug === true) {
				console.debug(key, contentLength, parsed.name, `${parsed.value}${parsed.unit || ''}`, valueBuffer)
				parsed.packet = valueBuffer
			}

			ontology.push(parsed)

			j += berHeader + berLength + contentLength // advance past key, length and value bytes
		}
		ontologies.push(ontology)
		i += length
	}
	options.debug === true && console.debug('-------End Parse Ontology---------')
	return ontologies
}

function convert(key, buffer, options) {
	try {
		switch (key) {
			case 1:
				klv.checkMaxSize(key, buffer, 3)
				return {
					key,
					name: 'ID',
					value: klv.readVariableUInt(buffer)
				}
			case 2:
				klv.checkMaxSize(key, buffer, 3)
				return {
					key,
					name: 'Parent ID',
					value: klv.readVariableUInt(buffer)
				}
			case 3:
				return {
					key,
					name: 'Ontology',
					value: buffer.toString()
				}
			case 4:
				return {
					key,
					name: 'Ontology Class',
					value: buffer.toString()
				}
			default:
				if (options.strict === true) {
					throw Error(`Ontology key ${key} not found`)
				}
				return {
					key,
					name: 'Unknown',
					value: buffer.toString()
				}
		}
	} catch (e) {
		throw e
	}
}

}).call(this)}).call(this,require('_process'),require("buffer").Buffer)
},{"./klv":13,"_process":3,"buffer":"buffer"}],11:[function(require,module,exports){
(function (process,Buffer){(function (){
const klv = require('./klv')
module.exports.parse = function (buffer, options = {}) {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer

	options.debug === true && console.debug('-------Start Parse Point Local Set-------')
	options.debug === true && process.stdout.write(`Buffer ${buffer.toString('hex')} ${buffer.length}\n`)

	const values = []

	const keyPlusLength = 2
	let i = 0
	while (i < packet.length) {
		const key = packet[i]
		const valueLength = packet[i + 1]

		if (packet.length < i + keyPlusLength + valueLength) {
			throw new Error('Invalid POI Local Set buffer, not enough content')
		}

		const valueBuffer = packet.subarray(i + keyPlusLength, i + keyPlusLength + valueLength)
		const parsed = convert(key, valueBuffer, options)

		if(typeof parsed.value === 'string') {
			parsed.value = parsed.value.replace(/[^\x20-\x7E]+/g, '')
		}

		if (options.debug === true) {
			console.debug(key, valueLength, parsed.name, `${parsed.value}${parsed.unit || ''}`, valueBuffer)
			parsed.packet = valueBuffer
		}

		values.push(parsed)

		i += keyPlusLength + valueLength // advance past key, length and value bytes
	}
	options.debug === true && console.debug('-------End Parse User Defined Local Set---------')

	return values
}

function convert(key, buffer, options) {
	try {
		switch (key) {
			case 1:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: 'POI Number',
					value: buffer.readUInt16BE(0)
				}
			case 2:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: 'POI Latitude',
					value: klv.scale(buffer.readInt16BE(0), [-1 * (2 ** 15 - 1), 2 ** 15 - 1], [-90, 90]),
					unit: '°'
				}
			case 3:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: 'POI Longitude',
					value: klv.scale(buffer.readInt16BE(0), [-1 * (2 ** 15 - 1), 2 ** 15 - 1], [-180, 180]),
					unit: '°'
				}
			case 4:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: 'POI Altitude',
					value: klv.scale(buffer.readUInt16BE(0), [0, 2 ** 16 - 1], [-900, 19000]),
					unit: 'm'
				}
			case 5:
				klv.checkRequiredSize(key, buffer, 1)
				const type = buffer[0]
				let value = 'Unknown'
				if (type === 1) value = 'Friendly'
				else if (type === 2) value = 'Hostile'
				else if (type === 3) value = 'Target'
				return {
					key,
					name: 'POI Type',
					value
				}
			case 6:
				return {
					key,
					name: 'POI Text',
					value: buffer.toString()
				}
			case 7:
				return {
					key,
					name: 'POI Source Icon',
					value: buffer.toString()
				}
			case 8:
				return {
					key,
					name: 'POI Source ID',
					value: buffer.toString()
				}
			case 9:
				return {
					key,
					name: 'POI Label',
					value: buffer.toString()
				}
			case 10:
				return {
					key,
					name: 'Operation ID',
					value: buffer.toString()
				}
			default:
				if (options.strict === true) {
					throw Error(`Key ${key} not found`)
				}
				return {
					key,
					name: 'Unknown',
					value: buffer.toString()
				}
		}
	} catch (e) {
		throw e
	}
}

}).call(this)}).call(this,require('_process'),require("buffer").Buffer)
},{"./klv":13,"_process":3,"buffer":"buffer"}],12:[function(require,module,exports){
(function (Buffer){(function (){
let LocalSet
try {
	LocalSet = require('./CustomLocalSet')
} catch (e) {
	LocalSet = require('./GenericLocalSet')
}

let id = null
let type = null

module.exports.parse = function (buffer, options = {}) {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer

	//options.debug === true && console.debug('-------Start Parse User Defined Local Set-------')
	//options.debug === true && process.stdout.write(`Buffer ${buffer.toString('hex')} ${buffer.length}\n`)

	const values = []

	const keyPlusLength = 2
	let i = 0
	while (i < packet.length) {
		const key = packet[i]
		const valueLength = packet[i + 1]

		if (packet.length < i + keyPlusLength + valueLength) {
			throw new Error('Invalid User Defined Local Set buffer, not enough content')
		}

		const valueBuffer = packet.subarray(i + keyPlusLength, i + keyPlusLength + valueLength)
		const parsed = convert(key, valueBuffer, options)

		if (parsed !== null) {
			if (typeof parsed.value === 'string') parsed.value = parsed.value.replace(/[^\x20-\x7E]+/g, '')

			if (options.debug === true) {
				console.debug(key, valueLength, parsed.name, `${parsed.value}${parsed.unit || ''}`, valueBuffer)
				parsed.packet = valueBuffer
			}
		} else {
			options.debug === true && console.debug(key, contentLength, 'NULL')
		}
		values.push(parsed)

		i += keyPlusLength + valueLength // advance past key, length and value bytes
	}
	//options.debug === true && console.debug('-------End Parse User Defined Local Set---------')

	return values
}

function convert(key, buffer, options) {
	try {
		switch (key) {
			case 1:
				const value = buffer.readUInt8(0)
				id = value & 0b00111111 // this must be set before key 2 is read
				type = value & 0b11000000 // this must be set before key 2 is read
				return {
					key,
					name: 'ID',
					value: id
				}
			case 2:
				return {
					key,
					type: getTypeName(type),
					name: LocalSet.getKeyName(id),
					value: LocalSet.decodeValue(id, type, buffer)
				}
			default:
				if (options.debug === true) {
					//throw Error(`Key ${key} not found`)
				}
				return {
					key,
					name: 'Unknown',
					value: buffer.toString()
				}
		}
	} catch (e) {
		throw e
	}
}

const getTypeName = (type) => {
	switch (type) {
		case 0: // 00
			return 'string'
		case 64: // 01
			return 'int'
		case 128: // 10
			return 'uint'
		case 192: // 11
			return 'experimental'
		default:
			case 0: // unknown
	}
}
}).call(this)}).call(this,require("buffer").Buffer)
},{"./CustomLocalSet":7,"./GenericLocalSet":8,"buffer":"buffer"}],13:[function(require,module,exports){
(function (Buffer){(function (){
module.exports.scale = (input, fromRange, toRange) => {
	const [toMin, toMax] = toRange
	const [fromMin, fromMax] = fromRange

	const percent = (input - fromMin) / (fromMax - fromMin)
	return percent * (toMax - toMin) + toMin
}

module.exports.checkRequiredSize = (key, buffer, required) => {
	// todo add option for strict mode versus not-strict
	if (false && buffer.length !== required) {
		throw new Error(`Key ${key} buffer ${buffer.toString('hex')} is not required size ${required}`)
		//return false
	}
	return true
}

module.exports.checkMaxSize = (key, buffer, max) => {
	if (buffer.length > max) {
		throw new Error(`Key ${key} buffer ${buffer.toString()} is larger than max size ${max}`)
		//return false
	}
	return true
}

module.exports.readVariableUInt = (buffer) => {
	let data = 0
	for (let i = 0; i < buffer.length; i++) {
		data += buffer[i] * 256 ** (buffer.length - i - 1)
	}
	return data
}

module.exports.readVariableInt = (buffer) => {
	let data = 0
	for (let i = 0; i < buffer.length; i++) {
		if (i === buffer.length - 1) {
			data += buffer[i] & 0b01111111 * 256 ** (buffer.length - i - 1)
			if (buffer[i] & 0b10000000 === 128) data *= -1
		} else {
			data += buffer[i] * 256 ** (buffer.length - i - 1)
		}
	}
	return data
}

module.exports.calculateChecksum = (packet) => {
	if (!Buffer.isBuffer(packet)) packet = Buffer.from(packet, 'hex')

	let total = 0
	for (let i = 0; i < packet.length - 2; i++) { // don't count last 2 packets of checksum value
		total += packet[i] << (8 * ((i + 1) % 2))
	}

	return total % 65536
}

module.exports.isChecksumValid = (packet, checksum) => {
	const toCheck = module.exports.calculateChecksum(packet)
	if (toCheck !== checksum) console.debug(`Invalid checksum ${toCheck} !== ${checksum}`)
	return toCheck === checksum
}

let TABLE = [
	0x00000000, 0x04C11DB7, 0x09823B6E, 0x0D4326D9, 0x130476DC, 0x17C56B6B, 0x1A864DB2, 0x1E475005, 0x2608EDB8, 0x22C9F00F, 0x2F8AD6D6, 0x2B4BCB61, 0x350C9B64, 0x31CD86D3, 0x3C8EA00A, 0x384FBDBD, 0x4C11DB70, 0x48D0C6C7, 0x4593E01E, 0x4152FDA9, 0x5F15ADAC, 0x5BD4B01B, 0x569796C2, 0x52568B75, 0x6A1936C8, 0x6ED82B7F, 0x639B0DA6, 0x675A1011, 0x791D4014, 0x7DDC5DA3, 0x709F7B7A, 0x745E66CD, 0x9823B6E0, 0x9CE2AB57, 0x91A18D8E, 0x95609039, 0x8B27C03C, 0x8FE6DD8B, 0x82A5FB52, 0x8664E6E5, 0xBE2B5B58, 0xBAEA46EF, 0xB7A96036, 0xB3687D81, 0xAD2F2D84, 0xA9EE3033, 0xA4AD16EA, 0xA06C0B5D, 0xD4326D90, 0xD0F37027, 0xDDB056FE, 0xD9714B49, 0xC7361B4C, 0xC3F706FB, 0xCEB42022, 0xCA753D95, 0xF23A8028, 0xF6FB9D9F, 0xFBB8BB46, 0xFF79A6F1, 0xE13EF6F4, 0xE5FFEB43, 0xE8BCCD9A, 0xEC7DD02D, 0x34867077, 0x30476DC0, 0x3D044B19, 0x39C556AE, 0x278206AB, 0x23431B1C, 0x2E003DC5, 0x2AC12072, 0x128E9DCF, 0x164F8078, 0x1B0CA6A1, 0x1FCDBB16, 0x018AEB13, 0x054BF6A4, 0x0808D07D, 0x0CC9CDCA, 0x7897AB07, 0x7C56B6B0, 0x71159069, 0x75D48DDE, 0x6B93DDDB, 0x6F52C06C, 0x6211E6B5, 0x66D0FB02, 0x5E9F46BF, 0x5A5E5B08, 0x571D7DD1, 0x53DC6066, 0x4D9B3063, 0x495A2DD4, 0x44190B0D, 0x40D816BA, 0xACA5C697, 0xA864DB20, 0xA527FDF9, 0xA1E6E04E, 0xBFA1B04B, 0xBB60ADFC, 0xB6238B25, 0xB2E29692, 0x8AAD2B2F, 0x8E6C3698, 0x832F1041, 0x87EE0DF6, 0x99A95DF3, 0x9D684044, 0x902B669D, 0x94EA7B2A, 0xE0B41DE7, 0xE4750050, 0xE9362689, 0xEDF73B3E, 0xF3B06B3B, 0xF771768C, 0xFA325055, 0xFEF34DE2, 0xC6BCF05F, 0xC27DEDE8, 0xCF3ECB31, 0xCBFFD686, 0xD5B88683, 0xD1799B34, 0xDC3ABDED, 0xD8FBA05A, 0x690CE0EE, 0x6DCDFD59, 0x608EDB80, 0x644FC637, 0x7A089632, 0x7EC98B85, 0x738AAD5C, 0x774BB0EB, 0x4F040D56, 0x4BC510E1, 0x46863638, 0x42472B8F, 0x5C007B8A, 0x58C1663D, 0x558240E4, 0x51435D53, 0x251D3B9E, 0x21DC2629, 0x2C9F00F0, 0x285E1D47, 0x36194D42, 0x32D850F5, 0x3F9B762C, 0x3B5A6B9B, 0x0315D626, 0x07D4CB91, 0x0A97ED48, 0x0E56F0FF, 0x1011A0FA, 0x14D0BD4D, 0x19939B94, 0x1D528623, 0xF12F560E, 0xF5EE4BB9, 0xF8AD6D60, 0xFC6C70D7, 0xE22B20D2, 0xE6EA3D65, 0xEBA91BBC, 0xEF68060B, 0xD727BBB6, 0xD3E6A601, 0xDEA580D8, 0xDA649D6F, 0xC423CD6A, 0xC0E2D0DD, 0xCDA1F604, 0xC960EBB3, 0xBD3E8D7E, 0xB9FF90C9, 0xB4BCB610, 0xB07DABA7, 0xAE3AFBA2, 0xAAFBE615, 0xA7B8C0CC, 0xA379DD7B, 0x9B3660C6, 0x9FF77D71, 0x92B45BA8, 0x9675461F, 0x8832161A, 0x8CF30BAD, 0x81B02D74, 0x857130C3, 0x5D8A9099, 0x594B8D2E, 0x5408ABF7, 0x50C9B640, 0x4E8EE645, 0x4A4FFBF2, 0x470CDD2B, 0x43CDC09C, 0x7B827D21, 0x7F436096, 0x7200464F, 0x76C15BF8, 0x68860BFD, 0x6C47164A, 0x61043093, 0x65C52D24, 0x119B4BE9, 0x155A565E, 0x18197087, 0x1CD86D30, 0x029F3D35, 0x065E2082, 0x0B1D065B, 0x0FDC1BEC, 0x3793A651, 0x3352BBE6, 0x3E119D3F, 0x3AD08088, 0x2497D08D, 0x2056CD3A, 0x2D15EBE3, 0x29D4F654, 0xC5A92679, 0xC1683BCE, 0xCC2B1D17, 0xC8EA00A0, 0xD6AD50A5, 0xD26C4D12, 0xDF2F6BCB, 0xDBEE767C, 0xE3A1CBC1, 0xE760D676, 0xEA23F0AF, 0xEEE2ED18, 0xF0A5BD1D, 0xF464A0AA, 0xF9278673, 0xFDE69BC4, 0x89B8FD09, 0x8D79E0BE, 0x803AC667, 0x84FBDBD0, 0x9ABC8BD5, 0x9E7D9662, 0x933EB0BB, 0x97FFAD0C, 0xAFB010B1, 0xAB710D06, 0xA6322BDF, 0xA2F33668, 0xBCB4666D, 0xB8757BDA, 0xB5365D03, 0xB1F740B4
]

if (typeof Int32Array !== 'undefined') TABLE = new Int32Array(TABLE)

module.exports.calculate0806Checksum = (packet) => {
	if (!Buffer.isBuffer(packet)) packet = Buffer.from(packet, 'hex')

	let crc = 0xFFFFFFFF
	for (let index = 0; index < packet.length - 4; index++) {
		const byte = packet[index]
		crc = (crc << 8) ^ TABLE[((crc >> 24) ^ byte) & 0xFF]
	}
	return crc >>> 0
}

//https://gwg.nga.mil/misb/docs/standards/ST0806.4.pdf
module.exports.is0806ChecksumValid = (packet, checksum) => {
	const toCheck = module.exports.calculate0806Checksum(packet)
	if (toCheck !== checksum) console.debug(`Invalid checksum ${toCheck} !== ${checksum}`)
	return toCheck === checksum
}

module.exports.getKey = (buffer) => { // multiple bytes
	if (buffer === undefined) {
		throw new Error('Key is missing')
	}

	const isLong = buffer[0] >> 7 === 1
	const keyLength = buffer[0] & 127

	if (!isLong) { // short form
		return {key: keyLength, keyLength: 1}
	}

	if (keyLength > 5) {// error long form
		return {key: buffer[0], keyLength: 1}
	}

	if (buffer.length < keyLength + 1) {
		throw new Error('Key buffer is not large enough to get key length')
	}

	let key = 128
	for (let i = 0; i < keyLength; i++) {
		key += buffer[i + 1]
	}
	return {key, keyLength: keyLength + 1}
}

module.exports.getBer = (buffer) => { // single byte
	if (buffer === undefined) {
		throw new Error('BER is missing')
	}

	if (buffer.length > 1) {
		throw new Error('BER is greater than 1 byte')
	}

	if (buffer >> 7 === 1) { // BER long form
		return {berHeader: 1, berLength: (buffer & 1111111), contentLength: null} // read least significant 7 bits
	} else { // BER short form
		return {berHeader: 0, berLength: 1, contentLength: buffer}
	}
}

module.exports.getContentLength = (buffer) => { // multiple bytes
	let contentLength = 0
	for (let i = 0; i < buffer.length; i++) {
		contentLength += buffer[i] * 256 ** (buffer.length - i - 1)
	}
	return contentLength
}

module.exports.startsWithKey = (data, key) => {
	if (data.length < key.length) {
		return false
	}

	return key.compare(data, 0, key.length) === 0
}

module.exports.findNextKeyIndex = (data, key) => {
	for (let i = 0; i < data.length - key.length; i++) {
		const match = key.compare(data, i, i + key.length)
		if (match === 0) {
			return i
		}
	}
	return -1
}

module.exports.parseStandard = (standard, buffer, options = {}) => {
	let {berHeader, berLength, contentLength} = module.exports.getBer(buffer[standard.key.length])
	if (contentLength === null) {
		contentLength = module.exports.getContentLength(buffer.subarray(standard.key.length + berHeader, standard.key.length + berHeader + berLength)) // read content length after key and BER header
	}

	const body = buffer.subarray(0, standard.key.length + berHeader + berLength + contentLength)
	const values = standard.parse(body, options)

	return {
		index: standard.key.length + berHeader + berLength + contentLength,
		body,
		values
	}
}

module.exports.decode = (data, standards, callback, options = {}) => {
	if (data.constructor === Uint8Array) {
		data = Buffer.from(data)
	} else if (typeof data === 'string') {
		data = Buffer.from(data, 'hex')
	}

	if (!standards.length) {
		standards = [standards] // accept a single standard or an array of standards
	}

	const packets = {}
	for (const standard of standards) {
		packets[standard.name] = []
	}

	for (let i = 0; i < data.length; i++) {
		const buffer = data.subarray(i, data.length)

		try {
			for (const standard of standards) {
				if (module.exports.startsWithKey(buffer, standard.key)) {
					const {index, values, body} = module.exports.parseStandard(standard, buffer, options)
					if (values) {
						if (options.complete) {
							packets[standard.name].push({body, values})
						} else {
							packets[standard.name].push(values)
						}
						if (callback) {
							callback(values)
						}
					}
					i += index - 1
					// todo break out of loop if matched
				}
			}
		} catch (e) {
			console.debug(e)
		}
	}
	return packets
}

}).call(this)}).call(this,require("buffer").Buffer)
},{"buffer":"buffer"}],14:[function(require,module,exports){
(function (process,Buffer){(function (){
const klv = require('./klv')

module.exports.name = 'st0102'

module.exports.parse = function (buffer, options = {}) {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer

	options.debug === true && console.debug('-------Start Parse 0102-------')
	options.debug === true && process.stdout.write(`Packet ${packet.toString('hex')} ${packet.length}\n`)

	const values = []

	let i = 0
	while (i < packet.length) {
		const key = packet[i]
		const length = packet[i + 1] // todo follow BER encoding
		const valueBuffer = packet.subarray(i + 2, i + 2 + length) // read content after key and length
		const parsed = convert(key, valueBuffer, options)
		if (parsed !== null) {
			if (typeof parsed.value === 'string') {
				parsed.value = parsed.value.replace(/[^\x20-\x7E]+/g, '')
			}

			if (options.debug === true) {
				console.debug(key, length, parsed.name, `${parsed.value}${parsed.unit || ''}`, valueBuffer)
				parsed.packet = valueBuffer
			}

			values.push(parsed)
		} else {
			options.debug === true && console.debug(key, length, 'NULL')
		}

		i += 1 + 1 + length // advance past key, length and value bytes
	}
	options.debug === true && console.debug('-------End Parse 0102---------')
	return values
}

function convert(key, buffer, options) {
	const data = {
		key
	}

	switch (key) {
		case 1:
			klv.checkRequiredSize(key, buffer, 1)
			data.name = st0102data(key).name
			const classificationEnum = buffer.readUInt8(0)
			switch (classificationEnum) {
				case 0:
					data.value = 'UNKNOWN//'
					break
				case 1:
					data.value = 'UNCLASSIFIED//'
					break
				case 2:
					data.value = 'RESTRICTED//'
					break
				case 3:
					data.value = 'CONFIDENTIAL//'
					break
				case 4:
					data.value = 'SECRET//'
					break
				case 5:
					data.value = 'TOP SECRET//'
					break
				default:
					data.value = 'INVALID//'
					break
			}
			return data
		case 2:
			klv.checkRequiredSize(key, buffer, 1)
			data.name = st0102data(key).name
			const countryCodingEnum = buffer.readUInt8(0)
			switch (countryCodingEnum) {
				case 1:
					data.value = 'ISO-3166 Two Letter'
					break
				case 2:
					data.value = 'ISO-3166 Three Letter'
					break
				case 3:
					data.value = 'FIPS 10-4 Two Letter'
					break
				case 4:
					data.value = 'FIPS 10-4 Four Letter'
					break
				case 5:
					data.value = 'ISO-3166 Numeric'
					break
				case 6:
					data.value = '1059 Two Letter'
					break
				case 7:
					data.value = '1059 Three Letter'
					break
				case 8:
					data.value = 'Omitted Value'
					break
				case 9:
					data.value = 'Omitted Value'
					break
				case 10:
					data.value = 'FIPS 10-4 Mixed'
					break
				case 11:
					data.value = 'ISO 3166 Mixed'
					break
				case 12:
					data.value = 'STANAG 1059 Mixed'
					break
				case 13:
					data.value = 'GENC Two Letter'
					break
				case 14:
					data.value = 'GENC Three Letter'
					break
				case 15:
					data.value = 'GENC Numeric'
					break
				case 16:
					data.value = 'GENC Mixed'
					break
				default:
					data.value = `No reference for ${countryCodingEnum}`
			}
			return data
		case 3:
			return {
				key,
				name: st0102data(key).name,
				value: buffer.toString()
			}
		case 4:
			return {
				key,
				name: st0102data(key).name,
				value: buffer.toString()
			}
		case 5:
			return {
				key,
				name: st0102data(key).name,
				value: buffer.toString()
			}
		case 6:
			return {
				key,
				name: st0102data(key).name,
				value: buffer.toString()
			}
		case 7:
			return {
				key,
				name: st0102data(key).name,
				value: buffer.toString()
			}
		case 8:
			return {
				key,
				name: st0102data(key).name,
				value: buffer.toString()
			}
		case 9:
			return {
				key,
				name: st0102data(key).name,
				value: buffer.toString()
			}
		case 11:
			return {
				key,
				name: st0102data(key).name,
				value: buffer.toString()
			}
		case 12:
			klv.checkRequiredSize(key, buffer, 1)
			data.name = st0102data(key).name
			const objectCountryCodingEnum = buffer.readUInt8(0)
			switch (objectCountryCodingEnum) {
				case 1:
					data.value = 'ISO-3166 Two Letter'
					break
				case 2:
					data.value = 'ISO-3166 Three Letter'
					break
				case 3:
					data.value = 'ISO-3166 Numeric'
					break
				case 4:
					data.value = 'FIPS 10-4 Two Letter'
					break
				case 5:
					data.value = 'FIPS 10-4 Four Letter'
					break
				case 6:
					data.value = '1059 Two Letter'
					break
				case 7:
					data.value = '1059 Three Letter'
					break
				case 8:
					data.value = 'Omitted Value'
					break
				case 9:
					data.value = 'Omitted Value'
					break
				case 10:
					data.value = 'Omitted Value'
					break
				case 11:
					data.value = 'Omitted Value'
					break
				case 12:
					data.value = 'Omitted Value'
					break
				case 13:
					data.value = 'GENC Two Letter'
					break
				case 14:
					data.value = 'GENC Three Letter'
					break
				case 15:
					data.value = 'GENC Numeric'
					break
				case 64:
					data.value = 'GENC AdminSub'
					break
				default:
					data.value = `No reference for ${objectCountryCodingEnum}`
			}
			return data
		case 13:
			let value
			if (buffer[0] === 0 && buffer.length > 1) {
				value = buffer.swap16().toString('utf16le') // node.js only supports little endian reading
				buffer.swap16() // return to original order
			} else {
				value = buffer.toString() // encoding error, utf8
			}

			return {
				key,
				name: st0102data(key).name,
				value
			}
		case 14:
			return {
				key,
				name: st0102data(key).name,
				value: buffer.toString()
			}
		case 19:
			klv.checkRequiredSize(key, buffer, 1)
			return {
				key,
				name: st0102data(key).name,
				value: buffer.readUInt8(0)
			}
		case 20:
			klv.checkRequiredSize(key, buffer, 2)
			return {
				key,
				name: st0102data(key).name,
				value: buffer.readUInt16BE(0)
			}
		case 21:
			klv.checkRequiredSize(key, buffer, 16)
			return {
				key,
				name: st0102data(key).name,
				value: buffer.toString()
			}
		case 22:
			return {
				key,
				name: st0102data(key).name,
				value: buffer.readUInt16BE(0)
			}
		default:
			if (options.strict === true) {
				throw Error(`st0102 key ${key} not found`)
			}
			return {
				key,
				name: st0102data(key).name,
				value: 'Not Implemented'
			}
	}
}

exports.getLength = (key) => {
	return st0102data(key).length ?? 2
}

const st0102data = (key) => {
	if (typeof key === 'string') {
		key = parseInt(key)
	}
	switch (key) {
		case 1:
			return {name: 'Security Classification'}
		case 2:
			return {name: 'Classifying Country Coding Method'}
		case 3:
			return {name: 'Classifying Country'}
		case 4:
			return {name: 'Security Information'}
		case 5:
			return {name: 'Caveats'}
		case 6:
			return {name: 'Releasing Instructions'}
		case 7:
			return {name: 'Classified By'}
		case 8:
			return {name: 'Derived From'}
		case 9:
			return {name: 'Classification Reason'}
		case 11:
			return {name: 'Classification and Marking System'}
		case 12:
			return {name: 'Object Country Coding Method'}
		case 13:
			return {name: 'Object Country Codes'}
		case 19:
			return {name: 'Stream ID'}
		case 20:
			return {name: 'Transport Stream ID'}
		case 21:
			return {name: 'Item Designator ID'}
		case 22:
			return {name: 'Version', length: 4}
		default:
			return {name: 'Unknown'}
	}
}
}).call(this)}).call(this,require('_process'),require("buffer").Buffer)
},{"./klv":13,"_process":3,"buffer":"buffer"}],15:[function(require,module,exports){
(function (process,Buffer){(function (){
const klv = require('./klv')

module.exports.name = 'st0104'
module.exports.key = Buffer.from('060e2b34020101010e01010201010000', 'hex')
module.exports.minSize = 31

module.exports.parse = function (buffer, options = {}) {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer

	options.debug === true && console.debug('-------Start Parse 0104-------')
	options.debug === true && process.stdout.write(`Packet ${packet.toString('hex')} ${packet.length}\n`)

	if (packet.length < module.exports.minSize) { // must have a 16 byte key, 1 byte BER, 10 byte timestamp, 4 byte checksum
		throw new Error('Buffer has no content to read')
	}

	const val = module.exports.key.compare(packet, 0, module.exports.key.length) // compare first 16 bytes before BER
	if (val !== 0) {
		throw new Error('Not ST0104')
	}

	let {berHeader, berLength, contentLength} = klv.getBer(packet[module.exports.key.length])
	if (contentLength === null) {
		contentLength = klv.getContentLength(packet.subarray(module.exports.key.length + berHeader, module.exports.key.length + berHeader + berLength))// read content after key and length)
	}

	const parsedLength = module.exports.key.length + berHeader + berLength + contentLength
	if (parsedLength > packet.length) {  // buffer length isn't long enough to read content
		throw new Error('Buffer includes ST0104 key and BER but not content')
	}

	const values = []

	let i = module.exports.key.length + berHeader + berLength //index of first content key
	while (i < parsedLength) {
		const key = packet.subarray(i, i + 16)

		let {berHeader, berLength, contentLength} = klv.getBer(packet[i + key.length])
		if (contentLength === null) {
			contentLength = klv.getContentLength(packet.subarray(i + key.length + berHeader, i + 1 + berHeader + berLength))// read content after key and length
		}

		const valueBuffer = packet.subarray(i + key.length + berHeader + berLength, i + key.length + berHeader + berLength + contentLength) // read content after key and length

		if (parsedLength < i + berHeader + berLength + contentLength + 1) {
			throw new Error('Invalid ST0104 buffer, not enough content')
		}

		const keyString = key.toString('hex')
		const parsed = convert(keyString, valueBuffer, options)

		if (parsed !== null) {
			if (typeof parsed.value === 'string') parsed.value = parsed.value.replace(/[^\x20-\x7E]+/g, '')

			if (options.debug === true) {
				console.debug(keyString, contentLength, parsed.name, `${parsed.value}${parsed.unit || ''}`, valueBuffer)
				parsed.packet = valueBuffer
			}
			values.push(parsed)
		} else {
			options.debug === true && console.debug(keyString, contentLength, 'NULL')
		}

		i += key.length + berHeader + berLength + contentLength // advance past key, length and value bytes
	}
	/*
		if (!klv.isChecksumValid(packet.subarray(0, parsedLength), values[1]?.value || values[1])) {
			throw new Error('Invalid checksum')
		}
	*/
	return values
}

function convert(key, buffer, options) {
	try {
		switch (key) {
			case '060e2b34010101030702010101050000':
				return {
					key,
					name: 'User Defined Time Stamp',
					value: buffer.toString('hex')
				}
			case '060e2b34010101010702010201010000':
				return {
					key,
					name: 'Start Date Time - UTC',
					value: buffer.toString('hex')
				}
			case '060e2b34010101010702010207010000':
				return {
					key,
					name: 'Event Start Date Time - UTC',
					value: buffer.toString('hex')
				}
			case '060e2b34010101010420010201010000':
				return {
					key,
					name: 'Image Source Device',
					value: buffer.toString('hex')
				}
			case '060e2b34010101010701020103020000':
				return {
					key,
					name: 'Frame Center Latitude',
					value: buffer.toString('hex')
				}
			case '060e2b34010101010701020103040000':
				return {
					key,
					name: 'Frame Center Longitude',
					value: buffer.toString('hex')
				}
			case '060e2b340101010a0701020103160000':
				return {
					key,
					name: '???',
					value: buffer.toString('hex')
				}
			case '060e2b34010101010701090201000000':
				return {
					key,
					name: 'Target Width',
					value: buffer.toString('hex')
				}
			case '060e2b34010101010701020102020000':
				return {
					key,
					name: 'Device Altitude',
					value: buffer.toString('hex')
				}
			case '060e2b34010101030701020102060200':
				return {
					key,
					name: 'Device Longitude',
					value: buffer.toString('hex')
				}
			case '060e2b34010101030701020102040200':
				return {
					key,
					name: 'Device Latitude',
					value: buffer.toString('hex')
				}
			case '060e2b34010101010701080101000000':
				return {
					key,
					name: 'Slant Range',
					value: buffer.toString('hex')
				}
			case '060e2b34010101010701100102000000':
				return {
					key,
					name: 'Angle to North',
					value: buffer.toString('hex')
				}
			case '060e2b34010101010701100101000000':
				return {
					key,
					name: 'Sensor Roll Angle',
					value: buffer.toString('hex')
				}
			case '060e2b34010101020420020101080000':
				return {
					key,
					name: 'Field of View (Horizontal)',
					value: buffer.toString('hex')
				}
			case '060e2b340101010704200201010a0100':
				return {
					key,
					name: 'Field of View (Vertical)',
					value: buffer.toString('hex')
				}
			case '060e2b34010101010701100103000000':
				return {
					key,
					name: 'Obliquity Angle',
					value: buffer.toString('hex')
				}
			case '060e2b34010101070701100106000000':
				return {
					key,
					name: 'Platform Heading Angle',
					value: buffer.toString('hex')
				}
			case '060e2b34010101070701100104000000':
				return {
					key,
					name: 'Platform Roll Angle',
					value: buffer.toString('hex')
				}
			case '060e2b34010101070701100105000000':
				return {
					key,
					name: 'Platform Pitch Angle',
					value: buffer.toString('hex')
				}
			case '060e2b34010101030701020103070100':
				return {
					key,
					name: 'Corner Latitude Point 1',
					value: buffer.toString('hex')
				}
			case '060e2b34010101030701020103080100':
				return {
					key,
					name: 'Corner Latitude Point 2',
					value: buffer.toString('hex')
				}
			case '060e2b34010101030701020103090100':
				return {
					key,
					name: 'Corner Latitude Point 3',
					value: buffer.toString('hex')
				}
			case '060e2b340101010307010201030a0100':
				return {
					key,
					name: 'Corner Latitude Point 4',
					value: buffer.toString('hex')
				}
			case '060e2b340101010307010201030b0100':
				return {
					key,
					name: 'Corner Longitude Point 1',
					value: buffer.toString('hex')
				}
			case '060e2b340101010307010201030c0100':
				return {
					key,
					name: 'Corner Longitude Point 2',
					value: buffer.toString('hex')
				}
			case '060e2b340101010307010201030d0100':
				return {
					key,
					name: 'Corner Longitude Point 3',
					value: buffer.toString('hex')
				}
			case '060e2b340101010307010201030e0100':
				return {
					key,
					name: 'Corner Longitude Point 4',
					value: buffer.toString('hex')
				}
			case '060e2b34010101010701010100000000':
				return {
					key,
					name: 'Image Coordinate System',
					value: buffer.toString('hex')
				}
			case '060e2b34010101010101200100000000':
				return {
					key,
					name: 'Device Designation',
					value: buffer.toString('hex')
				}
			case '060e2b34010101010701030101010000':
				return {
					key,
					name: '???',
					value: buffer.toString('hex')
				}
			case '060e2b34010101010701010200000000':
				return {
					key,
					name: '???',
					value: buffer.toString('hex')
				}
			case '060e2b34010101010105050000000000':
				return {
					key,
					name: 'Episode Number',
					value: buffer.toString('hex')
				}
			default:
				if (options.strict === true) {
					throw Error(`st0104 key ${key} not found`)
				}
				return {
					key,
					name: 'Unknown',
					value: 'Not Implemented'
				}
		}
	} catch (e) {
		throw e
	}
}

}).call(this)}).call(this,require('_process'),require("buffer").Buffer)
},{"./klv":13,"_process":3,"buffer":"buffer"}],16:[function(require,module,exports){
(function (process,Buffer){(function (){
const st0102 = require('./st0102')
const st0806 = require('./st0806')
const st0903 = require('./st0903')
const klv = require('./klv')

module.exports.name = 'st0601'
module.exports.key = Buffer.from('060e2b34020b01010e01030101000000', 'hex')
module.exports.minSize = 31

module.exports.parse = (buffer, options = {}) => {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer

	options.debug === true && console.debug('-------Start Parse 0601-------')
	options.debug === true && process.stdout.write(`Packet ${packet.toString('hex')} ${packet.length}\n`)

	if (packet.length < module.exports.minSize) { // must have a 16 byte key, 1 byte BER, 10 byte timestamp, 4 byte checksum
		throw new Error('Buffer has no content to read')
	}

	const val = module.exports.key.compare(packet, 0, module.exports.key.length) // compare first 16 bytes before BER
	if (val !== 0) {
		throw new Error('Not ST0601')
	}

	let {berHeader, berLength, contentLength} = klv.getBer(packet[module.exports.key.length])
	if (contentLength === null) {
		contentLength = klv.getContentLength(packet.subarray(module.exports.key.length + berHeader, module.exports.key.length + berHeader + berLength))// read content after key and length)
	}

	const parsedLength = module.exports.key.length + berHeader + berLength + contentLength
	if (parsedLength > packet.length) {  // buffer length isn't long enough to read content
		throw new Error('Buffer includes ST0601 key and BER but not content')
	}

	const values = []

	let i = module.exports.key.length + berHeader + berLength //index of first content key
	while (i < parsedLength) {
		const {key, keyLength} = klv.getKey(packet.subarray(i, packet.length))

		let {berHeader, berLength, contentLength} = klv.getBer(packet[i + keyLength])
		if (contentLength === null) {
			contentLength = klv.getContentLength(packet.subarray(i + keyLength + berHeader, i + keyLength + berHeader + berLength))// read content after key and length // i + key.length
		}

		const valueBuffer = packet.subarray(i + keyLength + berHeader + berLength, i + keyLength + berHeader + berLength + contentLength) // read content after key and length

		if (parsedLength < i + keyLength + berHeader + berLength + contentLength) {
			throw new Error(`Invalid ST0601 buffer, not enough content key: ${key}, key length: ${keyLength}, content length: ${contentLength}`)
		}

		const parsed = options.value !== false ? convert({key, buffer: valueBuffer, options}) : {key}

		if (typeof parsed.value === 'string') parsed.value = parsed.value.replace(/[^\x20-\x7E]+/g, '')

		if (options.debug === true) {
			if (key === 2) {
				console.debug(key, contentLength, parsed.name, `${new Date(parsed.value / 1000)}${parsed.unit || ''}`, valueBuffer)
			} else {
				console.debug(key, contentLength, parsed.name, `${parsed.value}${parsed.unit || ''}`, valueBuffer)
			}
		}
		if (options.debug || options.payload || options.value === false) {
			parsed.packet = valueBuffer
		}

		values.push(parsed)

		i += keyLength + berHeader + berLength + contentLength // advance past key, length and value bytes
	}

	const checksum = values.find(klv => klv.key === 1)
	const checksumValue = checksum.value !== undefined ? checksum.value : checksum.packet.readUInt16BE(0)
	if (!klv.isChecksumValid(packet.subarray(0, parsedLength), checksumValue)) {
		checksum.valid = false
		console.debug('Invalid checksum')
		//throw new Error(`Invalid checksum`)
	}

	return values
}

module.exports.encode = (items) => {
	const chunks = items.map(klv => {
		if (klv.key == 2) {
			const uint = bnToBuf(klv.value, st0601data(klv.key).length)
			return {
				key: klv.key,
				packet: uint
			}
		}
		return klv
	})

	return module.exports.assemble(chunks)
}

module.exports.assemble = (chunks) => {
	const header = module.exports.key.toString('hex')
	let payload = ''
	for (const chunk of chunks) {
		if (chunk.key === 1) {
			continue
		}
		const packet = typeof chunk.packet === 'string' ? chunk.packet : chunk.packet.toString('hex')
		payload += chunk.key.toString(16).padStart(2, '0') + (packet.length / 2).toString(16).padStart(2, '0') + packet
	}
	const payloadWithCheckSum = payload + `01020000`
	const completePacketForChecksum = header + getPayloadLengthBer(payloadWithCheckSum) + payloadWithCheckSum
	const checksum = klv.calculateChecksum(completePacketForChecksum) // pad the ending with a fake checksum
	return completePacketForChecksum.slice(0, -4) + checksum.toString(16).padStart(4, '0') // remove 4 blank characters, 2 bytes
}

const getPayloadLengthBer = (payload) => {
	const byteLength = payload.length / 2
	if (byteLength > 127) { // BER long form
		const berLength = Math.ceil(byteLength / 255)
		return `8${berLength}${byteLength.toString(16).padStart(berLength * 2, '0')}`
	} else { // BER short form
		return byteLength.toString(16).padStart(2, '0')
	}
}

const bnToBuf = (bn, size) => {
	let hex = BigInt(bn).toString(16)
	hex = hex.padStart(size * 2, '0')
	return hex
}

const two16SignedMax = 2 ** 15 - 1
const two16SignedMin = -1 * two16SignedMax
const two16Unsigned = 2 ** 16 - 1
const two32max = 2 ** 32 - 1
const two32SignedMax = 2 ** 31 - 1
const two32SignedMin = -1 * two32SignedMax

const convert = ({key, buffer, options}) => {
	try {
		switch (key) {
			case 1:
				klv.checkRequiredSize(key, buffer, st0601data(key).length)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.readUInt16BE(0),
					valid: true
				}
			case 2:
				klv.checkRequiredSize(key, buffer, st0601data(key).length)
				return {
					key,
					name: st0601data(key).name,
					value: parseFloat(buffer.readBigUInt64BE(0)),
					unit: 'µs'
				}
			case 3:
				return {
					key,
					name: st0601data(key).name,
					value: buffer.toString()
				}
			case 4:
				return {
					key,
					name: st0601data(key).name,
					value: buffer.toString()
				}
			case 5:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt16BE(0), [0, two16Unsigned], [0, 360]),
					unit: '°'
				}
			case 6:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt16BE(0), [two16SignedMin, two16SignedMax], [-20, 20]),
					unit: '°'
				}
			case 7:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt16BE(0), [two16SignedMin, two16SignedMax], [-50, 50]),
					unit: '°'
				}
			case 8:
				klv.checkRequiredSize(key, buffer, 1)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.readUInt8(0),
					unit: 'm/s'
				}
			case 9:
				klv.checkRequiredSize(key, buffer, 1)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.readUInt8(0),
					unit: 'm/s'
				}
			case 10:
				return {
					key,
					name: st0601data(key).name,
					value: buffer.toString()
				}
			case 11:
				return {
					key,
					name: st0601data(key).name,
					value: buffer.toString()
				}
			case 12:
				return {
					key,
					name: st0601data(key).name,
					value: buffer.toString()
				}
			case 13:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-90, 90]),
					unit: '°'
				}
			case 14:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-180, 180]),
					unit: '°'
				}
			case 15:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt16BE(0), [0, two16Unsigned], [-900, 19000]),
					unit: 'm'
				}
			case 16:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt16BE(0), [0, two16Unsigned], [0, 180]),
					unit: '°'
				}
			case 17:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt16BE(0), [0, two16Unsigned], [0, 180]),
					unit: '°'
				}
			case 18:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt32BE(0), [0, two32max], [0, 360]),
					unit: '°'
				}
			case 19:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-180, 180]),
					unit: '°'
				}
			case 20:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt32BE(0), [0, two32max], [0, 360]),
					unit: '°'
				}
			case 21:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt32BE(0), [0, two32max], [0, 5000000]),
					unit: 'm'
				}
			case 22:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt16BE(0), [0, two16Unsigned], [0, 10000]),
					unit: 'm'
				}
			case 23:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-90, 90]),
					unit: '°'
				}
			case 24:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-180, 180]),
					unit: '°'
				}
			case 25:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt16BE(0), [0, two16Unsigned], [-900, 19000]),
					unit: 'm'
				}
			case 26:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.compare(Buffer.from('8000', 'hex')) === 0 ? null : klv.scale(buffer.readInt16BE(0), [two16SignedMin, two16SignedMax], [-0.075, 0.075]),
					unit: '°'
				}
			case 27:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.compare(Buffer.from('8000', 'hex')) === 0 ? null : klv.scale(buffer.readInt16BE(0), [two16SignedMin, two16SignedMax], [-0.075, 0.075]),
					unit: '°'
				}
			case 28:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.compare(Buffer.from('8000', 'hex')) === 0 ? null : klv.scale(buffer.readInt16BE(0), [two16SignedMin, two16SignedMax], [-0.075, 0.075]),
					unit: '°'
				}
			case 29:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.compare(Buffer.from('8000', 'hex')) === 0 ? null : klv.scale(buffer.readInt16BE(0), [two16SignedMin, two16SignedMax], [-0.075, 0.075]),
					unit: '°'
				}
			case 30:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.compare(Buffer.from('8000', 'hex')) === 0 ? null : klv.scale(buffer.readInt16BE(0), [two16SignedMin, two16SignedMax], [-0.075, 0.075]),
					unit: '°'
				}
			case 31:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.compare(Buffer.from('8000', 'hex')) === 0 ? null : klv.scale(buffer.readInt16BE(0), [two16SignedMin, two16SignedMax], [-0.075, 0.075]),
					unit: '°'
				}
			case 32:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.compare(Buffer.from('8000', 'hex')) === 0 ? null : klv.scale(buffer.readInt16BE(0), [two16SignedMin, two16SignedMax], [-0.075, 0.075]),
					unit: '°'
				}
			case 33:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.compare(Buffer.from('8000', 'hex')) === 0 ? null : klv.scale(buffer.readInt16BE(0), [two16SignedMin, two16SignedMax], [-0.075, 0.075]),
					unit: '°'
				}
			case 34:
				klv.checkRequiredSize(key, buffer, 1)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.readUInt8(0),
					//unit: 'code'
				}
			case 35:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt16BE(0), [0, two16Unsigned], [0, 360]),
					unit: '°'
				}
			case 36:
				klv.checkRequiredSize(key, buffer, 1)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt8(0), [0, 255], [0, 100]),
					unit: 'm/s'
				}
			case 37:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt16BE(0), [0, two16Unsigned], [0, 5000]),
					unit: 'mbar'
				}
			case 38:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt16BE(0), [0, two16Unsigned], [-900, 19000]),
					unit: 'm'
				}
			case 39:
				klv.checkRequiredSize(key, buffer, 1)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.readInt8(0),
					unit: '°C'
				}
			case 40:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-90, 90]),
					unit: '°'
				}
			case 41:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-180, 180]),
					unit: '°'
				}
			case 42:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt16BE(0), [0, two16Unsigned], [-900, 19000]),
					unit: 'm'
				}
			case 43:
				return {
					key,
					name: st0601data(key).name,
					value: 2 * buffer.readUInt8(0),
					unit: 'pixels'
				}
			case 44:
				return {
					key,
					name: st0601data(key).name,
					value: 2 * buffer.readUInt8(0),
					unit: 'pixels'
				}
			case 45:
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt16BE(0), [0, two16Unsigned], [0, 4095]),
					unit: 'm'
				}
			case 46:
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt16BE(0), [0, two16Unsigned], [0, 4095]),
					unit: 'm'
				}
			case 47:
				return {
					key,
					name: st0601data(key).name,
					value: buffer.readUInt8(0),
				}
			case 48:
				return {
					key,
					name: st0601data(key).name,
					value: st0102.parse(buffer, options)
				}
			case 50:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt16BE(0), [two16SignedMin, two16SignedMax], [-20, 20]),
					unit: '°'
				}
			case 51:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt16BE(0), [two16SignedMin, two16SignedMax], [-180, 180]),
					unit: 'm/s'
				}
			case 52:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt16BE(0), [two16SignedMin, two16SignedMax], [-20, 20]),
					unit: '°'
				}
			case 55:
				klv.checkRequiredSize(key, buffer, 1)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt8(0), [0, 255], [0, 100]),
					unit: '%'
				}
			case 56:
				klv.checkRequiredSize(key, buffer, 1)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.readUInt8(0),
					unit: 'm/s'
				}
			case 57:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt32BE(0), [0, two32max], [0, 5000000]),
					unit: 'm'
				}
			case 58:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt16BE(0), [0, two16Unsigned], [0, 10000]),
					unit: 'kg'
				}
			case 59:
				return {
					key,
					name: st0601data(key).name,
					value: buffer.toString()
				}
			case 62:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.readUInt16BE(0)
				}
			case 63:
				klv.checkRequiredSize(key, buffer, 1)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.readUInt8(0),
				}
			case 64:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt16BE(0), [0, two16Unsigned], [0, 360]),
					unit: '°'
				}
			case 65:
				klv.checkRequiredSize(key, buffer, 1)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.readUInt8(0),
				}
			case 67:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-90, 90]),
					unit: '°'
				}
			case 68:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-180, 180]),
					unit: '°'
				}
			case 70:
				return {
					key,
					name: st0601data(key).name,
					value: buffer.toString()
				}
			case 71:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt16BE(0), [0, two16Unsigned], [0, 360]),
					unit: '°'
				}
			case 72:
				klv.checkRequiredSize(key, buffer, 8)
				return {
					key,
					name: st0601data(key).name,
					value: parseFloat(buffer.readBigUInt64BE(0)),
					unit: 'µs'
				}
			case 73:
				return {
					key,
					name: st0601data(key).name,
					value: st0806.parseLS(buffer, options)
				}
			case 74:
				return {
					key,
					name: st0601data(key).name,
					value: st0903.parseLS(buffer, options)
				}
			case 75:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt16BE(0), [0, two16Unsigned], [-900, 19000]),
					unit: 'm'
				}
			case 76:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt16BE(0), [0, two16Unsigned], [-900, 19000]),
					unit: 'm'
				}
			case 77:
				klv.checkRequiredSize(key, buffer, 1)
				return {
					key,
					name: st0601data(key).name,
					value: buffer.readUInt8(0),
				}
			case 78:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readUInt16BE(0), [0, two16Unsigned], [-900, 19000]),
					unit: 'm'
				}
			case 79:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt16BE(0), [two16SignedMin, two16SignedMax], [-327, 327]),
					unit: '°'
				}
			case 80:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt16BE(0), [two16SignedMin, two16SignedMax], [-327, 327]),
					unit: '°'
				}
			case 82:
				klv.checkRequiredSize(key, buffer, 4)
				if (buffer.compare(Buffer.from('8000', 'hex')) === 0) {
					return null
				}
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-90, 90]),
					unit: '°'
				}
			case 83:
				klv.checkRequiredSize(key, buffer, 4)
				if (buffer.compare(Buffer.from('8000', 'hex')) === 0) {
					return null
				}
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-180, 180]),
					unit: '°'
				}
			case 84:
				klv.checkRequiredSize(key, buffer, 4)
				if (buffer.compare(Buffer.from('8000', 'hex')) === 0) {
					return null
				}
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-90, 90]),
					unit: '°'
				}
			case 85:
				klv.checkRequiredSize(key, buffer, 4)
				if (buffer.compare(Buffer.from('8000', 'hex')) === 0) {
					return null
				}
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-180, 180]),
					unit: '°'
				}
			case 86:
				klv.checkRequiredSize(key, buffer, 4)
				if (buffer.compare(Buffer.from('8000', 'hex')) === 0) {
					return null
				}
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-90, 90]),
					unit: '°'
				}
			case 87:
				klv.checkRequiredSize(key, buffer, 4)
				if (buffer.compare(Buffer.from('8000', 'hex')) === 0) {
					return null
				}
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-180, 180]),
					unit: '°'
				}
			case 88:
				klv.checkRequiredSize(key, buffer, 4)
				if (buffer.compare(Buffer.from('8000', 'hex')) === 0) {
					return null
				}
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-90, 90]),
					unit: '°'
				}
			case 89:
				klv.checkRequiredSize(key, buffer, 4)
				if (buffer.compare(Buffer.from('8000', 'hex')) === 0) {
					return null
				}
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt32BE(0), [two32SignedMin, two32SignedMax], [-180, 180]),
					unit: '°'
				}
			case 90:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt16BE(0), [two32SignedMin, two32SignedMax], [-90, 90]),
					unit: '°'
				}
			case 91:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt16BE(0), [two32SignedMin, two32SignedMax], [-90, 90]),
					unit: '°'
				}
			case 92:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt16BE(0), [two32SignedMin, two32SignedMax], [-90, 90]),
					unit: '°'
				}
			case 93:
				klv.checkRequiredSize(key, buffer, 4)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(buffer.readInt16BE(0), [two32SignedMin, two32SignedMax], [-90, 90]),
					unit: '°'
				}
			case 94:
				return {
					key,
					name: st0601data(key).name,
					value: buffer.toString('hex') // todo verify this is supposed to have unicode in it
				}
			case 96:
				klv.checkMaxSize(key, buffer, 8)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(klv.readVariableUInt(buffer), [0, 2 ** (buffer.length * 8)], [0, 1500000]), //todo this is not correct
					unit: 'm'
				}
			case 116:
				return {
					key,
					name: st0601data(key).name,
					value: 'Not Implemented'
				}
			case 117:
				return {
					key,
					name: st0601data(key).name,
					value: 'Not Implemented',
					unit: 'dps'
				}
			case 118:
				return {
					key,
					name: st0601data(key).name,
					value: 'Not Implemented',
					unit: 'dps'
				}
			case 119:
				return {
					key,
					name: st0601data(key).name,
					value: 'Not Implemented',
					unit: 'dps'
				}
			case 120:
				return {
					key,
					name: st0601data(key).name,
					value: 'Not Implemented',
					unit: '%'
				}
			case 123:
				return {
					key,
					name: st0601data(key).name,
					value: 'Not Implemented'
				}
			case 124:
				return {
					key,
					name: st0601data(key).name,
					value: 'Not Implemented'
				}
			case 125:
				const min = 0
				const max = 2 ** (8 * buffer.length - 1)
				return {
					key,
					name: st0601data(key).name,
					value: klv.scale(klv.readVariableInt(buffer), [min, max], [-900, 40000]),
				}
			case 129:
				return {
					key,
					name: st0601data(key).name,
					value: 'Not Implemented'
				}
			default:
				if (options.strict === true) {
					throw Error(`st0601 key ${key} not found`)
				}
				return {
					key,
					name: st0601data(key).name,
					value: 'Not Implemented'
				}
		}
	} catch (e) {
		throw e
	}
}

module.exports.unconvert = ({key, value}) => {
	try {
		switch (key) {
			case 13:
				const buf13 = Buffer.allocUnsafe(4)
				buf13.writeInt32BE(klv.scale(value,  [-90, 90],[two32SignedMin, two32SignedMax]))
				return {
					key,
					name: st0601data(key).name,
					value: buf13,
					unit: '°'
				}
			case 14:
				const buf14 = Buffer.allocUnsafe(4)
				buf14.writeInt32BE(klv.scale(value,  [-180, 180],[two32SignedMin, two32SignedMax]))
				return {
					key,
					name: st0601data(key).name,
					value: buf14,
					unit: '°'
				}
			case 15:
				const buf15 = Buffer.allocUnsafe(2)
				buf15.writeInt16BE(klv.scale(value, [-900, 19000], [0, two16Unsigned]))
				return {
					key,
					name: st0601data(key).name,
					value: buf15,
					unit: 'm'
				}
			case 23:
				const buf23 = Buffer.allocUnsafe(4)
				buf23.writeInt32BE(klv.scale(value,  [-90, 90],[two32SignedMin, two32SignedMax]))
				return {
					key,
					name: st0601data(key).name,
					value: buf23,
					unit: '°'
				}
			case 24:
				const buf24 = Buffer.allocUnsafe(4)
				buf24.writeInt32BE(klv.scale(value,  [-180, 180],[two32SignedMin, two32SignedMax]))
				return {
					key,
					name: st0601data(key).name,
					value: buf24,
					unit: '°'
				}
			case 25:
				const buf25 = Buffer.allocUnsafe(2)
				buf25.writeInt16BE(klv.scale(value, [-900, 19000], [0, two16Unsigned]))
				return {
					key,
					name: st0601data(key).name,
					value: buf25,
					unit: 'm'
				}
		}
	} catch (e) {
		throw e
	}
}

module.exports.keys = (key) => {
	return st0601data(key)
}

const st0601data = (key) => {
	if (typeof key === 'string') {
		key = parseInt(key)
	}
	switch (key) {
		case 1:
			return {name: 'Checksum', length: 2}
		case 2:
			return {name: 'Precision Time Stamp', length: 8}
		case 3:
			return {name: 'Mission ID'}
		case 4:
			return {name: 'Platform Tail Number'}
		case 5:
			return {name: 'Platform Heading Angle'}
		case 6:
			return {name: 'Platform Pitch Angle'}
		case 7:
			return {name: 'Platform Roll Angle'}
		case 8:
			return {name: 'Platform True Airspeed'}
		case 9:
			return {name: 'Platform Indicated Airspeed'}
		case 10:
			return {name: 'Platform Designation'}
		case 11:
			return {name: 'Image Source Sensor'}
		case 12:
			return {name: 'Image Coordinate System'}
		case 13:
			return {name: 'Sensor Latitude'}
		case 14:
			return {name: 'Sensor Longitude'}
		case 15:
			return {name: 'Sensor True Altitude'}
		case 16:
			return {name: 'Sensor Horizontal Field of View'}
		case 17:
			return {name: 'Sensor Vertical Field of View'}
		case 18:
			return {name: 'Sensor Relative Azimuth Angle'}
		case 19:
			return {name: 'Sensor Relative Elevation Angle'}
		case 20:
			return {name: 'Sensor Relative Roll Angle'}
		case 21:
			return {name: 'Slant Range'}
		case 22:
			return {name: 'Target Width'}
		case 23:
			return {name: 'Frame Center Latitude'}
		case 24:
			return {name: 'Frame Center Longitude'}
		case 25:
			return {name: 'Frame Center Elevation'}
		case 26:
			return {name: 'Offset Corner Latitude Point 1'}
		case 27:
			return {name: 'Offset Corner Longitude Point 1'}
		case 28:
			return {name: 'Offset Corner Latitude Point 2'}
		case 29:
			return {name: 'Offset Corner Longitude Point 2'}
		case 30:
			return {name: 'Offset Corner Latitude Point 3'}
		case 31:
			return {name: 'Offset Corner Longitude Point 3'}
		case 32:
			return {name: 'Offset Corner Latitude Point 4'}
		case 33:
			return {name: 'Offset Corner Longitude Point 4'}
		case 34:
			return {name: 'Icing Detected'}
		case 35:
			return {name: 'Wind Direction'}
		case 36:
			return {name: 'Wind Speed'}
		case 37:
			return {name: 'Static Pressure'}
		case 38:
			return {name: 'Density Altitude'}
		case 39:
			return {name: 'Outside Air Temperature'}
		case 40:
			return {name: 'Target Location Latitude'}
		case 41:
			return {name: 'Target Location Longitude'}
		case 42:
			return {name: 'Target Location Elevation'}
		case 43:
			return {name: 'Target Track Gate Width'}
		case 44:
			return {name: 'Target Track Gate Height'}
		case 45:
			return {name: 'Target Error Estimate - CE90'}
		case 46:
			return {name: 'Target Error Estimate - LE90'}
		case 47:
			return {name: 'Generic Flag Data'}
		case 48:
			return {name: 'Security Local Set'}
		case 50:
			return {name: 'Platform Angle of Attack'}
		case 51:
			return {name: 'Platform Vertical Speed'}
		case 52:
			return {name: 'Platform Sideslip Angle'}
		case 55:
			return {name: 'Relative Humidity'}
		case 56:
			return {name: 'Platform Ground Speed'}
		case 57:
			return {name: 'Ground Range'}
		case 58:
			return {name: 'Platform Fuel Remaining'}
		case 59:
			return {name: 'Platform Call Sign'}
		case 62:
			return {name: 'Laser PRF Code'}
		case 63:
			return {name: 'Sensor Field of View Name'}
		case 64:
			return {name: 'Platform Magnetic Heading'}
		case 65:
			return {name: 'UAS Datalink LS Version Number'}
		case 67:
			return {name: 'Alternate Platform Latitude'}
		case 68:
			return {name: 'Alternate Platform Longitude'}
		case 70:
			return {name: 'Alternate Platform Name'}
		case 71:
			return {name: 'Alternate Platform Heading'}
		case 72:
			return {name: 'Event Start Time'}
		case 73:
			return {name: 'RVT Local Set'}
		case 74:
			return {name: 'VMTI Local Set'}
		case 75:
			return {name: 'Sensor Ellipsoid Height'}
		case 76:
			return {name: 'Alternate Platform Ellipsoid Height'}
		case 77:
			return {name: 'Operational Mode'}
		case 78:
			return {name: 'Frame Center Height Above Ellipsoid'}
		case 79:
			return {name: 'Sensor North Velocity'}
		case 80:
			return {name: 'Sensor East Velocity'}
		case 81:
			return {name: 'Image Horizon Pixel Pack'}
		case 82:
			return {name: 'Corner Latitude Point 1'}
		case 83:
			return {name: 'Corner Longitude Point 1'}
		case 85:
			return {name: 'Corner Longitude Point 2'}
		case 84:
			return {name: 'Corner Latitude Point 2'}
		case 86:
			return {name: 'Corner Latitude Point 3'}
		case 87:
			return {name: 'Corner Longitude Point 3'}
		case 88:
			return {name: 'Corner Latitude Point 4 '}
		case 89:
			return {name: 'Corner Longitude Point 4'}
		case 90:
			return {name: 'Platform Pitch Angle (Full)'}
		case 91:
			return {name: 'Platform Roll Angle (Full)'}
		case 92:
			return {name: 'Platform Angle of Attack (Full)'}
		case 93:
			return {name: 'Platform Sideslip Angle (Full)'}
		case 94:
			return {name: 'MIIS Core Identifier'}
		case 96:
			return {name: 'Target Width Extended'}
		case 98:
			return {name: 'Geo-Registration Local Set'}
		case 104:
			return {name: 'Sensor Ellipsoid Height Extended'}
		case 113:
			return {name: 'Altitude AGL'}
		case 116:
			return {name: 'Control Command Verification List'}
		case 117:
			return {name: 'Sensor Azimuth Rate'}
		case 118:
			return {name: 'Sensor Elevation Rate'}
		case 119:
			return {name: 'Sensor Roll Rate'}
		case 120:
			return {name: 'On-board MI Storage Percent Full'}
		default:
			return {name: 'Unknown'}
	}
}

}).call(this)}).call(this,require('_process'),require("buffer").Buffer)
},{"./klv":13,"./st0102":14,"./st0806":17,"./st0903":18,"_process":3,"buffer":"buffer"}],17:[function(require,module,exports){
(function (process,Buffer){(function (){
const klv = require('./klv')
const PoiLocalSet = require('./PoiLocalSet')
const UserDefinedLocalSet = require('./UserDefinedLocalSet')

module.exports.name = 'st0806'
module.exports.key = Buffer.from('060E2B34020B01010E01030102000000', 'hex')
module.exports.minSize = 31

//const keyLength = options.localSet ? 1 : module.exports.key.length
//const val = module.exports.key.compare(packet, 0, module.exports.key.length) // compare first 16 bytes before BER

module.exports.parse = function (buffer, options = {}) {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer

	options.debug === true && console.debug('-------Start Parse 0806-------')
	options.debug === true && process.stdout.write(`Packet ${packet.toString('hex')} ${packet.length}\n`)

	if (packet.length < module.exports.minSize) { // must have a 16 byte key, 1 byte BER, 10 byte timestamp, 4 byte checksum
		throw new Error('Buffer has no content to read')
	}

	const val = module.exports.key.compare(packet, 0, module.exports.key.length) // compare first 16 bytes before BER
	if (val !== 0) {
		throw new Error('Not ST 0806')
	}

	let {berHeader, berLength, contentLength} = klv.getBer(packet[module.exports.key.length])
	if (contentLength === null) {
		contentLength = klv.getContentLength(packet.subarray(module.exports.key.length + berHeader, module.exports.key.length + berHeader + berLength))// read content after key and length
	}

	const parsedLength = module.exports.key.length + berHeader + berLength + contentLength
	if (parsedLength > packet.length) {  // buffer length isn't long enough to read content
		throw new Error('Buffer includes ST 0806 key and BER but not content')
	}

	let i = module.exports.key.length + berHeader + berLength //index of first content key

	const values = module.exports.parseLS(buffer.slice(i, i + parsedLength), {...options, checksum: false, header: false})
	const checksum = values.find(klv => klv.key === 1)
	const checksumValue = checksum.value !== undefined ? checksum.value : checksum.packet.readUInt32BE(0)
	if (!klv.is0806ChecksumValid(packet.subarray(0, packet.length), checksumValue)) {
		checksum.valid = false
		console.debug('Invalid checksum')
	}

	return values
}

module.exports.parseLS = function (buffer, options = {}) {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer

	options.debug === true && options.header !== false && console.debug('-------Start Parse 0806 LS-------')
	options.debug === true && options.header !== false && process.stdout.write(`Packet ${packet.toString('hex')} ${packet.length}\n`)

	const values = []

	let i = 0
	while (i < packet.length) {
		const key = packet[i]

		let {berHeader, berLength, contentLength} = klv.getBer(packet[i + 1])
		if (contentLength === null) {
			contentLength = klv.getContentLength(packet.subarray(i + 1 + berHeader, i + 1 + berHeader + berLength))// read content after key and length)
		}

		const valueBuffer = packet.subarray(i + berHeader + berLength + 1, i + berHeader + berLength + contentLength + 1) // read content after key and length


		if (packet.length < i + berHeader + berLength + contentLength + 1) {
			throw new Error('Invalid st0806 buffer, not enough content')
		}
		const parsed = convert(key, valueBuffer, options)
		if (typeof parsed.value === 'string') {
			parsed.value = parsed.value.replace(/[^\x20-\x7E]+/g, '')
		}

		if (options.debug === true) {
			if (key === 2) console.debug(key, contentLength, parsed.name, `${new Date(parsed.value / 1000)}${parsed.unit || ''}`, valueBuffer)
			else console.debug(key, contentLength, parsed.name, `${parsed.value}${parsed.unit || ''}`, valueBuffer)
		}

		if (options.debug || options.payload || options.value === false) {
			parsed.packet = valueBuffer
		}

		values.push(parsed)

		i += berHeader + berLength + contentLength + 1 // advance past key, length and value bytes
	}

	options.debug === true && options.header !== false && console.debug('-------End Parse 0806 LS---------')
	return values
}

module.exports.encode = (items) => {
	const chunks = items.map(klv => {
		if (klv.key == 2) {
			const uint = bnToBuf(klv.value, 8)
			return {
				key: klv.key,
				packet: uint
			}
		}
		return klv
	})

	return module.exports.assemble(chunks)
}

module.exports.assemble = (chunks) => {
	const header = module.exports.key.toString('hex')
	let payload = ''
	for (const chunk of chunks) {
		if (chunk.key === 1) {
			continue
		}
		const packet = typeof chunk.packet === 'string' ? chunk.packet : chunk.packet.toString('hex')
		payload += chunk.key.toString(16).padStart(2, '0') + (packet.length / 2).toString(16).padStart(2, '0') + packet
	}
	const payloadWithCheckSum = payload + `010400000000`
	const completePacketForChecksum = header + getPayloadLengthBer(payloadWithCheckSum) + payloadWithCheckSum

	const checksum = klv.calculate0806Checksum(completePacketForChecksum) // pad the ending with a fake checksum
	return completePacketForChecksum.slice(0, -8) + checksum.toString(16).padStart(8, '0') // remove 4 blank characters, 2 bytes
}

const getPayloadLengthBer = (payload) => {
	const byteLength = payload.length / 2
	if (byteLength > 127) { // BER long form
		const berLength = Math.ceil(byteLength / 255)
		return `8${berLength}${byteLength.toString(16).padStart(berLength * 2, '0')}`
	} else { // BER short form
		return byteLength.toString(16).padStart(2, '0')
	}
}

const bnToBuf = (bn, size) => {
	let hex = BigInt(bn).toString(16)
	hex = hex.padStart(size * 2, '0')
	return hex
}

function convert(key, buffer, options) {
	switch (key) {
		case 1:
			klv.checkRequiredSize(key, buffer, 4)
			return {
				key,
				name: st0806data(key).name,
				value: buffer.readUInt32BE(0)
			}
		case 2:
			klv.checkRequiredSize(key, buffer, 8)
			return {
				key,
				name: st0806data(key).name,
				value: parseFloat(buffer.readBigUInt64BE(0)),
				unit: 'µs'
			}
		case 7:
			klv.checkRequiredSize(key, buffer, 4)
			return {
				key,
				name: st0806data(key).name,
				value: buffer.readUInt32BE(0),
			}
		case 8:
			klv.checkRequiredSize(key, buffer, 1)
			return {
				key,
				name: st0806data(key).name,
				value: buffer.readUInt8(0),
			}
		case 9:
			klv.checkRequiredSize(key, buffer, 4)
			return {
				key,
				name: st0806data(key).name,
				value: buffer.readUInt32BE(0),
			}
		case 10:
			return {
				key,
				name: st0806data(key).name,
				value: buffer.toString(),
			}
		case 11:
			try {
				const localSet = UserDefinedLocalSet.parse(buffer, options)
				const id = localSet.find(klv => klv.key === 1)
				const data = localSet.find(klv => klv.key === 2)
				if (id && data) {
					return {
						key,
						type: data.type,
						name: `${data.name} (${id.value})`,
						value: data.value
					}
				} else {
					return {
						key,
						name: `Error Bad Metadata`,
						value: JSON.stringify(localSet)
					}
				}
			} catch(e) {
				return {
					key,
					name: `Error Bad Metadata`,
					value: buffer.toString()
				}
			}
		case 12:
			const poiSet = PoiLocalSet.parse(buffer, options)
			return {
				key,
				name: st0806data(key).name,
				value: poiSet,
			}
		case 18:
			klv.checkRequiredSize(key, buffer, 1)
			return {
				key,
				name: st0806data(key).name,
				value: buffer.readUInt8(0),
			}
		case 19:
			klv.checkRequiredSize(key, buffer, 3)
			return {
				key,
				name: st0806data(key).name,
				value: buffer.toString()
			}
		case 20:
			klv.checkRequiredSize(key, buffer, 3)
			return {
				key,
				name: st0806data(key).name,
				value: buffer.readUIntBE(0, 3),
				unit: 'm'
			}
		case 21:
			klv.checkRequiredSize(key, buffer, 3)
			return {
				key,
				name: st0806data(key).name,
				value: buffer.readUIntBE(0, 3),
				unit: 'm'
			}
		default:
			if (options.strict === true) {
				throw Error(`Key ${key} not found`)
			}
			return {
				key,
				name: st0806data(key).name,
				value: buffer.toString()
			}
	}
}

module.exports.keys = (key) => {
	return st0806data(key)
}

const st0806data = (key) => {
	if (typeof key === 'string') {
		key = parseInt(key)
	}
	switch (key) {
		case 1:
			return {name: 'Checksum', length: 2}
		case 2:
			return {name: 'Precision Time Stamp', length: 8}
		case 1:
			return {name: 'Checksum', length: 4}
		case 2:
			return {name: 'Precision Time Stamp', length: 8}
		case 7:
			return {name: 'Frame Code', length: 4}
		case 8:
			return {name: 'RVT LS Version Number', length: 1}
		case 9:
			return {name: 'Video Data Rate', length: 4}
		case 10:
			return {name: 'Digital Video File Format'}
		case 11:
			return {name: 'User Defined LS'}
		case 12:
			return {name: 'Point of Interest LS'}
		case 13:
			return {name: 'Area of Interest LS'}
		case 18:
			return {name: 'MGRS Zone Second Value', length: 1}
		case 19:
			return {name: 'MGRS Latitude Band and Grid Square Second Value', length: 3}
		case 20:
			return {name: 'MGRS Easting Second Value', length: 3}
		case 21:
			return {name: 'MGRS Northing Second Value', length: 3}
		default:
			return {name: 'Unknown'}
	}
}

}).call(this)}).call(this,require('_process'),require("buffer").Buffer)
},{"./PoiLocalSet":11,"./UserDefinedLocalSet":12,"./klv":13,"_process":3,"buffer":"buffer"}],18:[function(require,module,exports){
(function (process,Buffer){(function (){
const klv = require('./klv')
const vTargetSeries = require('./vTargetSeries')
const Ontology = require('./Ontology')
const AlgorithmSeries = require('./AlgorithmSeries')

module.exports.name = 'st0903'
module.exports.key = Buffer.from('060e2b34020b01010e01030306000000', 'hex')
module.exports.minSize = 31

module.exports.parse = function (buffer, options = {}) {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer

	options.debug === true && console.debug('-------Start Parse 0903-------')
	options.debug === true && process.stdout.write(`Packet ${packet.toString('hex')} ${packet.length}\n`)

	if (packet.length < module.exports.minSize) { // must have a 16 byte key, 1 byte BER, 10 byte timestamp, 4 byte checksum
		throw new Error('Buffer has no content to read')
	}

	const val = module.exports.key.compare(packet, 0, module.exports.key.length) // compare first 16 bytes before BER
	if (val !== 0) {
		throw new Error('Not ST 0903')
	}

	let {berHeader, berLength, contentLength} = klv.getBer(packet[module.exports.key.length])
	if (contentLength === null) {
		contentLength = klv.getContentLength(packet.subarray(module.exports.key.length + berHeader, module.exports.key.length + berHeader + berLength))// read content after key and length
	}

	const parsedLength = module.exports.key.length + berHeader + berLength + contentLength
	if (parsedLength > packet.length) {  // buffer length isn't long enough to read content
		throw new Error('Buffer includes ST 0903 key and BER but not content')
	}

	let i = module.exports.key.length + berHeader + berLength //index of first content key

	const values = module.exports.parseLS(buffer.slice(i, i + parsedLength), {...options, header: false})

	const checksum = values.find(klv => klv.key === 1)
	if (!klv.isChecksumValid(packet.subarray(0, parsedLength), checksum.value)) {
		throw new Error('Invalid checksum')
	}

	return values
}

module.exports.parseLS = function (buffer, options = {}) {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer

	options.debug === true && options.header !== false && console.debug('-------Start Parse 0903 LS-------')
	options.debug === true && options.header !== false && process.stdout.write(`Packet ${packet.toString('hex')} ${packet.length}\n`)

	const values = []

	let i = 0
	while (i < packet.length) {
		const key = packet[i]
		const keyLength = 1

		let {berHeader, berLength, contentLength} = klv.getBer(packet[i + keyLength])
		if (contentLength === null) {
			contentLength = klv.getContentLength(packet.subarray(i + keyLength + berHeader, i + keyLength + berHeader + berLength))// read content after key and length)
		}

		const valueBuffer = packet.subarray(i + keyLength + berHeader + berLength, i + keyLength + berHeader + berLength + contentLength) // read content after key and length

		if (packet.length < i + keyLength + berHeader + berLength + contentLength) {
			throw new Error('Invalid st0903 buffer, not enough content')
		}

		let parsed
		try {
			parsed = convert(key, valueBuffer, options)
		} catch (e) {
			console.error('Error occured',e)
		}

		if (parsed) {
			if (typeof parsed.value === 'string') parsed.value = parsed.value.replace(/[^\x20-\x7E]+/g, '')

			if (options.debug === true) {
				if (key === 2) console.debug(key, contentLength, parsed.name, `${new Date(parsed.value / 1000)}${parsed.unit || ''}`, valueBuffer)
				else console.debug(key, contentLength, parsed.name, `${parsed.value}${parsed.unit || ''}`, valueBuffer)
				parsed.packet = valueBuffer
			}

			values.push(parsed)
		}
		i += keyLength + berHeader + berLength + contentLength // advance past key, length and value bytes
	}

	return values
}

function convert(key, buffer, options) {
	try {
		switch (key) {
			case 1:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: 'Checksum',
					value: buffer.readUInt16BE(0)
				}
			case 2:
				klv.checkRequiredSize(key, buffer, 8)
				return {
					key,
					name: 'Precision Time Stamp',
					value: parseFloat(klv.readVariableUInt(buffer)),
					//value: parseFloat(buffer.readBigUInt64BE(0)),
					unit: 'µs'
				}
			case 3:
				klv.checkMaxSize(key, buffer, 128)
				return {
					key,
					name: 'VMTI System Name',
					value: buffer.toString()
				}
			case 4:
				klv.checkMaxSize(key, buffer, 2)
				return {
					key,
					name: 'VMTI Version Number',
					value: klv.readVariableUInt(buffer)
				}
			case 5:
				klv.checkMaxSize(key, buffer, 3)
				return {
					key,
					name: 'Total Number Targets Reported',
					value: klv.readVariableUInt(buffer)
				}
			case 6:
				klv.checkMaxSize(key, buffer, 3)
				return {
					key,
					name: 'Number Targets Reported',
					value: klv.readVariableUInt(buffer)
				}
			case 7:
				klv.checkMaxSize(key, buffer, 3)
				return {
					key,
					name: 'Motion Imagery Frame Num',
					value: klv.readVariableUInt(buffer)
				}
			case 8:
				klv.checkMaxSize(key, buffer, 3)
				return {
					key,
					name: 'Frame Width',
					value: klv.readVariableUInt(buffer)
				}
			case 9:
				klv.checkMaxSize(key, buffer, 3)
				return {
					key,
					name: 'Frame Height',
					value: klv.readVariableUInt(buffer)
				}
			case 10:
				klv.checkMaxSize(key, buffer, 128)
				return {
					key,
					name: 'VMTI Source Sensor',
					value: buffer.toString()
				}
			case 11:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: 'VMTI Horizontal FoV',
					value: klv.scale(buffer.readUInt16BE(0), [0, 2 ** 16], [0, 180]),
					unit: '°'
				}
			case 12:
				klv.checkRequiredSize(key, buffer, 2)
				return {
					key,
					name: 'VMTI Vertical FoV',
					value: klv.scale(buffer.readUInt16BE(0), [0, 2 ** 16], [0, 180]),
					unit: '°'
				}
			case 101:
				return {
					key,
					name: 'VTarget Series',
					value: vTargetSeries.parse(buffer, options)
				}
			case 102:
				return {
					key,
					name: 'Algorithm Series',
					value: AlgorithmSeries.parse(buffer, options)
				}
			case 103:
				return {
					key,
					name: 'Ontology Series',
					value: Ontology.parse(buffer, options)
				}
			default:
				if (options.strict === true) {
					throw Error(`st0903 key ${key} not found`)
				}
				return {
					key,
					name: 'Unknown',
					value: buffer.toString()
				}
		}
	} catch (e) {
		throw e
	}
}

}).call(this)}).call(this,require('_process'),require("buffer").Buffer)
},{"./AlgorithmSeries":6,"./Ontology":10,"./klv":13,"./vTargetSeries":22,"_process":3,"buffer":"buffer"}],19:[function(require,module,exports){
(function (process,Buffer){(function (){
const klv = require('./klv')

module.exports.parse = function (buffer, options = {}) {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer

	options.debug === true && console.debug('-------Start Parse vObject-------')
	options.debug === true && process.stdout.write(`Buffer ${buffer.toString('hex')} ${buffer.length}\n`)

	const values = []

	const keyPlusLength = 2
	let i = 0
	while (i < packet.length) {
		const key = packet[i]
		const valueLength = packet[i+1]

		if(packet.length < i + keyPlusLength + valueLength) {
			throw new Error('Invalid vObject buffer, not enough content')
		}

		const valueBuffer = packet.subarray(i + keyPlusLength, i + keyPlusLength + valueLength)
		const parsed = convert(key, valueBuffer)

		if(typeof parsed.value === 'string') parsed.value = parsed.value.replace(/[^\x20-\x7E]+/g, '')

		if (options.debug === true) {
			console.debug(key, valueLength, parsed.name, `${parsed.value}${parsed.unit || ''}`, valueBuffer)
			parsed.packet = valueBuffer
		}

		values.push(parsed)

		i += keyPlusLength + valueLength // advance past key, length and value bytes
	}
	options.debug === true && console.debug('-------End Parse vObject---------')
	return values
}

function convert(key, buffer) {
	try {
		switch (key) {
			case 1:
				return {
					key,
					name: 'Ontology',
					value: buffer.toString()
				}
			case 2:
				return {
					key,
					name: 'Ontology Class',
					value: buffer.toString()
				}
			case 3:
				klv.checkMaxSize(key, buffer, 3)
				return {
					key,
					name: 'Ontology ID',
					value: klv.readVariableUInt(buffer)
				}
			case 4: // todo this is not correct
				klv.checkMaxSize(key, buffer, 6)
				return {
					key,
					name: 'Confidence',
					value: klv.readVariableUInt(buffer)
				}
			default:
				throw Error(`Key ${key} not found`)
		}
	} catch (e) {
		throw e
	}
}

}).call(this)}).call(this,require('_process'),require("buffer").Buffer)
},{"./klv":13,"_process":3,"buffer":"buffer"}],20:[function(require,module,exports){
(function (process,Buffer){(function (){
const vObject = require('./vObject')

module.exports.parse = function (buffer, options = {}) {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer
	const values = []

	options.debug === true && console.debug('-------Start Parse vObjectSeries-------')
	options.debug === true && process.stdout.write(`Buffer ${buffer.toString('hex')} ${buffer.length}\n`)

	const berLength = 1
	let i = 0
	while (i < packet.length) {
		const contentLength = packet[i]

		if (packet.length < i + berLength + contentLength) {
			throw new Error('Invalid vObjectSeries buffer, not enough content')
		}

		const vObj = vObject.parse(packet.subarray(i + berLength, i + berLength + contentLength))
		values.push(vObj)
		options.debug === true && console.debug('vObject', contentLength, vObj)

		i += berLength + contentLength
	}
	options.debug === true && console.debug('-------End Parse vObjectSeries---------')
	return values
}

}).call(this)}).call(this,require('_process'),require("buffer").Buffer)
},{"./vObject":19,"_process":3,"buffer":"buffer"}],21:[function(require,module,exports){
(function (process,Buffer){(function (){
const klv = require('./klv')
const Location = require('./Location')
const vObject = require('./vObject')
const vObjectSeries = require('./vObjectSeries')
const vTracker = require('./vTracker')

module.exports.parse = function (buffer, options = {}) {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer

	options.debug === true && console.debug('-------Start Parse vTarget Pack-------')
	options.debug === true && process.stdout.write(`Buffer ${buffer.toString('hex')} ${buffer.length}\n`)

	const values = []

	let i = 0
	let targetId = 0
	let read
	do {
		read = packet[i]
		const highBits = targetId << 7
		const lowBits = read & 0x7F
		targetId = highBits + lowBits
		i++
	} while (read >>> 7 === 1)

	values.push({
		key: 0,
		name: 'Target ID',
		value: targetId
	})

	options.debug === true && console.debug('Target', targetId)

	while (i < packet.length) {
		const key = packet[i]
		const length = packet[i+1]

		if(packet.length < i + 2 + length) {
			throw new Error('Invalid vTargetPack buffer, not enough content')
		}

		const valueBuffer = packet.subarray(i + 2, i + 2 + length)
		const parsed = convert(key, valueBuffer, options)


		if(typeof parsed.value === 'string') parsed.value = parsed.value.replace(/[^\x20-\x7E]+/g, '')

		if (options.debug === true) {
			console.debug(key, length, parsed.name, `${parsed.value}${parsed.unit || ''}`, valueBuffer)
			parsed.packet = valueBuffer
		}

		values.push(parsed)

		i += 1 + 1 + length // advance past key, length and value bytes
	}
	options.debug === true && console.debug('-------End Parse vTarget Pack---------')
	return values
}

function convert(key, buffer, options) {
	try {
		switch (key) {
			case 1:
				klv.checkMaxSize(key, buffer, 6)
				return {
					key,
					name: 'Target Centroid',
					value: klv.readVariableUInt(buffer)
				}
			case 2:
				klv.checkMaxSize(key, buffer, 6)
				return {
					key,
					name: 'Boundary Top Left',
					value: klv.readVariableUInt(buffer)
				}
			case 3:
				klv.checkMaxSize(key, buffer, 6)
				return {
					key,
					name: 'Boundary Bottom Right',
					value: klv.readVariableUInt(buffer)
				}
			case 5:
				klv.checkMaxSize(key, buffer, 6)
				return {
					key,
					name: 'Target Confidence Level',
					value: buffer.readUInt8(0)
				}
			case 6:
				klv.checkMaxSize(key, buffer, 6)
				return {
					key,
					name: 'Target History',
					value: klv.readVariableUInt(buffer)
				}
			case 17:
				klv.checkRequiredSize(key, buffer, 22)
				return {
					key,
					name: 'Target Location',
					value: Location.parse(buffer, options)
				}
			case 19:
				klv.checkMaxSize(key, buffer, 4)
				return {
					key,
					name: 'Centroid Pix Row',
					value: klv.readVariableUInt(buffer)
				}
			case 20:
				klv.checkMaxSize(key, buffer, 4)
				return {
					key,
					name: 'Centroid Pix Col',
					value: klv.readVariableUInt(buffer)
				}
			case 22:
				klv.checkMaxSize(key, buffer, 4)
				return {
					key,
					name: 'Algorithm ID',
					value: klv.readVariableUInt(buffer)
				}
			case 102:
				return {
					key,
					name: 'VObject',
					value: vObject.parse(buffer, options)
				}
			case 104:
				return {
					key,
					name: 'VTracker',
					value: vTracker.parse(buffer, options)
				}
			case 107:
				return {
					key,
					name: 'vObjectSeries',
					value: vObjectSeries.parse(buffer, options)
				}
			default:
				if (options.debug === true) {
					throw Error(`vTargetPack key ${key} not found`)
				}
				return {
					key,
					name: 'Unknown',
					value: buffer.toString()
				}
		}
	} catch (e) {
		throw e
	}
}

}).call(this)}).call(this,require('_process'),require("buffer").Buffer)
},{"./Location":9,"./klv":13,"./vObject":19,"./vObjectSeries":20,"./vTracker":23,"_process":3,"buffer":"buffer"}],22:[function(require,module,exports){
(function (process,Buffer){(function (){
const klv = require('./klv')
const vTargetPack = require('./vTargetPack')

module.exports.parse = function (buffer, options = {}) {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer

	options.debug === true && console.debug('-------Start Parse vTarget Series-------')
	options.debug === true && process.stdout.write(`Buffer ${buffer.toString('hex')} ${buffer.length}\n`)

	const values = []

	let i = 0
	while (i < packet.length) {
		let {berHeader, berLength, contentLength} = klv.getBer(packet[i])
		if (contentLength === null) {
			contentLength = klv.getContentLength(packet.subarray(i + berHeader, i + berHeader + berLength)) // read content after key and length)
		}

		const valueBuffer = packet.subarray(i + berHeader + berLength, i + berHeader + berLength + contentLength) // read content after key and length
		const parsed = vTargetPack.parse(valueBuffer, options)

		if (options.debug === true) {
			//console.debug('VTarget Pack', length, value, valueBuffer)
			parsed.packet = valueBuffer
		}
		values.push(parsed)

		i += berHeader + berLength + contentLength // advance past length and value bytes
	}
	options.debug === true && console.debug('-------End Parse vTarget Series---------')
	return values
}

}).call(this)}).call(this,require('_process'),require("buffer").Buffer)
},{"./klv":13,"./vTargetPack":21,"_process":3,"buffer":"buffer"}],23:[function(require,module,exports){
(function (process,Buffer){(function (){
const klv = require('./klv')

module.exports.parse = function (buffer, options = {}) {
	const packet = typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer

	options.debug === true && console.debug('-------Start Parse vTracker-------')
	options.debug === true && process.stdout.write(`Buffer ${buffer.toString('hex')} ${buffer.length}\n`)

	const values = []

	let i = 0
	const berHeader = 1
	const berLength = 1
	while (i < packet.length) {
		const key = packet[i]
		const contentLength = packet[i + berLength]

		if (packet.length < i + berHeader + berLength + contentLength) {
			throw new Error('Invalid vTracker buffer, not enough content')
		}

		const valueBuffer = packet.subarray(i + berHeader + berLength, i + berHeader + berLength + contentLength)
		const parsed = convert(key, valueBuffer)

		if(typeof parsed.value === 'string') parsed.value = parsed.value.replace(/[^\x20-\x7E]+/g, '')

		if (options.debug === true) {
			console.debug(key, contentLength, parsed.name, `${parsed.value}${parsed.unit || ''}`, valueBuffer)
			parsed.packet = valueBuffer
		}

		values.push(parsed)

		i += berHeader + berLength + contentLength // advance past key, length and value bytes
	}
	options.debug === true && console.debug('-------End Parse vTracker---------')
	return values
}

function convert(key, buffer) {
	try {
		switch (key) {
			case 1:
				klv.checkRequiredSize(key, buffer, 16)
				return {
					key,
					name: 'Track ID',
					value: klv.readVariableUInt(buffer)
				}
			case 3:
				klv.checkRequiredSize(key, buffer, 8)
				return {
					key,
					name: 'Start Time',
					value: parseFloat(buffer.readBigUInt64BE(0)),
					unit: 'µs'
				}
			case 4:
				klv.checkRequiredSize(key, buffer, 8)
				return {
					key,
					name: 'End Time',
					value: parseFloat(buffer.readBigUInt64BE(0)),
					unit: 'µs'
				}
			case 9:
				return {
					key,
					name: 'TrackHistorySeries', // todo implement
					value: buffer.toString()
				}
			case 10:
				return {
					key,
					name: 'Velocity', // todo implement
					value: buffer.toString()
				}
			default:
				throw Error(`Key ${key} not found`)
		}
	} catch (e) {
		throw e
	}
}

}).call(this)}).call(this,require('_process'),require("buffer").Buffer)
},{"./klv":13,"_process":3,"buffer":"buffer"}],24:[function(require,module,exports){
arguments[4][1][0].apply(exports,arguments)
},{"dup":1}],25:[function(require,module,exports){
(function (Buffer){(function (){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

const base64 = require('base64-js')
const ieee754 = require('ieee754')
const customInspectSymbol =
  (typeof Symbol === 'function' && typeof Symbol['for'] === 'function') // eslint-disable-line dot-notation
    ? Symbol['for']('nodejs.util.inspect.custom') // eslint-disable-line dot-notation
    : null

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

const K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    const arr = new Uint8Array(1)
    const proto = { foo: function () { return 42 } }
    Object.setPrototypeOf(proto, Uint8Array.prototype)
    Object.setPrototypeOf(arr, proto)
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  const buf = new Uint8Array(length)
  Object.setPrototypeOf(buf, Buffer.prototype)
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayView(value)
  }

  if (value == null) {
    throw new TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof SharedArrayBuffer !== 'undefined' &&
      (isInstance(value, SharedArrayBuffer) ||
      (value && isInstance(value.buffer, SharedArrayBuffer)))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  const valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  const b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(value[Symbol.toPrimitive]('string'), encodingOrOffset, length)
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype)
Object.setPrototypeOf(Buffer, Uint8Array)

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpreted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  const length = byteLength(string, encoding) | 0
  let buf = createBuffer(length)

  const actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  const length = array.length < 0 ? 0 : checked(array.length) | 0
  const buf = createBuffer(length)
  for (let i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayView (arrayView) {
  if (isInstance(arrayView, Uint8Array)) {
    const copy = new Uint8Array(arrayView)
    return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength)
  }
  return fromArrayLike(arrayView)
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  let buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(buf, Buffer.prototype)

  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    const len = checked(obj.length) | 0
    const buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  let x = a.length
  let y = b.length

  for (let i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  let i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  const buffer = Buffer.allocUnsafe(length)
  let pos = 0
  for (i = 0; i < list.length; ++i) {
    let buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      if (pos + buf.length > buffer.length) {
        if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf)
        buf.copy(buffer, pos)
      } else {
        Uint8Array.prototype.set.call(
          buffer,
          buf,
          pos
        )
      }
    } else if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    } else {
      buf.copy(buffer, pos)
    }
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  const len = string.length
  const mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  let loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  let loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coercion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  const i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  const len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (let i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  const len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (let i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  const len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (let i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  const length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  let str = ''
  const max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}
if (customInspectSymbol) {
  Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  let x = thisEnd - thisStart
  let y = end - start
  const len = Math.min(x, y)

  const thisCopy = this.slice(thisStart, thisEnd)
  const targetCopy = target.slice(start, end)

  for (let i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  let indexSize = 1
  let arrLength = arr.length
  let valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  let i
  if (dir) {
    let foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      let found = true
      for (let j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  const remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  const strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  let i
  for (i = 0; i < length; ++i) {
    const parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  const remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  let loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
      case 'latin1':
      case 'binary':
        return asciiWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  const res = []

  let i = start
  while (i < end) {
    const firstByte = buf[i]
    let codePoint = null
    let bytesPerSequence = (firstByte > 0xEF)
      ? 4
      : (firstByte > 0xDF)
          ? 3
          : (firstByte > 0xBF)
              ? 2
              : 1

    if (i + bytesPerSequence <= end) {
      let secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
const MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  const len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  let res = ''
  let i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  let ret = ''
  end = Math.min(buf.length, end)

  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  let ret = ''
  end = Math.min(buf.length, end)

  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  const len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  let out = ''
  for (let i = start; i < end; ++i) {
    out += hexSliceLookupTable[buf[i]]
  }
  return out
}

function utf16leSlice (buf, start, end) {
  const bytes = buf.slice(start, end)
  let res = ''
  // If bytes.length is odd, the last 8 bits must be ignored (same as node.js)
  for (let i = 0; i < bytes.length - 1; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  const len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  const newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(newBuf, Buffer.prototype)

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUintLE =
Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  let val = this[offset]
  let mul = 1
  let i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUintBE =
Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  let val = this[offset + --byteLength]
  let mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUint8 =
Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUint16LE =
Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUint16BE =
Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUint32LE =
Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUint32BE =
Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE (offset) {
  offset = offset >>> 0
  validateNumber(offset, 'offset')
  const first = this[offset]
  const last = this[offset + 7]
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8)
  }

  const lo = first +
    this[++offset] * 2 ** 8 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 24

  const hi = this[++offset] +
    this[++offset] * 2 ** 8 +
    this[++offset] * 2 ** 16 +
    last * 2 ** 24

  return BigInt(lo) + (BigInt(hi) << BigInt(32))
})

Buffer.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE (offset) {
  offset = offset >>> 0
  validateNumber(offset, 'offset')
  const first = this[offset]
  const last = this[offset + 7]
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8)
  }

  const hi = first * 2 ** 24 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    this[++offset]

  const lo = this[++offset] * 2 ** 24 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    last

  return (BigInt(hi) << BigInt(32)) + BigInt(lo)
})

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  let val = this[offset]
  let mul = 1
  let i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  let i = byteLength
  let mul = 1
  let val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  const val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  const val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE (offset) {
  offset = offset >>> 0
  validateNumber(offset, 'offset')
  const first = this[offset]
  const last = this[offset + 7]
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8)
  }

  const val = this[offset + 4] +
    this[offset + 5] * 2 ** 8 +
    this[offset + 6] * 2 ** 16 +
    (last << 24) // Overflow

  return (BigInt(val) << BigInt(32)) +
    BigInt(first +
    this[++offset] * 2 ** 8 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 24)
})

Buffer.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE (offset) {
  offset = offset >>> 0
  validateNumber(offset, 'offset')
  const first = this[offset]
  const last = this[offset + 7]
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8)
  }

  const val = (first << 24) + // Overflow
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    this[++offset]

  return (BigInt(val) << BigInt(32)) +
    BigInt(this[++offset] * 2 ** 24 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    last)
})

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUintLE =
Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    const maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  let mul = 1
  let i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUintBE =
Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    const maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  let i = byteLength - 1
  let mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUint8 =
Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUint16LE =
Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUint16BE =
Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUint32LE =
Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUint32BE =
Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function wrtBigUInt64LE (buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7)

  let lo = Number(value & BigInt(0xffffffff))
  buf[offset++] = lo
  lo = lo >> 8
  buf[offset++] = lo
  lo = lo >> 8
  buf[offset++] = lo
  lo = lo >> 8
  buf[offset++] = lo
  let hi = Number(value >> BigInt(32) & BigInt(0xffffffff))
  buf[offset++] = hi
  hi = hi >> 8
  buf[offset++] = hi
  hi = hi >> 8
  buf[offset++] = hi
  hi = hi >> 8
  buf[offset++] = hi
  return offset
}

function wrtBigUInt64BE (buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7)

  let lo = Number(value & BigInt(0xffffffff))
  buf[offset + 7] = lo
  lo = lo >> 8
  buf[offset + 6] = lo
  lo = lo >> 8
  buf[offset + 5] = lo
  lo = lo >> 8
  buf[offset + 4] = lo
  let hi = Number(value >> BigInt(32) & BigInt(0xffffffff))
  buf[offset + 3] = hi
  hi = hi >> 8
  buf[offset + 2] = hi
  hi = hi >> 8
  buf[offset + 1] = hi
  hi = hi >> 8
  buf[offset] = hi
  return offset + 8
}

Buffer.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE (value, offset = 0) {
  return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt('0xffffffffffffffff'))
})

Buffer.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE (value, offset = 0) {
  return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt('0xffffffffffffffff'))
})

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    const limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  let i = 0
  let mul = 1
  let sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    const limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  let i = byteLength - 1
  let mul = 1
  let sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE (value, offset = 0) {
  return wrtBigUInt64LE(this, value, offset, -BigInt('0x8000000000000000'), BigInt('0x7fffffffffffffff'))
})

Buffer.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE (value, offset = 0) {
  return wrtBigUInt64BE(this, value, offset, -BigInt('0x8000000000000000'), BigInt('0x7fffffffffffffff'))
})

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  const len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      const code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  } else if (typeof val === 'boolean') {
    val = Number(val)
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  let i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    const bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    const len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// CUSTOM ERRORS
// =============

// Simplified versions from Node, changed for Buffer-only usage
const errors = {}
function E (sym, getMessage, Base) {
  errors[sym] = class NodeError extends Base {
    constructor () {
      super()

      Object.defineProperty(this, 'message', {
        value: getMessage.apply(this, arguments),
        writable: true,
        configurable: true
      })

      // Add the error code to the name to include it in the stack trace.
      this.name = `${this.name} [${sym}]`
      // Access the stack to generate the error message including the error code
      // from the name.
      this.stack // eslint-disable-line no-unused-expressions
      // Reset the name to the actual name.
      delete this.name
    }

    get code () {
      return sym
    }

    set code (value) {
      Object.defineProperty(this, 'code', {
        configurable: true,
        enumerable: true,
        value,
        writable: true
      })
    }

    toString () {
      return `${this.name} [${sym}]: ${this.message}`
    }
  }
}

E('ERR_BUFFER_OUT_OF_BOUNDS',
  function (name) {
    if (name) {
      return `${name} is outside of buffer bounds`
    }

    return 'Attempt to access memory outside buffer bounds'
  }, RangeError)
E('ERR_INVALID_ARG_TYPE',
  function (name, actual) {
    return `The "${name}" argument must be of type number. Received type ${typeof actual}`
  }, TypeError)
E('ERR_OUT_OF_RANGE',
  function (str, range, input) {
    let msg = `The value of "${str}" is out of range.`
    let received = input
    if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
      received = addNumericalSeparator(String(input))
    } else if (typeof input === 'bigint') {
      received = String(input)
      if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
        received = addNumericalSeparator(received)
      }
      received += 'n'
    }
    msg += ` It must be ${range}. Received ${received}`
    return msg
  }, RangeError)

function addNumericalSeparator (val) {
  let res = ''
  let i = val.length
  const start = val[0] === '-' ? 1 : 0
  for (; i >= start + 4; i -= 3) {
    res = `_${val.slice(i - 3, i)}${res}`
  }
  return `${val.slice(0, i)}${res}`
}

// CHECK FUNCTIONS
// ===============

function checkBounds (buf, offset, byteLength) {
  validateNumber(offset, 'offset')
  if (buf[offset] === undefined || buf[offset + byteLength] === undefined) {
    boundsError(offset, buf.length - (byteLength + 1))
  }
}

function checkIntBI (value, min, max, buf, offset, byteLength) {
  if (value > max || value < min) {
    const n = typeof min === 'bigint' ? 'n' : ''
    let range
    if (byteLength > 3) {
      if (min === 0 || min === BigInt(0)) {
        range = `>= 0${n} and < 2${n} ** ${(byteLength + 1) * 8}${n}`
      } else {
        range = `>= -(2${n} ** ${(byteLength + 1) * 8 - 1}${n}) and < 2 ** ` +
                `${(byteLength + 1) * 8 - 1}${n}`
      }
    } else {
      range = `>= ${min}${n} and <= ${max}${n}`
    }
    throw new errors.ERR_OUT_OF_RANGE('value', range, value)
  }
  checkBounds(buf, offset, byteLength)
}

function validateNumber (value, name) {
  if (typeof value !== 'number') {
    throw new errors.ERR_INVALID_ARG_TYPE(name, 'number', value)
  }
}

function boundsError (value, length, type) {
  if (Math.floor(value) !== value) {
    validateNumber(value, type)
    throw new errors.ERR_OUT_OF_RANGE(type || 'offset', 'an integer', value)
  }

  if (length < 0) {
    throw new errors.ERR_BUFFER_OUT_OF_BOUNDS()
  }

  throw new errors.ERR_OUT_OF_RANGE(type || 'offset',
                                    `>= ${type ? 1 : 0} and <= ${length}`,
                                    value)
}

// HELPER FUNCTIONS
// ================

const INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  let codePoint
  const length = string.length
  let leadSurrogate = null
  const bytes = []

  for (let i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  const byteArray = []
  for (let i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  let c, hi, lo
  const byteArray = []
  for (let i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  let i
  for (i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

// Create lookup table for `toString('hex')`
// See: https://github.com/feross/buffer/issues/219
const hexSliceLookupTable = (function () {
  const alphabet = '0123456789abcdef'
  const table = new Array(256)
  for (let i = 0; i < 16; ++i) {
    const i16 = i * 16
    for (let j = 0; j < 16; ++j) {
      table[i16 + j] = alphabet[i] + alphabet[j]
    }
  }
  return table
})()

// Return not function with Error if BigInt not supported
function defineBigIntMethod (fn) {
  return typeof BigInt === 'undefined' ? BufferBigIntNotDefined : fn
}

function BufferBigIntNotDefined () {
  throw new Error('BigInt not supported')
}

}).call(this)}).call(this,require("buffer").Buffer)
},{"base64-js":24,"buffer":"buffer","ieee754":26}],26:[function(require,module,exports){
arguments[4][2][0].apply(exports,arguments)
},{"dup":2}],"buffer":[function(require,module,exports){
(function (Buffer){(function (){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this)}).call(this,require("buffer").Buffer)
},{"base64-js":1,"buffer":"buffer","ieee754":2}]},{},[4]);
