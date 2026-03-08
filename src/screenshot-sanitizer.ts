import sharp from 'sharp';

export interface SanitizeOptions {
  activeWindow: { x: number; y: number; width: number; height: number };
  screenWidth: number;
  screenHeight: number;
  dimOpacity?: number;  // default 0.3
}

export async function sanitizeScreenshot(
  buffer: Buffer,
  options: SanitizeOptions,
): Promise<{ buffer: Buffer; sanitized: boolean }> {
  const { activeWindow: aw, screenWidth: sw, screenHeight: sh, dimOpacity = 0.3 } = options;

  // Skip if window covers >90% of screen
  const windowArea = aw.width * aw.height;
  const screenArea = sw * sh;
  if (windowArea / screenArea > 0.9) return { buffer, sanitized: false };

  // Clip window bounds to screen
  const x = Math.max(0, Math.min(aw.x, sw));
  const y = Math.max(0, Math.min(aw.y, sh));
  const w = Math.min(aw.width, sw - x);
  const h = Math.min(aw.height, sh - y);

  if (w <= 0 || h <= 0) return { buffer, sanitized: false };

  // Create dark overlay with transparent cutout for active window
  const opacity = Math.round(255 * (1 - dimOpacity));
  const overlay = await sharp({
    create: { width: sw, height: sh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: opacity } },
  })
    .composite([{
      input: await sharp({
        create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      }).png().toBuffer(),
      left: x,
      top: y,
    }])
    .png()
    .toBuffer();

  const result = await sharp(buffer)
    .composite([{ input: overlay, blend: 'over' }])
    .jpeg({ quality: 50 })
    .toBuffer();

  return { buffer: result, sanitized: true };
}
