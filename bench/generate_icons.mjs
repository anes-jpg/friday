import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  table[i] = c >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk("IHDR", ihdrData);

  // Raw image scanlines: filter byte (0) + width * 4 bytes
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const r = width * 0.42;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r) {
        // FRIDAY Acid Green: rgb(46, 230, 140)
        const alpha = Math.min(255, Math.max(0, Math.round((1 - (dist / r) * 0.3) * 255)));
        rawData[pxOffset] = 46;      // R
        rawData[pxOffset + 1] = 230;  // G
        rawData[pxOffset + 2] = 140;  // B
        rawData[pxOffset + 3] = alpha;// A
      } else {
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk("IDAT", compressed);
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeIco(png32, png256) {
  // ICO with 2 PNG images: 32x32 and 256x256
  const numImages = 2;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(numImages, 4);

  const dir32 = Buffer.alloc(16);
  dir32.writeUInt8(32, 0); // width
  dir32.writeUInt8(32, 1); // height
  dir32.writeUInt8(0, 2);  // color count
  dir32.writeUInt8(0, 3);  // reserved
  dir32.writeUInt16LE(1, 4); // planes
  dir32.writeUInt16LE(32, 6); // bit count
  dir32.writeUInt32LE(png32.length, 8); // size
  const offset32 = 6 + 16 * numImages;
  dir32.writeUInt32LE(offset32, 12);

  const dir256 = Buffer.alloc(16);
  dir256.writeUInt8(0, 0); // 256 represented as 0
  dir256.writeUInt8(0, 1);
  dir256.writeUInt8(0, 2);
  dir256.writeUInt8(0, 3);
  dir256.writeUInt16LE(1, 4);
  dir256.writeUInt16LE(32, 6);
  dir256.writeUInt32LE(png256.length, 8);
  const offset256 = offset32 + png32.length;
  dir256.writeUInt32LE(offset256, 12);

  return Buffer.concat([header, dir32, dir256, png32, png256]);
}

const iconsDir = path.resolve("src-tauri", "icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const png32 = makePng(32, 32);
const png128 = makePng(128, 128);
const png256 = makePng(256, 256);
const ico = makeIco(png32, png256);

fs.writeFileSync(path.join(iconsDir, "32x32.png"), png32);
fs.writeFileSync(path.join(iconsDir, "128x128.png"), png128);
fs.writeFileSync(path.join(iconsDir, "128x128@2x.png"), png256);
fs.writeFileSync(path.join(iconsDir, "icon.ico"), ico);
fs.writeFileSync(path.join(iconsDir, "icon.icns"), png256); // Fallback stub for Mac if needed

console.log("Successfully generated all required FRIDAY app icons in src-tauri/icons");
