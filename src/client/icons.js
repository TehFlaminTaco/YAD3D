/** Draw an item's sprite (from the shared atlas) into a small canvas, scaled down if it is bigger than the slot. */
export function drawIcon(canvas, assets, spriteId) {
  if (canvas._s === spriteId) return;
  canvas._s = spriteId;
  const cx = canvas.getContext('2d');
  cx.clearRect(0, 0, canvas.width, canvas.height);
  if (spriteId === undefined || spriteId === null || spriteId < 0) return;
  const r = assets.rects[spriteId];
  if (!r) return;
  cx.imageSmoothingEnabled = false;
  const S = canvas.width;
  if (r.w <= S && r.h <= S) {
    cx.drawImage(assets.spriteImg, r.x, r.y, r.w, r.h, Math.min(S - r.w, r.ox), Math.min(S - r.h, r.oy), r.w, r.h);
  } else {
    const k = S / Math.max(r.w, r.h);
    cx.drawImage(assets.spriteImg, r.x, r.y, r.w, r.h, (S - r.w * k) / 2, (S - r.h * k) / 2, r.w * k, r.h * k);
  }
}
