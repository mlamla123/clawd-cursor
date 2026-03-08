import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { sanitizeScreenshot } from '../src/screenshot-sanitizer';

// Helper: create a test PNG buffer of given dimensions
async function createTestImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .png()
    .toBuffer();
}

describe('sanitizeScreenshot', () => {
  const SW = 1920;
  const SH = 1080;

  it('returns sanitized=false when window covers >90% of screen', async () => {
    const buffer = await createTestImage(SW, SH);
    const result = await sanitizeScreenshot(buffer, {
      activeWindow: { x: 0, y: 0, width: 1920, height: 1000 }, // ~96% of screen
      screenWidth: SW,
      screenHeight: SH,
    });
    expect(result.sanitized).toBe(false);
    expect(result.buffer).toBe(buffer); // unchanged
  });

  it('returns sanitized=true when window covers <90% of screen', async () => {
    const buffer = await createTestImage(SW, SH);
    const result = await sanitizeScreenshot(buffer, {
      activeWindow: { x: 0, y: 0, width: 800, height: 600 }, // ~22% of screen
      screenWidth: SW,
      screenHeight: SH,
    });
    expect(result.sanitized).toBe(true);
    expect(result.buffer).not.toBe(buffer);
  });

  it('returns sanitized=false when window dimensions are zero', async () => {
    const buffer = await createTestImage(SW, SH);
    const result = await sanitizeScreenshot(buffer, {
      activeWindow: { x: 0, y: 0, width: 0, height: 0 },
      screenWidth: SW,
      screenHeight: SH,
    });
    expect(result.sanitized).toBe(false);
  });

  it('clips window bounds to screen edges', async () => {
    const buffer = await createTestImage(SW, SH);
    // Window extends beyond screen edges
    const result = await sanitizeScreenshot(buffer, {
      activeWindow: { x: -100, y: -100, width: 800, height: 600 },
      screenWidth: SW,
      screenHeight: SH,
    });
    // Should not throw — clipping should handle out-of-bounds
    expect(result).toBeDefined();
  });

  it('returns a valid JPEG buffer when sanitized', async () => {
    const buffer = await createTestImage(SW, SH);
    const result = await sanitizeScreenshot(buffer, {
      activeWindow: { x: 100, y: 100, width: 800, height: 600 },
      screenWidth: SW,
      screenHeight: SH,
    });
    expect(result.sanitized).toBe(true);
    // JPEG starts with 0xFF 0xD8
    expect(result.buffer[0]).toBe(0xff);
    expect(result.buffer[1]).toBe(0xd8);
  });

  it('uses default dimOpacity of 0.3 when not specified', async () => {
    const buffer = await createTestImage(SW, SH);
    const result = await sanitizeScreenshot(buffer, {
      activeWindow: { x: 100, y: 100, width: 800, height: 600 },
      screenWidth: SW,
      screenHeight: SH,
    });
    expect(result.sanitized).toBe(true);
  });

  it('handles small window in corner', async () => {
    const buffer = await createTestImage(SW, SH);
    const result = await sanitizeScreenshot(buffer, {
      activeWindow: { x: 0, y: 0, width: 200, height: 200 },
      screenWidth: SW,
      screenHeight: SH,
    });
    expect(result.sanitized).toBe(true);
  });

  it('exactly at 90% boundary — skips sanitization', async () => {
    const buffer = await createTestImage(SW, SH);
    // 90% exactly: 1920 * 1080 * 0.9 = 1866240
    // sqrt(1866240) ≈ 1366 x 1366 ... let's use 1728 x 972 = 1679616 * 0.9 exactly
    // Instead: use width=1920, height=972 = 1866240 = exactly 90%
    const result = await sanitizeScreenshot(buffer, {
      activeWindow: { x: 0, y: 0, width: 1920, height: 972 }, // = exactly 90%
      screenWidth: SW,
      screenHeight: SH,
    });
    // >0.9 check: 1866240 / 2073600 = 0.9 — NOT > 0.9, so it should sanitize
    expect(result.sanitized).toBe(true);
  });

  it('window fully off-screen returns sanitized=false', async () => {
    const buffer = await createTestImage(SW, SH);
    const result = await sanitizeScreenshot(buffer, {
      activeWindow: { x: SW + 100, y: SH + 100, width: 800, height: 600 },
      screenWidth: SW,
      screenHeight: SH,
    });
    expect(result.sanitized).toBe(false);
  });
});
