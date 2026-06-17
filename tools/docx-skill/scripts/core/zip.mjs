/**
 * Minimal ZIP reader/writer for docx files.
 * Zero npm dependencies — uses only Node.js built-ins (zlib, fs, buffer).
 *
 * ZIP format reference: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
 *
 * Only supports DEFLATE (method 8) and STORE (method 0).
 * Only supports single-disk archives (no ZIP64).
 */

import { inflateRawSync, deflateRawSync } from 'node:zlib';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// ── CRC32 (pure JS) ────────────────────────────────────────────────────────

const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[i] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SIG_LOCAL   = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD    = 0x06054b50;
const SIG_DIGITAL = 0x05054b50;

const METHOD_DEFLATE = 8;
const METHOD_STORE   = 0;

// ── ZipFile class ──────────────────────────────────────────────────────────

export class ZipFile {
  constructor() {
    /** Map<normalizedPath, Entry> */
    this._entries = new Map();
  }

  /**
   * Get a file entry (1 arg) or set a file (2 args). JSZip compat.
   *
   * Getter: file(path) → { async(type) } or null
   * Setter: file(path, content) → this
   */
  file(path, content) {
    if (arguments.length === 2) {
      // ── Setter ──
      const npath = normalize(path);
      const buf = typeof content === 'string' ? Buffer.from(content, 'utf-8')
                 : Buffer.isBuffer(content) ? content
                 : Buffer.from(content);
      this._entries.set(npath, {
        data: buf,
        dir: false,
        uncompressedSize: buf.length,
        crc32: crc32(buf),
        method: METHOD_DEFLATE,
        localOffset: 0,
      });
      return this;
    }
    // ── Getter ──
    const entry = this._entries.get(normalize(path));
    if (!entry || entry.dir) return null;
    return {
      async: (type) => {
        if (type === 'string')     return Promise.resolve(entry.data.toString('utf-8'));
        if (type === 'nodebuffer') return Promise.resolve(entry.data);
        if (type === 'uint8array') return Promise.resolve(new Uint8Array(entry.data));
        return Promise.resolve(entry.data);
      },
    };
  }

  /**
   * Remove a file (JSZip compat).
   */
  remove(path) {
    this._entries.delete(normalize(path));
  }

  /**
   * Expose as plain object for Object.keys() / bracket access.
   */
  get files() {
    const obj = {};
    for (const [path, entry] of this._entries) {
      obj[path] = { dir: entry.dir };
    }
    return obj;
  }

  /**
   * Generate ZIP buffer (JSZip compat).
   */
  async generateAsync(options = {}) {
    const compLevel = (options.compressionOptions && options.compressionOptions.level) || 6;
    return this._buildBuffer(compLevel);
  }

  // ── Internal: build ZIP binary ───────────────────────────────────────────

  _buildBuffer(compLevel) {
    const sorted = [...this._entries.entries()].filter(([, e]) => !e.dir);
    if (sorted.length === 0) {
      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(SIG_EOCD, 0);
      eocd.writeUInt16LE(0, 4);
      eocd.writeUInt16LE(0, 6);
      eocd.writeUInt16LE(0, 8);
      eocd.writeUInt16LE(0, 10);
      eocd.writeUInt32LE(0, 12);
      eocd.writeUInt32LE(0, 16);
      eocd.writeUInt16LE(0, 20);
      return eocd;
    }

    // First pass: compress, compute sizes
    const items = [];
    let offset = 0;

    for (const [path, entry] of sorted) {
      const nameBuf = Buffer.from(path, 'utf-8');
      const data   = entry.data;
      const crc    = entry.crc32;
      const uncomp = data.length;

      let compressed;
      if (entry.method === METHOD_DEFLATE) {
        compressed = deflateRawSync(data, { level: compLevel });
      } else {
        compressed = data;
      }
      const comp = compressed.length;
      const method = entry.method === METHOD_DEFLATE ? 8 : 0;

      items.push({ offset, nameBuf, compressed, crc, comp, uncomp, method });
      offset += 30 + nameBuf.length + comp;
    }

    // Second pass: assemble buffer
    const cdOffset = offset;
    let cdSize = 0;
    for (const it of items) cdSize += 46 + it.nameBuf.length;

    const total = cdOffset + cdSize + 22;
    const out = Buffer.alloc(total);
    let pos = 0;

    // ── Local file headers + data ──
    for (const it of items) {
      out.writeUInt32LE(SIG_LOCAL, pos); pos += 4;
      out.writeUInt16LE(20, pos);  pos += 2;  // version needed
      out.writeUInt16LE(0, pos);   pos += 2;  // bit flag
      out.writeUInt16LE(it.method, pos); pos += 2;
      out.writeUInt16LE(0, pos);   pos += 2;  // mod time
      out.writeUInt16LE(0, pos);   pos += 2;  // mod date
      out.writeUInt32LE(it.crc, pos);  pos += 4;
      out.writeUInt32LE(it.comp, pos); pos += 4;
      out.writeUInt32LE(it.uncomp, pos); pos += 4;
      out.writeUInt16LE(it.nameBuf.length, pos); pos += 2;
      out.writeUInt16LE(0, pos);   pos += 2;  // extra field length
      it.nameBuf.copy(out, pos);   pos += it.nameBuf.length;
      it.compressed.copy(out, pos); pos += it.compressed.length;
    }

    // ── Central directory ──
    for (const it of items) {
      out.writeUInt32LE(SIG_CENTRAL, pos); pos += 4;
      out.writeUInt16LE(20, pos);  pos += 2;  // version made by
      out.writeUInt16LE(20, pos);  pos += 2;  // version needed
      out.writeUInt16LE(0, pos);   pos += 2;  // bit flag
      out.writeUInt16LE(it.method, pos); pos += 2;
      out.writeUInt16LE(0, pos);   pos += 2;  // mod time
      out.writeUInt16LE(0, pos);   pos += 2;  // mod date
      out.writeUInt32LE(it.crc, pos);  pos += 4;
      out.writeUInt32LE(it.comp, pos); pos += 4;
      out.writeUInt32LE(it.uncomp, pos); pos += 4;
      out.writeUInt16LE(it.nameBuf.length, pos); pos += 2;
      out.writeUInt16LE(0, pos);   pos += 2;  // extra field length
      out.writeUInt16LE(0, pos);   pos += 2;  // comment length
      out.writeUInt16LE(0, pos);   pos += 2;  // disk number start
      out.writeUInt16LE(0, pos);   pos += 2;  // internal file attrs
      out.writeUInt32LE(0, pos);   pos += 4;  // external file attrs
      out.writeUInt32LE(it.offset, pos); pos += 4;
      it.nameBuf.copy(out, pos);   pos += it.nameBuf.length;
    }

    // ── End of Central Directory ──
    out.writeUInt32LE(SIG_EOCD, pos); pos += 4;
    out.writeUInt16LE(0, pos);  pos += 2;   // disk number
    out.writeUInt16LE(0, pos);  pos += 2;   // disk with CD
    out.writeUInt16LE(items.length, pos); pos += 2;
    out.writeUInt16LE(items.length, pos); pos += 2;
    out.writeUInt32LE(cdSize, pos); pos += 4;
    out.writeUInt32LE(cdOffset, pos); pos += 4;
    out.writeUInt16LE(0, pos);  pos += 2;   // comment length

    return out;
  }
}

// ── Parse ZIP ──────────────────────────────────────────────────────────────

function normalize(p) {
  return p.replace(/\\/g, '/').replace(/^\/+/, '');
}

function readU16(buf, off) { return buf.readUInt16LE(off); }
function readU32(buf, off) { return buf.readUInt32LE(off); }

function findEOCD(buf) {
  const searchStart = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= searchStart; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  }
  return -1;
}

function findLocalDataOffset(buf, localOff) {
  if (buf.readUInt32LE(localOff) !== SIG_LOCAL) {
    throw new Error(`ZIP: Invalid local file header at ${localOff}`);
  }
  const nameLen  = readU16(buf, localOff + 26);
  const extraLen = readU16(buf, localOff + 28);
  return localOff + 30 + nameLen + extraLen;
}

function parseZip(buf) {
  const eocdOff = findEOCD(buf);
  if (eocdOff < 0) throw new Error('ZIP: End of Central Directory not found');

  const cdTotal   = readU16(buf, eocdOff + 10);
  const cdSize    = readU32(buf, eocdOff + 12);
  const cdOffset  = readU32(buf, eocdOff + 16);

  if (cdTotal === 0xFFFF) {
    throw new Error('ZIP: ZIP64 format not supported');
  }

  const zip = new ZipFile();
  let cdPos = cdOffset;

  for (let i = 0; i < cdTotal; i++) {
    if (cdPos + 46 > buf.length) break;
    const sig = buf.readUInt32LE(cdPos);
    if (sig !== SIG_CENTRAL) {
      if (sig === SIG_DIGITAL) break;
      // Some ZIPs have extra data after entries — skip gracefully
      if (sig === 0) continue;
      throw new Error(`ZIP: Bad central dir signature at ${cdPos}`);
    }

    const method     = readU16(buf, cdPos + 10);
    const crc        = readU32(buf, cdPos + 16);
    const compSize   = readU32(buf, cdPos + 20);
    const uncompSize = readU32(buf, cdPos + 24);
    const nameLen    = readU16(buf, cdPos + 28);
    const extraLen   = readU16(buf, cdPos + 30);
    const commentLen = readU16(buf, cdPos + 32);
    const localOff   = readU32(buf, cdPos + 42);

    const name = buf.slice(cdPos + 46, cdPos + 46 + nameLen).toString('utf-8');

    cdPos += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith('/')) {
      zip._entries.set(normalize(name), {
        data: null, dir: true,
        compressedSize: 0, uncompressedSize: 0, crc32: 0, method: 0, localOffset: localOff,
      });
      continue;
    }

    // Read file data from local header
    const dataOff = findLocalDataOffset(buf, localOff);
    const raw = buf.slice(dataOff, dataOff + compSize);
    const data = method === METHOD_STORE ? raw
                : method === METHOD_DEFLATE ? inflateRawSync(raw)
                : (() => { throw new Error(`ZIP: unsupported method ${method} for "${name}"`); })();

    zip._entries.set(normalize(name), {
      data, dir: false,
      compressedSize: compSize, uncompressedSize: data.length,
      crc32: crc, method, localOffset: localOff,
    });
  }

  return zip;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Load a .docx file from path or Buffer.
 * Returns a ZipFile instance (JSZip-compatible API).
 */
export async function loadDocx(input) {
  let buf;
  if (Buffer.isBuffer(input)) {
    buf = input;
  } else if (input instanceof Uint8Array) {
    buf = Buffer.from(input);
  } else if (typeof input === 'string') {
    buf = await readFile(input);
  } else if (input && typeof input.arrayBuffer === 'function') {
    buf = Buffer.from(await input.arrayBuffer());
  } else {
    throw new TypeError('loadDocx: input must be Buffer/Uint8Array/path/Blob');
  }
  return parseZip(buf);
}

/**
 * Save a ZipFile to disk or return as Buffer.
 */
export async function saveDocx(zip, outPath) {
  const buf = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  if (outPath) {
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, buf);
  }
  return buf;
}

/**
 * Read a file's text content from the ZIP.
 */
export async function readText(zip, path) {
  const f = zip.file(normalize(path));
  return f ? await f.async('string') : null;
}

/**
 * Write text into the ZIP (adds/replaces).
 */
export function writeText(zip, path, content) {
  zip.file(normalize(path), content);
  return zip;
}

/**
 * Remove a file from the ZIP.
 */
export function removeFile(zip, path) {
  if (zip.file(normalize(path))) zip.remove(path);
}

/**
 * List all non-directory entries.
 */
export function listFiles(zip) {
  return Object.keys(zip.files).filter((p) => !zip.files[p].dir);
}
