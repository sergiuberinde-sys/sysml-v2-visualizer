import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = '/Users/sergiu/sysml-v2-visualizer/docs/img';
mkdirSync(OUT, { recursive: true });

// General view: definitions only — no connect statements so no stray
// ConnectionUsage arrows appear in the screenshot.
const GENERAL_EXAMPLE = `package VehicleSystem {

    item def Speed;
    item def Torque;
    item def Pressure;

    port def DrivePort {
        out torque : Torque;
        in  speed  : Speed;
    }

    port def SensorPort {
        out pressure : Pressure;
    }

    part def Engine {
        port drive : DrivePort;
    }

    part def Transmission {
        port input : DrivePort;
    }

    part def BrakeSensor {
        port data  : SensorPort;
    }

    part def Vehicle {
        part engine       : Engine;
        part transmission : Transmission;
        part brakeSensor  : BrakeSensor;
    }
}
`;

// State view — official SysML v2 syntax with guards
const STATE_EXAMPLE = `package TrafficLight {

    state def TrafficLightController {

        state Red;
        state Green;
        state Yellow;

        entry; then Red;

        transition first Red    if timer then Green;
        transition first Green  if timer then Yellow;
        transition first Yellow if timer then Red;
    }
}
`;

async function cropToNodes(page, rfBox, pad = 70) {
  const nBox = await page.locator('.react-flow__nodes').boundingBox().catch(() => null);
  if (!nBox || nBox.width < 5) return null;
  const x      = Math.max(rfBox.x, nBox.x - pad);
  const y      = Math.max(rfBox.y, nBox.y - pad);
  const right  = Math.min(rfBox.x + rfBox.width,  nBox.x + nBox.width  + pad);
  const bottom = Math.min(rfBox.y + rfBox.height, nBox.y + nBox.height + pad);
  return { x, y, width: right - x, height: bottom - y };
}

const browser = await chromium.launch({ headless: true });

// ── General view (clean, no connect stmts) ────────────────────────────────────
{
  console.log('── General ─────────────────────────────────────────────────────');
  const ctx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.addInitScript(([t, e]) => {
    localStorage.setItem('sysml-autosave-v2', t);
    localStorage.setItem('sysmlv2-service-endpoint', e);
  }, [GENERAL_EXAMPLE, 'http://localhost:9001']);
  await page.goto('http://localhost:5174');
  await page.waitForTimeout(8000);
  await page.click('button:has-text("General")').catch(() => {});
  await page.waitForTimeout(1500);
  await page.click('button:has-text("Fit")').catch(() => {});
  await page.waitForTimeout(700);

  // Crop to nodes + generous padding so all elements (including right-side part usages) fit
  const rf    = page.locator('.react-flow').first();
  const rfBox = await rf.boundingBox();
  const clip  = rfBox ? await cropToNodes(page, rfBox, 160) : null;
  if (clip && clip.width > 100) {
    await page.screenshot({ path: `${OUT}/general-overview.png`, clip });
    console.log(`  saved: general-overview.png  (${Math.round(clip.width)}×${Math.round(clip.height)})`);
  } else {
    await rf.screenshot({ path: `${OUT}/general-overview.png` });
    const b = await rf.boundingBox();
    console.log(`  saved: general-overview.png  (full RF ${Math.round(b?.width ?? 0)}×${Math.round(b?.height ?? 0)})`);
  }
  await ctx.close();
}

// ── State view (click state machine in Model Explorer, official mode) ─────────
{
  console.log('── State ───────────────────────────────────────────────────────');
  const ctx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.addInitScript(([t, e]) => {
    localStorage.setItem('sysml-autosave-v2', t);
    localStorage.setItem('sysmlv2-service-endpoint', e);
  }, [STATE_EXAMPLE, 'http://localhost:9001']);
  await page.goto('http://localhost:5174');
  // Wait for parse to complete (service round-trip)
  await page.waitForTimeout(10000);

  // Click the state machine entry in the Model Explorer to open State view
  await page.locator('.expl-item-statemachine').first().click().catch(() => {});
  await page.waitForTimeout(1500);

  await page.click('button:has-text("Fit")').catch(() => {});
  await page.waitForTimeout(700);

  const rf    = page.locator('.react-flow').first();
  const rfBox = await rf.boundingBox().catch(() => null);
  const clip  = rfBox ? await cropToNodes(page, rfBox, 80) : null;
  if (clip && clip.width > 50) {
    await page.screenshot({ path: `${OUT}/state-overview.png`, clip });
    console.log(`  saved: state-overview.png  (${Math.round(clip.width)}×${Math.round(clip.height)})`);
  } else {
    // Fallback: crop to the main diagram panel area (exclude editor + inspector)
    const panelClip = { x: 620, y: 45, width: 660, height: 900 };
    await page.screenshot({ path: `${OUT}/state-overview.png`, clip: panelClip });
    console.log('  saved: state-overview.png  (panel fallback)');
  }
  await ctx.close();
}

await browser.close();
console.log('Done.');
process.exit(0);
