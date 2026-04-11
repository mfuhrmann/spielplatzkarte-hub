import { test, expect, Page } from '@playwright/test';

declare global {
  interface Window {
    __map: import('ol').Map;
  }
}

// Standard wheel delta (≈2.5 OL zoom steps) — large enough to reliably
// trigger MouseWheelZoom across all browsers without hitting min/max zoom.
const WHEEL_DELTA = 300;

async function loadMap({ page }: { page: Page }) {
  // Return empty registry so no external instance fetches happen in tests
  await page.route('**/registry.json', route => route.fulfill({ json: [] }));
  await page.goto('/');
  // Wait until OL has initialised the map and rendered a valid zoom level
  await page.waitForFunction(
    () => typeof window.__map !== 'undefined' && (window.__map.getView().getZoom() ?? 0) > 0,
    { timeout: 10_000 },
  );
}

// Dispatch a WheelEvent directly on the OL viewport element.
// page.mouse.wheel() works in Chromium/Firefox but doesn't reach OL's handler
// in Playwright's WebKit backend, so we dispatch on the element directly.
async function wheelOnMap(page: Page, deltaY: number) {
  const box = await page.locator('#map').boundingBox();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  await page.evaluate(
    ({ x, y, dy }) => {
      const viewport = document.querySelector('.ol-viewport');
      viewport?.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: dy,
          deltaMode: 0,
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
        }),
      );
    },
    { x: cx, y: cy, dy: deltaY },
  );
}

async function waitForZoomChange(page: Page, from: number, direction: '>' | '<') {
  await page.waitForFunction(
    ([z, dir]: [number, string]) => {
      const zoom = window.__map.getView().getZoom() ?? 0;
      return dir === '>' ? zoom > z : zoom < z;
    },
    [from, direction] as [number, string],
    { timeout: 3_000 },
  );
}

test.beforeEach(loadMap);

test('map canvas is visible', async ({ page }) => {
  await expect(page.locator('#map canvas')).toBeVisible();
});

test('wheel scroll zooms in', async ({ page }) => {
  const before = await page.evaluate(() => window.__map.getView().getZoom()!);
  await wheelOnMap(page, -WHEEL_DELTA);
  await waitForZoomChange(page, before, '>');
  const after = await page.evaluate(() => window.__map.getView().getZoom()!);
  expect(after).toBeGreaterThan(before);
});

test('wheel scroll zooms out', async ({ page }) => {
  const before = await page.evaluate(() => window.__map.getView().getZoom()!);
  await wheelOnMap(page, WHEEL_DELTA);
  await waitForZoomChange(page, before, '<');
  const after = await page.evaluate(() => window.__map.getView().getZoom()!);
  expect(after).toBeLessThan(before);
});

test('drag pans the map', async ({ page }) => {
  const box = await page.locator('#map').boundingBox();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;

  const centerBefore = await page.evaluate(() => window.__map.getView().getCenter()!);

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 100, cy + 80, { steps: 10 });
  await page.mouse.up();

  const centerAfter = await page.evaluate(() => window.__map.getView().getCenter()!);
  expect(centerAfter[0]).not.toBeCloseTo(centerBefore[0], 0);
});
