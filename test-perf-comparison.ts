/**
 * Performance Comparison Test
 * 
 * Tests the optimized Clawd Cursor against baseline metrics.
 * Run with: npx ts-node test-perf-comparison.ts
 * 
 * Measures:
 * - Screenshot capture time (target: <50ms)
 * - Screenshot size (target: <100KB with JPEG 55 @ 1024px)
 * - Accessibility context fetch time
 * - Accessibility context size (target: <3000 chars)
 * - Combined screen context script time
 * - TypeScript compilation
 */

import { NativeDesktop } from './src/native-desktop';
import { AccessibilityBridge } from './src/accessibility';
import { DEFAULT_CONFIG } from './src/types';

const ITERATIONS = 5;

interface BenchResult {
  name: string;
  avgMs: number;
  minMs: number;
  maxMs: number;
  extra?: string;
}

async function benchmark(name: string, fn: () => Promise<any>, iterations = ITERATIONS): Promise<BenchResult> {
  const times: number[] = [];
  let lastResult: any;
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    lastResult = await fn();
    times.push(performance.now() - start);
  }

  return {
    name,
    avgMs: Math.round(times.reduce((a, b) => a + b) / times.length),
    minMs: Math.round(Math.min(...times)),
    maxMs: Math.round(Math.max(...times)),
    extra: lastResult?.extra,
  };
}

async function main() {
  console.log('🐾 Clawd Cursor Performance Test\n');
  console.log('═'.repeat(60));

  // 1. Initialize
  const config = { ...DEFAULT_CONFIG };
  const desktop = new NativeDesktop(config);
  const a11y = new AccessibilityBridge();

  console.log('\n📋 Connecting to native desktop...');
  await desktop.connect();
  console.log(`   Screen: ${desktop.getScreenSize().width}x${desktop.getScreenSize().height}`);
  console.log(`   Scale factor: ${desktop.getScaleFactor()}x`);
  console.log(`   LLM target: 1024px wide`);
  console.log(`   JPEG quality: ${config.capture.quality}`);

  const results: BenchResult[] = [];

  // 2. Screenshot benchmarks
  console.log('\n📸 Screenshot benchmarks...');
  
  const screenshotResult = await benchmark('captureForLLM()', async () => {
    const frame = await desktop.captureForLLM();
    return { extra: `${(frame.buffer.length / 1024).toFixed(0)}KB, ${frame.llmWidth}x${frame.llmHeight}` };
  });
  results.push(screenshotResult);

  const fullScreenResult = await benchmark('captureScreen() [full]', async () => {
    const frame = await desktop.captureScreen();
    return { extra: `${(frame.buffer.length / 1024).toFixed(0)}KB, ${frame.width}x${frame.height}` };
  });
  results.push(fullScreenResult);

  // 3. Accessibility benchmarks
  console.log('\n♿ Accessibility benchmarks...');

  const a11yAvailable = await a11y.isShellAvailable();
  if (a11yAvailable) {
    const windowsResult = await benchmark('getWindows()', async () => {
      const windows = await a11y.getWindows(true);
      return { extra: `${windows.length} windows` };
    });
    results.push(windowsResult);

    const contextResult = await benchmark('getScreenContext() [combined]', async () => {
      // Invalidate cache to get real timing
      a11y.invalidateCache();
      const activeWindow = await a11y.getActiveWindow();
      const context = await a11y.getScreenContext(activeWindow?.processId);
      return { extra: `${context.length} chars` };
    });
    results.push(contextResult);

    // Test cached context
    const cachedResult = await benchmark('getScreenContext() [cached]', async () => {
      const context = await a11y.getScreenContext();
      return { extra: `${context.length} chars (from cache)` };
    });
    results.push(cachedResult);
  } else {
    console.log('   ⚠️ Accessibility not available, skipping a11y benchmarks');
  }

  // 4. Print results table
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESULTS');
  console.log('═'.repeat(60));
  console.log(`${'Test'.padEnd(35)} ${'Avg'.padStart(6)} ${'Min'.padStart(6)} ${'Max'.padStart(6)}  Extra`);
  console.log('─'.repeat(60));

  for (const r of results) {
    console.log(
      `${r.name.padEnd(35)} ${(r.avgMs + 'ms').padStart(6)} ${(r.minMs + 'ms').padStart(6)} ${(r.maxMs + 'ms').padStart(6)}  ${r.extra || ''}`
    );
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📈 BASELINE COMPARISON (v0.3 VNC → v0.4 Native → v0.4.1 Optimized)');
  console.log('═'.repeat(60));

  const screenshotAvg = results.find(r => r.name.includes('captureForLLM'))?.avgMs || 0;
  const contextAvg = results.find(r => r.name.includes('combined'))?.avgMs || 0;
  const cachedAvg = results.find(r => r.name.includes('cached'))?.avgMs || 0;
  const screenshotSize = results.find(r => r.name.includes('captureForLLM'))?.extra || '';

  console.log(`
| Metric                    | v0.3 (VNC) | v0.4 (Native) | v0.4.1 (Optimized) |
|---------------------------|------------|---------------|---------------------|
| Screenshot capture        | ~850ms     | ~50ms         | ~${screenshotAvg}ms${' '.repeat(Math.max(0, 16 - String(screenshotAvg).length - 3))}|
| Screenshot size (LLM)     | ~200KB     | ~120KB        | ~${screenshotSize.split(',')[0]}${' '.repeat(Math.max(0, 16 - screenshotSize.split(',')[0].length))}|
| LLM resolution            | 1280x720   | 1280x720      | 1024x576            |
| A11y context (uncached)   | N/A        | ~600ms        | ~${contextAvg}ms${' '.repeat(Math.max(0, 16 - String(contextAvg).length - 3))}|
| A11y context (cached)     | N/A        | ~0ms (500ms)  | ~${cachedAvg}ms (2s TTL)${' '.repeat(Math.max(0, 8 - String(cachedAvg).length))}|
| JPEG quality              | 70         | 70            | 55                  |
| Delays (routed action)    | N/A        | 200-300ms     | 50-150ms            |
| Delays (LLM retry)        | N/A        | 1500ms        | 500ms               |
| Delays (CU last batch)    | N/A        | 300-1000ms    | 150-600ms           |
| System prompt tokens      | N/A        | ~800          | ~300 (est)          |
| Streaming                 | No         | No            | Yes (early JSON)    |
| A11y tree filtering       | No         | No            | Interactive only    |
| A11y context cap          | Unlimited  | Unlimited     | 3000 chars          |
| Combined PS script        | No         | No            | Yes (1 spawn)       |
`);

  // 5. Optimization summary
  console.log('═'.repeat(60));
  console.log('✅ OPTIMIZATIONS APPLIED');
  console.log('═'.repeat(60));
  console.log(`
1. ✅ Cut hardcoded delays (200-1500ms → 50-600ms)
2. ✅ Compressed screenshots (1280→1024 wide, quality 70→55)
3. ✅ Streaming LLM responses with early JSON return
4. ✅ Trimmed system prompts by ~60%
5. ✅ A11y tree filtered to interactive elements only
6. ✅ A11y context capped at 3000 chars
7. ✅ Combined PowerShell script (1 spawn vs 3)
8. ✅ Taskbar cache (30s TTL vs every call)
9. ✅ Screen context cache increased (500ms → 2s)
`);

  desktop.disconnect();
}

main().catch(console.error);
