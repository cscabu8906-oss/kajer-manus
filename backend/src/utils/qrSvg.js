// Zero-dependency ISO-18004 QR Code SVG generator (Byte mode, EC Level M, Versions 1-10)
// Used locally on backend so TOTP otpauth:// secrets never leave the server to third-party QR APIs.

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsComputeEc(data, ecLen) {
  const gen = rsGeneratorPoly(ecLen);
  const res = new Uint8Array(data.length + ecLen);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return Array.from(res.slice(data.length));
}

// Version 1..10 tables for Error Correction Level M:
// [totalCodewords, ecPerBlock, [[groupCount, dataCodewords], ...], alignmentCenters]
const VERSION_M_TABLE = {
  1: [26, 10, [[1, 16]], []],
  2: [44, 16, [[1, 28]], [6, 18]],
  3: [70, 26, [[1, 44]], [6, 22]],
  4: [100, 18, [[2, 32]], [6, 26]],
  5: [134, 24, [[2, 43]], [6, 30]],
  6: [172, 16, [[4, 27]], [6, 34]],
  7: [196, 18, [[4, 31]], [6, 22, 38]],
  8: [242, 22, [[2, 38], [2, 39]], [6, 24, 42]],
  9: [292, 22, [[3, 36], [2, 37]], [6, 26, 46]],
  10: [346, 26, [[4, 43], [1, 44]], [6, 28, 50]]
};

function selectVersionM(byteLen) {
  for (let v = 1; v <= 10; v++) {
    const [, , groups] = VERSION_M_TABLE[v];
    const totalData = groups.reduce((sum, [cnt, dc]) => sum + cnt * dc, 0);
    const charCountBits = v <= 9 ? 8 : 16;
    const capacityBytes = Math.floor((totalData * 8 - 4 - charCountBits) / 8);
    if (byteLen <= capacityBytes) return v;
  }
  throw new Error('QR payload exceeds supported length');
}

function encodeDataCodewords(bytes, version) {
  const [, , groups] = VERSION_M_TABLE[version];
  const totalData = groups.reduce((sum, [cnt, dc]) => sum + cnt * dc, 0);
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };

  // Byte mode (0100)
  pushBits(0b0100, 4);
  pushBits(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) pushBits(b, 8);

  const maxBits = totalData * 8;
  const term = Math.min(4, maxBits - bits.length);
  pushBits(0, term);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let j = 0; j < 8; j++) val = (val << 1) | bits[i + j];
    codewords.push(val);
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (codewords.length < totalData) {
    codewords.push(padBytes[padIdx % 2]);
    padIdx++;
  }
  return codewords;
}

function interleaveBlocks(dataCodewords, version) {
  const [, ecPerBlock, groups] = VERSION_M_TABLE[version];
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (const [cnt, dc] of groups) {
    for (let i = 0; i < cnt; i++) {
      const block = dataCodewords.slice(offset, offset + dc);
      offset += dc;
      dataBlocks.push(block);
      ecBlocks.push(rsComputeEc(block, ecPerBlock));
    }
  }
  const out = [];
  const maxDc = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDc; i++) {
    for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const b of ecBlocks) out.push(b[i]);
  }
  return out;
}

function bchFormatBits(ecLevelM /* 0b00 */, mask) {
  const data = (ecLevelM << 3) | mask; // 5 bits
  let d = data << 10;
  const gen = 0b10100110111;
  for (let i = 14; i >= 10; i--) {
    if ((d >>> i) & 1) d ^= gen << (i - 10);
  }
  return ((data << 10) | d) ^ 0b101010000010010;
}

function bchVersionBits(version) {
  let d = version << 12;
  const gen = 0b1111100100101;
  for (let i = 17; i >= 12; i--) {
    if ((d >>> i) & 1) d ^= gen << (i - 12);
  }
  return (version << 12) | d;
}

function buildMatrix(version, fullCodewords) {
  const size = 17 + version * 4;
  const grid = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
  const reserved = Array.from({ length: size }, () => new Uint8Array(size));

  const setFixed = (r, c, dark) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      grid[r][c] = dark ? 1 : 0;
      reserved[r][c] = 1;
    }
  };

  const drawFinder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inBox = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const dark =
          inBox &&
          (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        setFixed(r0 + r, c0 + c, dark);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Alignment patterns
  const centers = VERSION_M_TABLE[version][3];
  for (const r0 of centers) {
    for (const c0 of centers) {
      if (reserved[r0][c0]) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const dark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
          setFixed(r0 + r, c0 + c, dark);
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setFixed(6, i, i % 2 === 0);
    if (!reserved[i][6]) setFixed(i, 6, i % 2 === 0);
  }

  // Dark module
  setFixed(size - 8, 8, true);

  // Reserve format info areas
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      reserved[8][i] = 1;
      reserved[i][8] = 1;
    }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = 1;
    reserved[size - 1 - i][8] = 1;
  }

  // Version info for >= 7
  if (version >= 7) {
    const vBits = bchVersionBits(version);
    for (let i = 0; i < 18; i++) {
      const dark = ((vBits >>> i) & 1) === 1;
      const r = Math.floor(i / 3);
      const c = size - 11 + (i % 3);
      setFixed(r, c, dark);
      setFixed(c, r, dark);
    }
  }

  // Place data bits
  const allBits = [];
  for (const cw of fullCodewords) {
    for (let b = 7; b >= 0; b--) allBits.push((cw >>> b) & 1);
  }

  let bitIdx = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let dx = 0; dx < 2; dx++) {
        const c = right - dx;
        if (!reserved[r][c]) {
          grid[r][c] = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
        }
      }
    }
    upward = !upward;
  }

  // Evaluate all 8 masks and pick lowest penalty
  const maskFns = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
  ];

  let bestMask = 0;
  let bestScore = Infinity;
  let bestGrid = null;

  for (let m = 0; m < 8; m++) {
    const candidate = grid.map((row, r) =>
      row.map((val, c) => (reserved[r][c] ? val : val ^ (maskFns[m](r, c) ? 1 : 0)))
    );
    applyFormatBits(candidate, size, m);
    const score = penaltyScore(candidate, size);
    if (score < bestScore) {
      bestScore = score;
      bestMask = m;
      bestGrid = candidate;
    }
  }

  return { matrix: bestGrid, size, version, mask: bestMask };
}

function applyFormatBits(mat, size, mask) {
  const fmt = bchFormatBits(0b00, mask); // EC Level M = 00
  for (let i = 0; i < 15; i++) {
    const dark = ((fmt >>> i) & 1) === 1 ? 1 : 0;

    // Copy 1 (top-left): LSB bit 0 at (0,8) .. MSB bit 14 at (8,0)
    if (i < 6) mat[i][8] = dark;
    else if (i === 6) mat[7][8] = dark;
    else if (i === 7) mat[8][8] = dark;
    else if (i === 8) mat[8][7] = dark;
    else mat[8][14 - i] = dark;

    // Copy 2 (top-right / bottom-left): LSB bit 0 at (8,size-1) .. MSB bit 14 at (size-1,8)
    if (i < 8) mat[8][size - 1 - i] = dark;
    else mat[size - 15 + i][8] = dark;
  }
}

function penaltyScore(mat, size) {
  let score = 0;
  for (let r = 0; r < size; r++) {
    let run = 1;
    for (let c = 1; c < size; c++) {
      if (mat[r][c] === mat[r][c - 1]) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else {
        run = 1;
      }
    }
  }
  for (let c = 0; c < size; c++) {
    let run = 1;
    for (let r = 1; r < size; r++) {
      if (mat[r][c] === mat[r - 1][c]) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else {
        run = 1;
      }
    }
  }
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const sum = mat[r][c] + mat[r + 1][c] + mat[r][c + 1] + mat[r + 1][c + 1];
      if (sum === 0 || sum === 4) score += 3;
    }
  }
  return score;
}

export function generateQrCodeDataUrl(text) {
  const bytes = Buffer.from(String(text), 'utf8');
  const version = selectVersionM(bytes.length);
  const dataCodewords = encodeDataCodewords(bytes, version);
  const interleaved = interleaveBlocks(dataCodewords, version);
  const { matrix, size } = buildMatrix(version, interleaved);

  const quiet = 4;
  const total = size + quiet * 2;
  let pathData = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) {
        pathData += `M${c + quiet},${r + quiet}h1v1h-1z`;
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/><path d="${pathData}" fill="#0f172a"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}
