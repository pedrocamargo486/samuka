import * as THREE from 'three';

export interface SneakerPalette {
  upper: string;
  overlay: string;
  accent: string;
  midsole: string;
  outsole: string;
  laces: string;
  airPod: string;
}

const PORTUGUESE_COLOR_MAP: { match: string[]; hex: string; isDark?: boolean }[] = [
  { match: ['preto', 'black', 'obsidian', 'grafite'], hex: '#1A1A1D', isDark: true },
  { match: ['branco', 'white', 'gelo'], hex: '#F3F3F1' },
  { match: ['off-white', 'off white', 'creme', 'cru', 'bege', 'areia'], hex: '#E6DFD3' },
  { match: ['cinza', 'grey', 'gray', 'chumbo'], hex: '#7A7D82' },
  { match: ['prata', 'silver', 'metalic', 'metálic'], hex: '#B8BDC4' },
  { match: ['vermelho', 'crimson', 'red', 'rubi'], hex: '#C8102E', isDark: true },
  { match: ['vinho', 'bordô', 'bordo', 'burgundy'], hex: '#6E1423', isDark: true },
  { match: ['azul marinho', 'marinho', 'navy'], hex: '#1B2A4A', isDark: true },
  { match: ['azul', 'blue', 'celeste', 'royal'], hex: '#2257A8', isDark: true },
  { match: ['verde', 'green', 'oliva', 'musgo'], hex: '#2D6A4F', isDark: true },
  { match: ['amarelo', 'yellow', 'neon', 'volt'], hex: '#D9B611' },
  { match: ['laranja', 'orange', 'coral'], hex: '#E05A1E' },
  { match: ['rosa', 'pink', 'salmão'], hex: '#D96B8A' },
  { match: ['roxo', 'purple', 'lilás', 'violeta'], hex: '#6A3B8F', isDark: true },
  { match: ['marrom', 'brown', 'caramelo', 'café', 'terra'], hex: '#6D4C3D', isDark: true },
  { match: ['dourado', 'gold', 'ouro'], hex: '#C59B27' },
];

function findHexForColorName(name: string): { hex: string; isDark: boolean } | null {
  const norm = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  for (const entry of PORTUGUESE_COLOR_MAP) {
    if (entry.match.some((k) => norm.includes(k))) {
      return { hex: entry.hex, isDark: Boolean(entry.isDark) };
    }
  }
  return null;
}

export function resolveSneakerPalette(
  colors: string[],
  selectedColor: string,
  productName: string
): SneakerPalette {
  const ordered = [
    selectedColor,
    ...colors.filter((c) => c !== selectedColor),
    productName,
  ].filter(Boolean);

  const resolved: { hex: string; isDark: boolean }[] = [];
  for (const label of ordered) {
    const found = findHexForColorName(label);
    if (found && !resolved.some((r) => r.hex === found.hex)) {
      resolved.push(found);
    }
  }

  const primary = resolved[0] || { hex: '#1E1E22', isDark: true };
  const secondary = resolved[1] || (primary.isDark ? { hex: '#EAE8E3', isDark: false } : { hex: '#2A2A2E', isDark: true });
  const third = resolved[2] || { hex: '#C8102E', isDark: true };

  return {
    upper: primary.hex,
    overlay: secondary.hex,
    accent: third.hex,
    midsole: primary.hex === '#F3F3F1' ? '#ECEAE4' : '#F4F3EF',
    outsole: primary.isDark ? '#141416' : '#262629',
    laces: secondary.hex,
    airPod: third.hex,
  };
}

export function createMeshWeaveTexture(
  baseHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);

    // Subtle athletic knit / engineered mesh pattern
    const baseColor = new THREE.Color(baseHex);
    const hsl = { h: 0, s: 0, l: 0 };
    baseColor.getHSL(hsl);
    const poreColor = new THREE.Color().setHSL(
      hsl.h,
      hsl.s,
      hsl.l > 0.5 ? Math.max(0, hsl.l - 0.14) : Math.min(1, hsl.l + 0.14)
    );
    const highlightColor = new THREE.Color().setHSL(
      hsl.h,
      hsl.s,
      hsl.l > 0.5 ? Math.min(1, hsl.l + 0.08) : Math.min(1, hsl.l + 0.22)
    );

    ctx.fillStyle = `#${poreColor.getHexString()}`;
    const step = 16;
    for (let y = 0; y < size; y += step) {
      const offsetX = (y / step) % 2 === 0 ? 0 : step / 2;
      for (let x = -step; x < size + step; x += step) {
        ctx.beginPath();
        ctx.ellipse(x + offsetX, y, 4.2, 2.4, 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.strokeStyle = `#${highlightColor.getHexString()}`;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1.2;
    for (let i = -size; i < size * 2; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size * 0.5, size);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3.5, 2.5);
  texture.anisotropy = Math.max(1, maxAnisotropy);
  texture.needsUpdate = true;
  return texture;
}

export function createTonguePatchTexture(
  brandName: string,
  accentHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, 512, 256);

    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 10;
    ctx.strokeRect(18, 18, 476, 220);

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = (brandName || 'SAMUKA').toUpperCase().slice(0, 14);
    ctx.font = '800 54px system-ui, -apple-system, sans-serif';
    ctx.fillText(label, 256, 114);

    ctx.fillStyle = accentHex;
    ctx.font = '700 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('SAMUKA TÊNIS STUDIO', 256, 178);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.max(1, maxAnisotropy);
  texture.needsUpdate = true;
  return texture;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.08,
      size / 2,
      size / 2,
      size * 0.48
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.16)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createTurntableTexture(
  darkMode: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = darkMode ? '#1F1F24' : '#ECECE8';
    ctx.fillRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;

    ctx.strokeStyle = darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(17,17,17,0.12)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.46, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.36, 0, Math.PI * 2);
    ctx.stroke();

    // Degree tick marks
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const rOuter = size * 0.46;
      const rInner = deg % 45 === 0 ? size * 0.425 : size * 0.442;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad) * rInner, cy + Math.sin(rad) * rInner);
      ctx.lineTo(cx + Math.cos(rad) * rOuter, cy + Math.sin(rad) * rOuter);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.max(1, maxAnisotropy);
  texture.needsUpdate = true;
  return texture;
}
