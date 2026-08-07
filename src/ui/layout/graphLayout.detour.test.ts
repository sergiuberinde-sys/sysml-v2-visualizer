import { describe, it, expect } from 'vitest';
import { layoutWiringElk, type WiringElkNode, type WiringElkPort, type WiringElkEdge } from './graphLayout';

// Reproduces the DrivingSafetyDomain "expand uC1" case: an inner leaf port promoted inside an
// expanded compound is wired straight out to an ANCESTOR boundary, crossing a box that sits
// between them. Such a cross-frame edge cannot be handed to ELK (it throws "Referenced shape
// does not exist"), so it is passed as a `detourEdge` and must be routed AROUND the box.
describe('layoutWiringElk cross-frame detour edges', () => {
  // Top scope: boundary port B on the right; part uC1 (expanded, holds leaf `far`); a top part
  // `mid` layered BETWEEN uC1 and B by two ELK edges (uC1→mid→B). The detour wire runs from
  // far's inner port straight to B — horizontally through `mid`.
  const boundaryPorts: WiringElkPort[] = [{ id: 'wsport-B', side: 'right' }];
  const parts: WiringElkNode[] = [
    {
      id: 'wpart-uC1', width: 172, height: 120,
      ports: [{ id: 'wpart-uC1::wsport-fp', side: 'right' }],
      children: [
        { id: 'wpart-uC1::wpart-far', width: 120, height: 60,
          ports: [{ id: 'wpart-uC1::wpart-far::p', side: 'right' }] },
      ],
      childEdges: [],
    },
    { id: 'wpart-mid', width: 172, height: 96,
      ports: [{ id: 'wpart-mid::q', side: 'left' }, { id: 'wpart-mid::r', side: 'right' }] },
  ];
  // Layering edges (uC1 → mid → B) so `mid` lands between the inner port and the boundary.
  const edges: WiringElkEdge[] = [
    { id: 'e-layer1', sourcePort: 'wpart-uC1::wsport-fp', targetPort: 'wpart-mid::q' },
    { id: 'e-layer2', sourcePort: 'wpart-mid::r', targetPort: 'wsport-B' },
  ];
  const detour: WiringElkEdge[] = [
    { id: 'e-detour', sourcePort: 'wpart-uC1::wpart-far::p', targetPort: 'wsport-B' },
  ];

  it('lays out without throwing and routes the cross-frame wire around the middle box', async () => {
    const res = await layoutWiringElk(parts, boundaryPorts, edges, detour);

    // The detour edge got an explicit multi-point route (a bend around `mid`), not a straight
    // 2-point channel line that would cut through the box.
    const route = res.routes.get('e-detour');
    expect(route, 'detour edge should have a route').toBeDefined();
    expect(route!.length).toBeGreaterThan(2);

    // Absolute rect of the obstacle box `mid`.
    const mp = res.nodePos.get('wpart-mid')!;
    const ms = res.nodeSize.get('wpart-mid') ?? { w: 172, h: 96 };
    const inside = (pt: { x: number; y: number }) =>
      pt.x > mp.x + 6 && pt.x < mp.x + ms.w - 6 && pt.y > mp.y + 6 && pt.y < mp.y + ms.h - 6;

    // No segment of the routed polyline passes through the interior of `mid`.
    const hits = route!.some((p, i) => {
      if (i === 0) return false;
      const a = route![i - 1];
      for (let t = 0; t <= 1; t += 0.02) {
        if (inside({ x: a.x + (p.x - a.x) * t, y: a.y + (p.y - a.y) * t })) return true;
      }
      return false;
    });
    expect(hits, 'routed wire must not cross the interior of the obstacle box').toBe(false);
  });

  it('gives a non-crossing wire an explicit route that still exits its port horizontally (stub)', async () => {
    // Same graph but the wire targets uC1's OWN frame port — no box in between. It no longer needs a
    // detour, but under the port-stub rule it still gets an explicit orthogonal route that leaves the
    // leaf port horizontally, so it obeys the rule and joins the de-overlap pass (rather than a bare
    // channel line).
    const detourClear: WiringElkEdge[] = [
      { id: 'e-clear', sourcePort: 'wpart-uC1::wpart-far::p', targetPort: 'wpart-uC1::wsport-fp' },
    ];
    const res = await layoutWiringElk(parts, boundaryPorts, edges, detourClear);
    const route = res.routes.get('e-clear');
    expect(route, 'non-crossing wire should still get a stubbed route').toBeDefined();
    // Leaves its port horizontally (first segment flat).
    expect(Math.abs(route![0].y - route![1].y) < 1 && Math.abs(route![0].x - route![1].x) > 4).toBe(true);
  });

  it('routes a delegation wire AROUND its own box when the port faces away from the boundary', async () => {
    // farSgmii's sgmiiTx case: an inner leaf port sits on the RIGHT of its box, but its ancestor
    // boundary is on the LEFT — so a straight line would cut through the box. The wire must bend
    // around its own source box rather than through it.
    const bLeft: WiringElkPort[] = [{ id: 'wsport-B', side: 'left' }];
    const compound: WiringElkNode[] = [{
      id: 'wpart-uC1', width: 240, height: 160,
      ports: [{ id: 'wpart-uC1::wsport-fp', side: 'left' }],
      children: [
        { id: 'wpart-uC1::wpart-far', width: 160, height: 90,
          ports: [{ id: 'wpart-uC1::wpart-far::p', side: 'right' }] },  // port on the RIGHT
      ],
      childEdges: [],
    }];
    const detourAway: WiringElkEdge[] = [
      { id: 'e-away', sourcePort: 'wpart-uC1::wpart-far::p', targetPort: 'wsport-B' },  // → LEFT boundary
    ];
    const res = await layoutWiringElk(compound, bLeft, [], detourAway);
    const route = res.routes.get('e-away');
    expect(route, 'far-side delegation wire should be explicitly routed').toBeDefined();
    expect(route!.length).toBeGreaterThan(2);

    // The routed polyline must not pass through the interior of its own source box `far`.
    const fp = res.nodePos.get('wpart-uC1::wpart-far')!;
    const fs = res.nodeSize.get('wpart-uC1::wpart-far') ?? { w: 160, h: 90 };
    const up = res.nodePos.get('wpart-uC1') ?? { x: 0, y: 0 };   // far's pos is uC1-relative
    const ax = up.x + fp.x, ay = up.y + fp.y;
    const inside = (pt: { x: number; y: number }) =>
      pt.x > ax + 6 && pt.x < ax + fs.w - 6 && pt.y > ay + 6 && pt.y < ay + fs.h - 6;
    const hits = route!.some((p, i) => {
      if (i === 0) return false;
      const a = route![i - 1];
      for (let t = 0; t <= 1; t += 0.02) if (inside({ x: a.x + (p.x - a.x) * t, y: a.y + (p.y - a.y) * t })) return true;
      return false;
    });
    expect(hits, 'wire must route around its own box, not through it').toBe(false);

    // Port-stub rule: the wire leaves its RIGHT-side port horizontally (first segment flat) and
    // enters the LEFT boundary horizontally (last segment flat), each clearing the shape first.
    const flat = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.y - b.y) < 1 && Math.abs(a.x - b.x) > 4;
    expect(flat(route![0], route![1]), 'wire must exit its port horizontally').toBe(true);
    expect(flat(route![route!.length - 2], route![route!.length - 1]), 'wire must enter the boundary horizontally').toBe(true);
    // The source stub heads OUTWARD (rightward) off the right-side port before turning.
    expect(route![1].x).toBeGreaterThan(route![0].x);
  });
});
