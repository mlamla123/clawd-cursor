/**
 * Test script for accessibility bridge — runs standalone.
 * Usage: node dist/test-a11y.js
 */

import { AccessibilityBridge } from './accessibility';

async function main() {
  const a11y = new AccessibilityBridge();

  console.log('🧪 Testing Accessibility Bridge\n');

  // Test 1: Get windows
  console.log('━━━ Test 1: List Windows ━━━');
  try {
    const windows = await a11y.getWindows();
    console.log(`Found ${windows.length} windows:`);
    for (const w of windows) {
      console.log(`  [${w.processName}] "${w.title}" pid:${w.processId} ${w.isMinimized ? '(minimized)' : `at ${w.bounds.x},${w.bounds.y}`}`);
    }
    console.log('✅ PASS\n');
  } catch (err) {
    console.error('❌ FAIL:', err);
  }

  // Test 2: Find buttons
  console.log('━━━ Test 2: Find Buttons ━━━');
  try {
    const buttons = await a11y.findElement({ controlType: 'Button' });
    console.log(`Found ${buttons.length} buttons:`);
    for (const b of buttons.slice(0, 10)) {
      console.log(`  [${b.name}] id:${(b as any).automationId || 'none'} at ${b.bounds.x},${b.bounds.y}`);
    }
    if (buttons.length > 10) console.log(`  ... and ${buttons.length - 10} more`);
    console.log('✅ PASS\n');
  } catch (err) {
    console.error('❌ FAIL:', err);
  }

  // Test 3: Find Start button specifically
  console.log('━━━ Test 3: Find Start Button ━━━');
  try {
    const start = await a11y.findElement({ name: 'Start', controlType: 'Button' });
    if (start.length > 0) {
      console.log(`Found Start button at (${start[0].bounds.x}, ${start[0].bounds.y}), size: ${start[0].bounds.width}x${start[0].bounds.height}`);
      console.log('✅ PASS\n');
    } else {
      console.log('⚠️  Start button not found');
    }
  } catch (err) {
    console.error('❌ FAIL:', err);
  }

  // Test 4: Get screen context (what the AI would see)
  console.log('━━━ Test 4: Screen Context for AI ━━━');
  try {
    const context = await a11y.getScreenContext();
    console.log(context);
    console.log('✅ PASS\n');
  } catch (err) {
    console.error('❌ FAIL:', err);
  }

  // Test 5: Get screen context for a specific window
  console.log('━━━ Test 5: Screen Context (focused window) ━━━');
  try {
    const windows = await a11y.getWindows();
    const nonMinimized = windows.find(w => !w.isMinimized);
    if (nonMinimized) {
      console.log(`Getting screen context for "${nonMinimized.title}" (pid: ${nonMinimized.processId})...`);
      const context = await a11y.getScreenContext(nonMinimized.processId);
      console.log(context.substring(0, 1000));
      console.log('✅ PASS\n');
    }
  } catch (err) {
    console.error('❌ FAIL:', err);
  }

  console.log('🧪 Tests complete');
}

main().catch(console.error);
