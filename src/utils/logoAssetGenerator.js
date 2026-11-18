// Canvas-based PNG generators for Capacitor app icon (1024x1024) and splash (2732x2732)
// matching the emerald & slate SmartLedgerLogo emblem.

function drawRoundedRect(ctx, x, y, w, h, r) {
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

export function drawSmartLedgerEmblem(ctx, x, y, size) {
  const s = size / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);

  // Outer Slate Rounded Badge
  const bgGrad = ctx.createLinearGradient(0, 0, 100, 100);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(1, '#1e293b');
  drawRoundedRect(ctx, 0, 0, 100, 100, 24);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Subtle emerald rim
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Back Ledger Sheet (Emerald)
  const emeraldGrad = ctx.createLinearGradient(20, 16, 82, 54);
  emeraldGrad.addColorStop(0, '#34d399');
  emeraldGrad.addColorStop(1, '#059669');
  drawRoundedRect(ctx, 20, 18, 60, 32, 9);
  ctx.fillStyle = emeraldGrad;
  ctx.fill();

  // Front Wallet Body (Deep Slate/White contrast card)
  drawRoundedRect(ctx, 16, 33, 68, 48, 12);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();

  // Split-ledger divider line
  ctx.beginPath();
  ctx.moveTo(26, 48);
  ctx.lineTo(54, 48);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(26, 59);
  ctx.lineTo(46, 59);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Wallet Clasp Tab (Emerald)
  drawRoundedRect(ctx, 56, 47, 28, 20, 10);
  ctx.fillStyle = '#059669';
  ctx.fill();

  // Clasp Coin Dot
  ctx.beginPath();
  ctx.arc(66, 57, 4.2, 0, Math.PI * 2);
  ctx.fillStyle = '#ecfdf5';
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

export async function renderIconPngBlob(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Solid deep slate canvas background for adaptive/iOS icon safety
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#0f172a');
  bg.addColorStop(1, '#1e293b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Subtle emerald radial glow behind emblem
  const glow = ctx.createRadialGradient(
    size * 0.5,
    size * 0.45,
    size * 0.05,
    size * 0.5,
    size * 0.5,
    size * 0.55
  );
  glow.addColorStop(0, 'rgba(16, 185, 129, 0.28)');
  glow.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  const emblemSize = Math.round(size * 0.72);
  const offset = Math.round((size - emblemSize) / 2);
  drawSmartLedgerEmblem(ctx, offset, offset, emblemSize);

  return canvasToPngBlob(canvas);
}

export async function renderSplashPngBlob(size = 2732) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#090f1d');
  bg.addColorStop(0.55, '#0f172a');
  bg.addColorStop(1, '#064e3b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  const glow = ctx.createRadialGradient(
    size * 0.5,
    size * 0.44,
    size * 0.04,
    size * 0.5,
    size * 0.44,
    size * 0.38
  );
  glow.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
  glow.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  const emblemSize = Math.round(size * 0.19);
  const emblemX = Math.round((size - emblemSize) / 2);
  const emblemY = Math.round(size * 0.37);
  drawSmartLedgerEmblem(ctx, emblemX, emblemY, emblemSize);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${Math.round(size * 0.036)}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('SmartLedger', size / 2, emblemY + emblemSize + Math.round(size * 0.065));

  ctx.fillStyle = '#6ee7b7';
  ctx.font = `600 ${Math.round(size * 0.017)}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(
    'AED · EGP Dual-Currency & Shared Finance',
    size / 2,
    emblemY + emblemSize + Math.round(size * 0.1)
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
