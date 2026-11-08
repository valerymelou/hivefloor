import { expect, openDemo, test } from './support';

/**
 * The frame-rate script (NFR "Web performance"): counts frames in demo mode with
 * the robots on screen, once at full speed and once with the CPU slowed four
 * times, as a stand-in for a mid-range phone. Run it on real hardware:
 *
 *   pnpm nx run web-e2e:fps
 *
 * Results depend on the machine and its GPU, so CI doesn't run it.
 */
// Real GPU instead of the software renderer the other tests use.
test.use({
  channel: 'chromium',
  launchOptions: { args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=default'] },
});

test.describe('frame rate @fps', () => {
  test.skip(process.env['HIVEFLOOR_FPS'] === undefined, 'Set HIVEFLOOR_FPS=1 to run');
  const measure = (seconds: number) =>
    new Promise<number>((resolve) => {
      let frames = 0;
      const start = performance.now();
      const count = (now: number): void => {
        frames++;
        if (now - start < seconds * 1000) requestAnimationFrame(count);
        else resolve((frames * 1000) / (now - start));
      };
      requestAnimationFrame(count);
    });

  test('desktop and throttled frame rates', async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page, '#demo-crowd');
    await expect.poll(() => page.locator('.hf-tag').count()).toBeGreaterThanOrEqual(10);
    // Let the shaders compile and the first walks finish.
    await page.waitForTimeout(5000);
    const robots = await page.locator('.hf-tag').count();
    const renderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      return info === undefined || info === null
        ? ''
        : String(gl?.getParameter(info.UNMASKED_RENDERER_WEBGL));
    });
    const desktop = await page.evaluate(measure, 10);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const throttled = await page.evaluate(measure, 10);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    const summary = `${renderer}, ${String(robots)} robots: ${desktop.toFixed(1)} fps, ${throttled.toFixed(1)} fps with the CPU slowed 4×`;
    info.annotations.push({ type: 'fps', description: summary });
    console.log(summary);
    expect(desktop).toBeGreaterThanOrEqual(55);
    expect(throttled).toBeGreaterThanOrEqual(30);
  });
});
