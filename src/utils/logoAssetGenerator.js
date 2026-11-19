// Canvas-based PNG generators for Capacitor app icon (1024x1024) and splash (2732x2732)
// matching the full-bleed #090d16 executive emerald-and-gold SmartLedgerLogo emblem.

export const SMARTLEDGER_BG_HEX = '#090d16';

function drawRoundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawTopRoundedBar(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

/**
 * Draws the minimalist emerald-and-gold geometric wallet / upward ledger emblem
 * strictly centered within the inner 62% safe zone on a 100x100 design grid.
 * Caller supplies full-bleed #090d16 background (zero white borders or framing).
 */
export function drawSmartLedgerEmblem(ctx, x, y, size) {
  const s = size / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);

  // Subtle ambient emerald depth aura well inside center (edges stay pure #090d16)
  const aura = ctx.createRadialGradient(50, 48, 2, 50, 48, 38);
  aura.addColorStop(0, 'rgba(16, 185, 129, 0.16)');
  aura.addColorStop(1, 'rgba(9, 13, 22, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(50, 48, 38, 0, Math.PI * 2);
  ctx.fill();

  // Executive Champagne Gold Top Ledger Card (x: 31..69, y: 25.5..36)
  const goldCardGrad = ctx.createLinearGradient(31, 25.5, 69, 36);
  goldCardGrad.addColorStop(0, '#fde68a');
  goldCardGrad.addColorStop(0.55, '#f59e0b');
  goldCardGrad.addColorStop(1, '#b45309');
  drawTopRoundedBar(ctx, 31, 25.5, 38, 10.5, 5.5);
  ctx.fillStyle = goldCardGrad;
  ctx.fill();

  // Crisp dark seam separating top gold card from wallet spine
  ctx.fillStyle = SMARTLEDGER_BG_HEX;
  ctx.fillRect(30, 33.2, 40, 2.4);

  // Main Geometric Wallet Body (x: 24..76, y: 35..74, rx: 8)
  const walletFill = ctx.createLinearGradient(24, 35, 76, 74);
  walletFill.addColorStop(0, '#0f3a31');
  walletFill.addColorStop(0.55, '#0a2026');
  walletFill.addColorStop(1, '#091521');

  const walletStroke = ctx.createLinearGradient(24, 35, 76, 74);
  walletStroke.addColorStop(0, '#34d399');
  walletStroke.addColorStop(0.5, '#10b981');
  walletStroke.addColorStop(1, '#047857');

  drawRoundedRectPath(ctx, 24, 35, 52, 39, 8);
  ctx.fillStyle = walletFill;
  ctx.fill();
  ctx.strokeStyle = walletStroke;
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Ascending Emerald Ledger Pillars (bottom aligned at y=67.5)
  drawTopRoundedBar(ctx, 31, 60, 4.6, 7.5, 1.6);
  ctx.fillStyle = '#059669';
  ctx.fill();

  drawTopRoundedBar(ctx, 38.5, 55, 4.6, 12.5, 1.6);
  ctx.fillStyle = '#10b981';
  ctx.fill();

  drawTopRoundedBar(ctx, 46, 49.5, 4.6, 18, 1.6);
  ctx.fillStyle = '#34d399';
  ctx.fill();

  // Gold Upward Ledger Trajectory Line
  const arrowGrad = ctx.createLinearGradient(31, 53.5, 55, 40.5);
  arrowGrad.addColorStop(0, '#f59e0b');
  arrowGrad.addColorStop(1, '#fde68a');

  ctx.beginPath();
  ctx.moveTo(31.2, 53.5);
  ctx.lineTo(39.4, 47.2);
  ctx.lineTo(44.4, 50.4);
  ctx.lineTo(54.6, 40.8);
  ctx.strokeStyle = arrowGrad;
  ctx.lineWidth = 3.0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Gold Geometric Upward Chevron Arrowhead
  ctx.beginPath();
  ctx.moveTo(49.0, 40.6);
  ctx.lineTo(55.0, 40.6);
  ctx.lineTo(55.0, 46.6);
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 3.0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Minimalist Emerald Clasp Pill on Right Edge (x: 59.3..76.6, y: 48.5..61.5)
  const claspGrad = ctx.createLinearGradient(59.3, 48.5, 76.6, 61.5);
  claspGrad.addColorStop(0, '#34d399');
  claspGrad.addColorStop(1, '#059669');
  ctx.beginPath();
  ctx.moveTo(65.8, 48.5);
  ctx.lineTo(76.6, 48.5);
  ctx.lineTo(76.6, 61.5);
  ctx.lineTo(65.8, 61.5);
  ctx.arc(65.8, 55, 6.5, Math.PI / 2, (Math.PI * 3) / 2, false);
  ctx.closePath();
  ctx.fillStyle = claspGrad;
  ctx.fill();

  // Gold Clasp Fastener Stud
  ctx.beginPath();
  ctx.arc(66.2, 55, 3.1, 0, Math.PI * 2);
  ctx.fillStyle = '#fde68a';
  ctx.fill();

  ctx.restore();
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode PNG'));
    }, 'image/png');
  });
}

/**
 * Generates a 100% full-bleed #090d16 1024x1024 PNG icon (zero white background,
 * zero white borders) with the SmartLedger emblem centered in the inner 62% safe zone.
 */
export async function renderIconPngBlob(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 100% full-bleed rich dark slate-navy background to every edge
  ctx.fillStyle = SMARTLEDGER_BG_HEX;
  ctx.fillRect(0, 0, size, size);

  // Draw emblem on the full 0..size canvas (emblem itself occupies inner 52%..62% safe zone)
  drawSmartLedgerEmblem(ctx, 0, 0, size);

  return canvasToPngBlob(canvas);
}

/**
 * Generates a 2732x2732 full-bleed #090d16 splash screen PNG with zero white flash.
 */
export async function renderSplashPngBlob(size = 2732) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = SMARTLEDGER_BG_HEX;
  ctx.fillRect(0, 0, size, size);

  const glow = ctx.createRadialGradient(
    size * 0.5,
    size * 0.44,
    size * 0.02,
    size * 0.5,
    size * 0.44,
    size * 0.34
  );
  glow.addColorStop(0, 'rgba(16, 185, 129, 0.16)');
  glow.addColorStop(1, 'rgba(9, 13, 22, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  const emblemBox = Math.round(size * 0.28);
  const emblemX = Math.round((size - emblemBox) / 2);
  const emblemY = Math.round(size * 0.33);
  drawSmartLedgerEmblem(ctx, emblemX, emblemY, emblemBox);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f8fafc';
  ctx.font = `800 ${Math.round(size * 0.036)}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('SmartLedger', size / 2, emblemY + emblemBox + Math.round(size * 0.032));

  ctx.fillStyle = '#fcd34d';
  ctx.font = `700 ${Math.round(size * 0.0155)}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(
    'AED · EGP EXECUTIVE FINANCE LEDGER',
    size / 2,
    emblemY + emblemBox + Math.round(size * 0.068)
  );

  return canvasToPngBlob(canvas);
}

export function triggerBlobDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
