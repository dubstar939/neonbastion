// =============================================================
// PROCEDURAL CYBERPUNK CITY GENERATOR
// Zoning system + diverse low-poly buildings + props + roads
// =============================================================
import * as THREE from "three";
import { isOnPath } from "../path";
import { createMiningNode, type MiningNode } from "../systems/resources";

// ── Types ──────────────────────────────────────────────────────
type Zone = "downtown" | "commercial" | "industrial" | "residential" | "park";
type NeonColor = 0x00e5ff | 0xff2bd6 | 0x9d4bff | 0x39ff14 | 0xffaa00;

// Block type used during generation


// ── Deterministic hash ─────────────────────────────────────────
function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return Math.abs(h);
}
function hashF(a: number, b: number): number {
  return (hash(a, b) % 10000) / 10000;
}

// ── Shared Materials ───────────────────────────────────────────
const M = {
  bldg:      (c = 0x0c0c18) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.85, roughness: 0.35 }),
  bldgAlt:   (c = 0x10101e) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.8, roughness: 0.4 }),
  glass:     new THREE.MeshStandardMaterial({ color: 0x0a1e3a, metalness: 0.95, roughness: 0.1, transparent: true, opacity: 0.75 }),
  road:      new THREE.MeshStandardMaterial({ color: 0x0e0e14, metalness: 0.3, roughness: 0.85 }),
  lane:      new THREE.MeshStandardMaterial({ color: 0x444466, metalness: 0.1, roughness: 0.6 }),
  sidewalk:  new THREE.MeshStandardMaterial({ color: 0x18181f, metalness: 0.15, roughness: 0.65 }),
  nCyan:     new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x00e5ff, emissiveIntensity: 2.5 }),
  nMagenta:  new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff2bd6, emissiveIntensity: 2.5 }),
  nPurple:   new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9d4bff, emissiveIntensity: 2.5 }),
  nGreen:    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x39ff14, emissiveIntensity: 2.5 }),
  nAmber:    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffaa00, emissiveIntensity: 2.0 }),
  metal:     new THREE.MeshStandardMaterial({ color: 0x222232, metalness: 0.9, roughness: 0.3 }),
  concrete:  new THREE.MeshStandardMaterial({ color: 0x1a1a24, metalness: 0.1, roughness: 0.7 }),
  trunk:     new THREE.MeshStandardMaterial({ color: 0x1a1208, metalness: 0.3, roughness: 0.8 }),
  foliage:   new THREE.MeshStandardMaterial({ color: 0x0a2a12, emissive: 0x00ff44, emissiveIntensity: 0.12 }),
  holo:      (c: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
};

const NEONS = [M.nCyan, M.nMagenta, M.nPurple, M.nGreen];
function pickNeon(seed: number) { return NEONS[Math.abs(seed) % NEONS.length]; }
function pickNeonColor(seed: number): NeonColor {
  const cs: NeonColor[] = [0x00e5ff, 0xff2bd6, 0x9d4bff, 0x39ff14];
  return cs[Math.abs(seed) % cs.length];
}

// ── Tiny mesh helper ───────────────────────────────────────────
function bx(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}
function cy(rt: number, rb: number, h: number, seg: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
}

// ================================================================
//  BUILDING GENERATORS — 14 distinct types
// ================================================================

// 1. Office Tower — tall box with setback tier + crown neon
function bOfficeTower(h: number, w: number, d: number, nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  // base
  const body = bx(w, h, d, M.bldg());
  body.position.y = h / 2;
  g.add(body);
  // upper setback
  if (h > 8) {
    const s = bx(w * 0.65, h * 0.3, d * 0.65, M.bldg(0x0e0e20));
    s.position.y = h * 0.85;
    g.add(s);
  }
  // neon crown strip
  const crown = bx(w + 0.12, 0.25, d + 0.12, nMat);
  crown.position.y = h;
  g.add(crown);
  // glass panel facade
  const glass = bx(w + 0.02, h * 0.7, d * 0.01, M.glass);
  glass.position.set(0, h * 0.4, d / 2 + 0.02);
  g.add(glass);
  const glass2 = bx(w * 0.01, h * 0.7, d + 0.02, M.glass);
  glass2.position.set(w / 2 + 0.02, h * 0.4, 0);
  g.add(glass2);
  // rooftop antenna
  const ant = cy(0.04, 0.04, h * 0.2, 4, M.metal);
  ant.position.y = h + h * 0.1;
  g.add(ant);
  return g;
}

// 2. Tapered Tower — wider at base, narrows up
function bTaperedTower(h: number, w: number, d: number, nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  // stepped tiers
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const f = 1 - i * 0.22;
    const th = h / tiers;
    const t = bx(w * f, th, d * f, M.bldg(0x0a0a16 + i * 0x020208));
    t.position.y = th * i + th / 2 + 0.5;
    g.add(t);
  }
  // vertical neon ribs
  for (let i = 0; i < 2; i++) {
    const rib = bx(0.08, h * 0.9, 0.08, nMat);
    rib.position.set((i === 0 ? -1 : 1) * w * 0.35, h * 0.5, d * 0.35);
    g.add(rib);
  }
  // top beacon
  const beacon = cy(0.12, 0.12, 0.3, 8, nMat);
  beacon.position.y = h + 0.3;
  g.add(beacon);
  return g;
}

// 3. Cylindrical Tower — round with ring accents
function bCylinderTower(h: number, r: number, nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = cy(r, r, h, 12, M.bldg());
  body.position.y = h / 2;
  g.add(body);
  // neon rings at intervals
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.06, 0.06, 6, 16), nMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = h * (0.25 + i * 0.25);
    g.add(ring);
  }
  // dome top
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.glass);
  dome.position.y = h;
  g.add(dome);
  return g;
}

// 4. Commercial Block — wide with awning and signage
function bCommercialBlock(w: number, d: number, nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const h = 3.5 + hash(w * 7, d * 3) % 4;
  const body = bx(w, h, d, M.bldg(0x0e0e1a));
  body.position.y = h / 2;
  g.add(body);
  // ground floor awning
  const awning = bx(w + 0.4, 0.1, 1.0, M.bldg(0x141428));
  awning.position.set(0, 2.8, d / 2 + 0.5);
  g.add(awning);
  // awning supports
  for (let i = 0; i < 2; i++) {
    const post = cy(0.05, 0.05, 2.8, 4, M.metal);
    post.position.set((i === 0 ? -1 : 1) * (w * 0.4), 1.4, d / 2 + 0.9);
    g.add(post);
  }
  // neon sign on front
  const sign = bx(w * 0.7, 1.0, 0.08, nMat);
  sign.position.set(0, h * 0.7, d / 2 + 0.06);
  g.add(sign);
  // windows (glowing rectangles)
  for (let i = 0; i < Math.floor(w); i++) {
    const win = bx(0.6, 0.8, 0.02, nMat);
    win.position.set(-w / 2 + 0.6 + i * 1.0, h * 0.55, d / 2 + 0.04);
    g.add(win);
  }
  return g;
}

// 5. Strip Mall — long low with covered walkway
function bStripMall(w: number, d: number, _nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const h = 2.8;
  const body = bx(w, h, d, M.bldg(0x101020));
  body.position.y = h / 2;
  g.add(body);
  // covered walkway roof
  const roof = bx(w + 0.3, 0.08, 1.6, M.bldg(0x16162a));
  roof.position.set(0, h + 0.04, d / 2 + 0.8);
  g.add(roof);
  // walkway supports
  const posts = Math.max(2, Math.floor(w / 2));
  for (let i = 0; i < posts; i++) {
    const p = cy(0.04, 0.04, h, 4, M.metal);
    p.position.set(-w / 2 + 1 + i * (w / (posts - 1)), h / 2, d / 2 + 1.5);
    g.add(p);
  }
  // individual storefront signs
  const stores = Math.max(2, Math.floor(w / 2.5));
  for (let i = 0; i < stores; i++) {
    const sc = pickNeon(hash(i, w));
    const s = bx(1.8, 0.5, 0.06, sc);
    s.position.set(-w / 2 + 1.2 + i * (w / stores), h * 0.7, d / 2 + 0.05);
    g.add(s);
  }
  return g;
}

// 6. Warehouse — large flat with loading dock
function bWarehouse(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const h = 3.5;
  const body = bx(w, h, d, M.bldg(0x141410));
  body.position.y = h / 2;
  g.add(body);
  // loading dock platform
  const dock = bx(w * 0.6, 0.6, 1.5, M.concrete);
  dock.position.set(0, 0.3, d / 2 + 0.75);
  g.add(dock);
  // roll-up doors
  for (let i = 0; i < 3; i++) {
    const door = bx(1.5, 2.0, 0.06, M.metal);
    door.position.set(-w * 0.25 + i * w * 0.25, 1.3, d / 2 + 0.04);
    g.add(door);
    // safety strip
    const strip = bx(1.6, 0.12, 0.07, M.nAmber);
    strip.position.set(-w * 0.25 + i * w * 0.25, 2.45, d / 2 + 0.05);
    g.add(strip);
  }
  // roof units
  for (let i = 0; i < 2; i++) {
    const unit = bx(0.8, 0.5, 0.8, M.metal);
    unit.position.set((i === 0 ? -1 : 1) * w * 0.25, h + 0.25, 0);
    g.add(unit);
  }
  return g;
}

// 7. Apartment Block — mid-rise with balcony strips
function bApartment(h: number, w: number, d: number, nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = bx(w, h, d, M.bldg(0x0c0c18));
  body.position.y = h / 2;
  g.add(body);
  // horizontal balcony strips
  const floors = Math.max(2, Math.floor(h / 2.2));
  for (let f = 0; f < floors; f++) {
    const bal = bx(w + 0.3, 0.08, 0.5, M.concrete);
    bal.position.set(0, 2.2 + f * 2.2, d / 2 + 0.25);
    g.add(bal);
    // balcony railing (neon)
    const rail = bx(w + 0.3, 0.06, 0.06, nMat);
    rail.position.set(0, 2.5 + f * 2.2, d / 2 + 0.5);
    g.add(rail);
  }
  // window lights (scattered)
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < Math.floor(w / 1.5); i++) {
      if (hash(i + f * 10, Math.floor(w * 100)) % 3 === 0) continue; // some dark
      const win = bx(0.5, 0.6, 0.02, nMat);
      win.position.set(-w / 2 + 0.8 + i * 1.5, 2.0 + f * 2.2, d / 2 + 0.03);
      g.add(win);
    }
  }
  return g;
}

// 8. Gas Station — canopy + booth
function bGasStation(nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  // booth
  const booth = bx(2.5, 2.5, 2.5, M.bldg(0x12121e));
  booth.position.set(0, 1.25, -2);
  g.add(booth);
  // canopy
  const canopy = bx(5, 0.15, 4, M.bldg(0x18182a));
  canopy.position.set(0, 3.5, 1);
  g.add(canopy);
  // canopy supports
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const p = cy(0.06, 0.06, 3.5, 4, M.metal);
      p.position.set(sx * 2, 1.75, 1 + sz * 1.5);
      g.add(p);
    }
  }
  // neon edge on canopy
  const edge = bx(5.1, 0.15, 0.08, nMat);
  edge.position.set(0, 3.5, 3.02);
  g.add(edge);
  // pump islands
  for (const sx of [-1, 1]) {
    const pump = bx(0.5, 1.0, 0.4, M.metal);
    pump.position.set(sx * 1.2, 0.5, 1);
    g.add(pump);
  }
  return g;
}

// 9. Restaurant — small with angled signage
function bRestaurant(nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = bx(3, 2.8, 3.5, M.bldg(0x101020));
  body.position.y = 1.4;
  g.add(body);
  // angled roof element
  const roof = bx(3.2, 0.15, 1.2, M.bldg(0x16162a));
  roof.position.set(0, 3.0, -0.8);
  roof.rotation.x = -0.2;
  g.add(roof);
  // big neon sign
  const sign = bx(2.5, 1.5, 0.08, nMat);
  sign.position.set(0, 4.2, -0.3);
  sign.rotation.x = -0.2;
  g.add(sign);
  // sign poles
  for (const sx of [-1, 1]) {
    const pole = cy(0.04, 0.04, 2.5, 4, M.metal);
    pole.position.set(sx * 1.0, 2.9, -0.3);
    g.add(pole);
  }
  // door
  const door = bx(0.9, 1.8, 0.06, M.glass);
  door.position.set(0, 0.9, 1.78);
  g.add(door);
  return g;
}

// 10. Parking Garage — open framework with visible ramps
function bParkingGarage(h: number, w: number, d: number, nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const floors = Math.max(2, Math.floor(h / 2.5));
  for (let f = 0; f < floors; f++) {
    const y = f * 2.5 + 1.25;
    // floor slab
    const slab = bx(w, 0.2, d, M.concrete);
    slab.position.y = f * 2.5 + 0.1;
    g.add(slab);
    // corner pillars
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const pillar = bx(0.2, 2.5, 0.2, M.metal);
        pillar.position.set(sx * (w / 2 - 0.1), y, sz * (d / 2 - 0.1));
        g.add(pillar);
      }
    }
    // neon edge on each floor
    const edge = bx(w + 0.08, 0.06, 0.06, nMat);
    edge.position.set(0, f * 2.5 + 2.4, d / 2);
    g.add(edge);
  }
  return g;
}

// 11. Neon Storefront — narrow with oversized sign
function bNeonStorefront(nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = bx(2.2, 4, 2.8, M.bldg(0x0e0e1c));
  body.position.y = 2;
  g.add(body);
  // oversized sign (extends beyond building)
  const sign = bx(3.0, 2.0, 0.06, nMat);
  sign.position.set(0, 4.8, 1.42);
  g.add(sign);
  // sign frame
  const frame = bx(3.2, 2.2, 0.04, M.metal);
  frame.position.set(0, 4.8, 1.41);
  g.add(frame);
  // glowing door
  const door = bx(0.8, 1.6, 0.04, nMat);
  door.position.set(0, 0.8, 1.42);
  g.add(door);
  return g;
}

// 12. Industrial Unit — flat with chimney stack
function bIndustrialUnit(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const h = 2.8;
  const body = bx(w, h, d, M.bldg(0x141412));
  body.position.y = h / 2;
  g.add(body);
  // saw-tooth roof
  for (let i = 0; i < Math.floor(w / 2); i++) {
    const tooth = bx(1.8, 0.8, d * 0.4, M.bldg(0x181820));
    tooth.position.set(-w / 2 + 1.2 + i * 2, h + 0.2, d * 0.2);
    tooth.rotation.z = (i % 2) * 0.15;
    g.add(tooth);
  }
  // chimney stack
  const chimney = cy(0.25, 0.3, 3.5, 6, M.metal);
  chimney.position.set(w * 0.3, h + 1.5, -d * 0.3);
  g.add(chimney);
  // hazard neon
  const strip = bx(w + 0.08, 0.1, 0.08, M.nAmber);
  strip.position.set(0, h, d / 2);
  g.add(strip);
  return g;
}

// 13. Hover Pad — futuristic landing platform
function bHoverPad(nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  // platform ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2, 0.15, 8, 16), nMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.15;
  g.add(ring);
  // center pad
  const pad = cy(1.8, 1.8, 0.1, 12, M.bldg(0x0a0a18));
  pad.position.y = 0.05;
  g.add(pad);
  // hovering drone above
  const drone = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), nMat);
  drone.position.y = 3;
  (drone as any).userData.hover = true;
  g.add(drone);
  // support struts
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const strut = cy(0.04, 0.04, 3, 4, M.metal);
    strut.position.set(Math.cos(a) * 1.5, 1.5, Math.sin(a) * 1.5);
    g.add(strut);
  }
  return g;
}

// 14. Landmark Spire — tall neon beacon for downtown
function bLandmarkSpire(h: number, nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  // tapered body
  const body = cy(0.6, 1.2, h, 8, M.bldg(0x0a0a16));
  body.position.y = h / 2;
  g.add(body);
  // neon spiral ribs
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const rib = bx(0.08, h * 0.95, 0.08, nMat);
    rib.position.set(Math.cos(a) * 0.7, h * 0.5, Math.sin(a) * 0.7);
    rib.rotation.y = a;
    g.add(rib);
  }
  // glowing top
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), nMat);
  top.position.y = h + 0.2;
  g.add(top);
  // floating halo
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.06, 6, 24), nMat);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = h * 0.7;
  g.add(halo);
  return g;
}

// ================================================================
//  PROP GENERATORS
// ================================================================

function pStreetlight(nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const pole = cy(0.04, 0.06, 3.5, 4, M.metal);
  pole.position.y = 1.75;
  g.add(pole);
  // arm
  const arm = bx(0.8, 0.06, 0.06, M.metal);
  arm.position.set(0.4, 3.5, 0);
  g.add(arm);
  // lamp
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), nMat);
  lamp.position.set(0.8, 3.5, 0);
  g.add(lamp);
  return g;
}

function pNeonSign(w: number, h: number, nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const sign = bx(w, h, 0.06, nMat);
  sign.position.y = 3 + h / 2;
  g.add(sign);
  // supports
  for (const sx of [-1, 1]) {
    const bar = cy(0.03, 0.03, 0.6, 4, M.metal);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(sx * w * 0.3, 3, 0.04);
    g.add(bar);
  }
  return g;
}

function pBench(): THREE.Group {
  const g = new THREE.Group();
  const seat = bx(1.2, 0.08, 0.4, M.concrete);
  seat.position.y = 0.4;
  g.add(seat);
  for (const sx of [-1, 1]) {
    const leg = bx(0.06, 0.4, 0.06, M.metal);
    leg.position.set(sx * 0.5, 0.2, 0);
    g.add(leg);
  }
  const back = bx(1.2, 0.4, 0.06, M.metal);
  back.position.set(0, 0.65, -0.18);
  g.add(back);
  return g;
}

function pTrashCan(): THREE.Group {
  const g = new THREE.Group();
  const can = cy(0.15, 0.18, 0.6, 6, M.metal);
  can.position.y = 0.3;
  g.add(can);
  return g;
}

function pVendingMachine(nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = bx(0.6, 1.2, 0.5, M.bldg(0x141428));
  body.position.y = 0.6;
  g.add(body);
  const screen = bx(0.4, 0.5, 0.02, nMat);
  screen.position.set(0, 0.8, 0.26);
  g.add(screen);
  return g;
}

function pBusStop(nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  // shelter roof
  const roof = bx(2.5, 0.08, 1.2, M.bldg(0x18182a));
  roof.position.y = 2.8;
  g.add(roof);
  // posts
  for (const sx of [-1, 1]) {
    const p = cy(0.04, 0.04, 2.8, 4, M.metal);
    p.position.set(sx * 1.1, 1.4, 0);
    g.add(p);
  }
  // neon strip
  const strip = bx(2.5, 0.06, 0.06, nMat);
  strip.position.set(0, 2.8, 0.6);
  g.add(strip);
  return g;
}

function pCar(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = bx(1.0, 0.4, 0.5, new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.4 }));
  body.position.y = 0.3;
  g.add(body);
  const cabin = bx(0.5, 0.3, 0.45, M.glass);
  cabin.position.set(-0.05, 0.6, 0);
  g.add(cabin);
  // headlights
  for (const sz of [-1, 1]) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), M.nCyan);
    light.position.set(0.5, 0.3, sz * 0.18);
    g.add(light);
  }
  return g;
}

function pBus(nMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = bx(2.5, 0.8, 0.7, M.bldg(0x141428));
  body.position.y = 0.6;
  g.add(body);
  // windows
  for (let i = 0; i < 4; i++) {
    const w = bx(0.35, 0.3, 0.02, M.glass);
    w.position.set(-0.8 + i * 0.55, 0.8, 0.36);
    g.add(w);
  }
  // neon stripe
  const strip = bx(2.52, 0.08, 0.02, nMat);
  strip.position.set(0, 0.35, 0.36);
  g.add(strip);
  return g;
}

function pTree(trunkH: number, foliageR: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = cy(0.08, 0.1, trunkH, 5, M.trunk);
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(foliageR, foliageR * 2, 6), M.foliage);
  canopy.position.y = trunkH + foliageR * 0.7;
  g.add(canopy);
  return g;
}

function pACUnit(): THREE.Group {
  const g = new THREE.Group();
  const unit = bx(0.6, 0.35, 0.5, M.metal);
  g.add(unit);
  const vent = bx(0.5, 0.08, 0.02, M.bldg(0x0a0a12));
  vent.position.set(0, 0.15, 0.26);
  g.add(vent);
  return g;
}

function pAntenna(): THREE.Group {
  const g = new THREE.Group();
  const pole = cy(0.02, 0.03, 1.5, 4, M.metal);
  pole.position.y = 0.75;
  g.add(pole);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), M.nMagenta);
  light.position.y = 1.55;
  g.add(light);
  return g;
}

// ================================================================
//  ROAD SYSTEM
// ================================================================

function addRoads(scene: THREE.Scene) {
  const roadGroup = new THREE.Group();
  roadGroup.name = "roads";

  const roadW = 2.2;
  const positions: number[] = [];
  // grid of roads, skip center where game path runs
  for (let p = -50; p <= 50; p += 8) {
    if (p > -14 && p < 14) continue; // skip central area
    positions.push(p);
  }

  for (const p of positions) {
    // east-west road at z=p
    const ew = bx(100, 0.02, roadW, M.road);
    ew.position.set(0, 0.01, p);
    roadGroup.add(ew);
    // lane marking (dashed center line)
    for (let x = -48; x < 48; x += 3) {
      if (x > -14 && x < 14) continue;
      const dash = bx(1.2, 0.01, 0.08, M.lane);
      dash.position.set(x, 0.025, p);
      roadGroup.add(dash);
    }
    // north-south road at x=p
    const ns = bx(roadW, 0.02, 100, M.road);
    ns.position.set(p, 0.01, 0);
    roadGroup.add(ns);
    for (let z = -48; z < 48; z += 3) {
      if (z > -14 && z < 14) continue;
      const dash = bx(0.08, 0.01, 1.2, M.lane);
      dash.position.set(p, 0.025, z);
      roadGroup.add(dash);
    }
    // sidewalks along roads
    for (const side of [-1, 1]) {
      const sw = bx(100, 0.05, 0.5, M.sidewalk);
      sw.position.set(0, 0.025, p + side * (roadW / 2 + 0.25));
      roadGroup.add(sw);
      const sw2 = bx(0.5, 0.05, 100, M.sidewalk);
      sw2.position.set(p + side * (roadW / 2 + 0.25), 0.025, 0);
      roadGroup.add(sw2);
    }
  }
  scene.add(roadGroup);
}

// ================================================================
//  ZONING
// ================================================================

function getZone(x: number, z: number): Zone {
  const dist = Math.sqrt(x * x + z * z);
  if (dist < 16) return "park"; // inner ring is clear/game area

  // North sector (behind spawn point, most visible) → Downtown
  if (z < -18 && Math.abs(x) < 35) {
    if (dist < 32) return "downtown";
    return "commercial";
  }
  // NE / E sector → Commercial corridors
  if (x > 18 && z > -18 && z < 35) return "commercial";
  // NW sector → Commercial/Mixed
  if (x < -18 && z > -35 && z < -18) return "commercial";
  // SW sector → Industrial
  if (x < -18 && z > 0) return "industrial";
  // SE sector → Residential
  if (x > 18 && z > 18) return "residential";
  // South center → Residential
  if (z > 18 && Math.abs(x) < 18) return "residential";

  // park patches (scattered small areas)
  if (dist > 22 && dist < 30 && hash(Math.floor(x), Math.floor(z)) % 12 === 0) return "park";

  return "commercial";
}

// Building palette per zone
function pickBuildingForZone(zone: Zone, seed: number): { build: (w: number, d: number, n: THREE.Material) => THREE.Group; minW: number; maxW: number; minD: number; maxD: number; minH: number; maxH: number } | null {
  const n = pickNeon(seed);
  const h = hash(seed, seed * 3) % 10;
  switch (zone) {
    case "downtown":
      if (h < 3) return { build: (w, d, _n) => bOfficeTower(12 + hash(seed, 1) % 16, w, d, n), minW: 2.5, maxW: 4.5, minD: 2.5, maxD: 4.5, minH: 12, maxH: 28 };
      if (h < 5) return { build: (w, d, _n) => bTaperedTower(10 + hash(seed, 2) % 12, w, d, n), minW: 3, maxW: 5, minD: 3, maxD: 5, minH: 10, maxH: 22 };
      if (h < 7) return { build: (w, d, _n) => bCylinderTower(10 + hash(seed, 3) % 14, Math.min(w, d) * 0.4, n), minW: 3.5, maxW: 5, minD: 3.5, maxD: 5, minH: 10, maxH: 24 };
      if (h < 9) return { build: (w, d, _n) => bParkingGarage(8 + hash(seed, 4) % 6, w, d, n), minW: 3, maxW: 5, minD: 3, maxD: 5, minH: 8, maxH: 14 };
      return { build: () => bNeonStorefront(n), minW: 2, maxW: 2.5, minD: 2.5, maxD: 3, minH: 4, maxH: 4 };
    case "commercial":
      if (h < 3) return { build: (w, d, _n) => bCommercialBlock(w, d, n), minW: 3, maxW: 5.5, minD: 3, maxD: 5, minH: 4, maxH: 8 };
      if (h < 5) return { build: (w, d, _n) => bStripMall(w, d, n), minW: 4, maxW: 7, minD: 2.5, maxD: 3.5, minH: 3, maxH: 3 };
      if (h < 7) return { build: () => bRestaurant(n), minW: 2.5, maxW: 3.5, minD: 3, maxD: 4, minH: 3, maxH: 3 };
      if (h < 8) return { build: () => bGasStation(n), minW: 4, maxW: 5, minD: 4, maxD: 5, minH: 3.5, maxH: 3.5 };
      if (h < 9) return { build: () => bNeonStorefront(n), minW: 2, maxW: 2.5, minD: 2.5, maxD: 3, minH: 4, maxH: 4 };
      return { build: (w, d, _n) => bOfficeTower(6 + hash(seed, 5) % 6, w, d, n), minW: 2.5, maxW: 4, minD: 2.5, maxD: 4, minH: 6, maxH: 12 };
    case "industrial":
      if (h < 5) return { build: (w, d, _n) => bWarehouse(w, d), minW: 4, maxW: 6, minD: 3, maxD: 5, minH: 3, maxH: 4 };
      if (h < 8) return { build: (w, d, _n) => bIndustrialUnit(w, d), minW: 3, maxW: 5, minD: 2.5, maxD: 4, minH: 3, maxH: 3 };
      return { build: (w, d, _n) => bParkingGarage(5, w, d, n), minW: 3, maxW: 4.5, minD: 3, maxD: 4, minH: 5, maxH: 5 };
    case "residential":
      if (h < 5) return { build: (w, d, _n) => bApartment(5 + hash(seed, 6) % 8, w, d, n), minW: 2.5, maxW: 4.5, minD: 2.5, maxD: 4, minH: 5, maxH: 13 };
      if (h < 7) return { build: (w, d, _n) => bCommercialBlock(w, d, n), minW: 2.5, maxW: 4, minD: 2.5, maxD: 3.5, minH: 3, maxH: 6 };
      if (h < 9) return { build: () => bRestaurant(n), minW: 2.5, maxW: 3, minD: 3, maxD: 3.5, minH: 3, maxH: 3 };
      return { build: () => bNeonStorefront(n), minW: 2, maxW: 2.5, minD: 2.5, maxD: 3, minH: 4, maxH: 4 };
    case "park":
      return null; // parks don't get buildings
  }
}

// ================================================================
//  ELEVATED HIGHWAY / MONORAIL
// ================================================================

function addElevatedHighway(scene: THREE.Scene) {
  const group = new THREE.Group();
  // east-west highway at z = -30, elevated
  const y = 7;
  const segments = 20;
  for (let i = -segments; i < segments; i++) {
    // skip over game area
    if (i > -3 && i < 3) continue;
    const seg = bx(5, 0.3, 3, M.bldg(0x14141e));
    seg.position.set(i * 5 + 2.5, y, -32);
    group.add(seg);
    // neon edge
    const edge = bx(5.02, 0.06, 0.06, M.nCyan);
    edge.position.set(i * 5 + 2.5, y + 0.18, -30.5);
    group.add(edge);
    // support pillars
    if (i % 2 === 0) {
      for (const sx of [-1, 1]) {
        const pillar = cy(0.15, 0.2, y, 6, M.metal);
        pillar.position.set(i * 5 + 2.5, y / 2, -32 + sx * 1.2);
        group.add(pillar);
      }
    }
  }
  // monorail beam along x = -32, north-south
  for (let i = -segments; i < segments; i++) {
    const seg = bx(0.4, 0.25, 5, M.metal);
    seg.position.set(-34, 9, i * 5 + 2.5);
    group.add(seg);
    const glow = bx(0.06, 0.06, 5.02, M.nMagenta);
    glow.position.set(-34, 9.15, i * 5 + 2.5);
    group.add(glow);
    if (i % 3 === 0) {
      const support = cy(0.1, 0.15, 9, 6, M.metal);
      support.position.set(-34, 4.5, i * 5 + 2.5);
      group.add(support);
    }
  }
  scene.add(group);
}

// ================================================================
//  MAIN CITY GENERATOR
// ================================================================

export function generateCity(scene: THREE.Scene) {
  // 1. Roads
  addRoads(scene);

  // 2. Buildings — iterate over city blocks between road grid
  const roadPositions: number[] = [];
  for (let p = -50; p <= 50; p += 8) {
    if (p > -14 && p < 14) continue;
    roadPositions.push(p);
  }

  const roadW = 2.2;
  const placedBoxes: { x: number; z: number; hw: number; hd: number }[] = [];

  for (let ri = 0; ri < roadPositions.length - 1; ri++) {
    for (let rj = 0; rj < roadPositions.length - 1; rj++) {
      const x0 = roadPositions[ri] + roadW / 2 + 0.6;  // inset from road+sidewalk
      const z0 = roadPositions[rj] + roadW / 2 + 0.6;
      const x1 = roadPositions[ri + 1] - roadW / 2 - 0.6;
      const z1 = roadPositions[rj + 1] - roadW / 2 - 0.6;

      if (x1 - x0 < 1.5 || z1 - z0 < 1.5) continue; // too small

      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;

      // skip if block center is on the game path
      if (isOnPath(cx, cz, 3.5)) continue;
      if (isOnPath((x0 + x1) / 2, (z0 + z1) / 2, 2.0)) continue;

      const zone = getZone(cx, cz);
      if (zone === "park") {
        // place trees in park blocks
        const treeCount = 3 + hash(ri, rj) % 4;
        for (let t = 0; t < treeCount; t++) {
          const tx = x0 + 0.8 + hashF(ri * 10 + t, rj) * (x1 - x0 - 1.6);
          const tz = z0 + 0.8 + hashF(ri, rj * 10 + t) * (z1 - z0 - 1.6);
          const tree = pTree(1.5 + hash(ri + t, rj + t) % 3, 0.8 + hash(t, ri * rj) % 3 * 0.3);
          tree.position.set(tx, 0, tz);
          scene.add(tree);
        }
        // park bench
        const bench = pBench();
        bench.position.set(cx, 0, cz);
        scene.add(bench);
        continue;
      }

      const bw = x1 - x0;
      const bd = z1 - z0;

      // determine number of buildings in this block
      const buildingCount = zone === "downtown" ? 1 : (1 + hash(ri, rj) % 2);
      const seed = hash(ri * 137, rj * 251);

      for (let b = 0; b < buildingCount; b++) {
        const bSeed = seed + b * 777;
        const def = pickBuildingForZone(zone, bSeed);
        if (!def) continue;

        // compute building size within block
        const margin = 0.3;
        const maxW = bw / buildingCount - margin * 2;
        const maxD = bd - margin * 2;
        const w = Math.min(def.maxW, Math.max(def.minW, maxW));
        const d = Math.min(def.maxD, Math.max(def.minD, maxD));
        if (w < def.minW || d < def.minD) continue;

        // position within block
        const bx_off = buildingCount === 1 ? 0 : (b - (buildingCount - 1) / 2) * (bw / buildingCount);
        const px = cx + bx_off;
        const pz = cz;

        // overlap check
        const hw = w / 2 + 0.1;
        const hd = d / 2 + 0.1;
        let overlaps = false;
        for (const pb of placedBoxes) {
          if (Math.abs(px - pb.x) < hw + pb.hw && Math.abs(pz - pb.z) < hd + pb.hd) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) continue;
        placedBoxes.push({ x: px, z: pz, hw, hd });

        const nMat = pickNeon(bSeed);
        const bMesh = def.build(w, d, nMat);
        bMesh.position.set(px, 0, pz);

        // occasional rotation for variety
        if (hash(bSeed, 99) % 3 === 0) bMesh.rotation.y = Math.PI / 2;

        scene.add(bMesh);

        // rooftop props (on taller buildings)
        if (hash(bSeed, 42) % 3 === 0) {
          const ac = pACUnit();
          ac.position.set(px + (hash(bSeed, 1) % 2 - 0.5) * w * 0.5, def.minH + 0.18, pz);
          scene.add(ac);
        }
        if (hash(bSeed, 77) % 4 === 0) {
          const ant = pAntenna();
          ant.position.set(px, def.minH, pz + (hash(bSeed, 2) % 2 - 0.5) * d * 0.3);
          scene.add(ant);
        }
      }

      // streetlights along block edges
      const lightSpacing = 6;
      const nMat = pickNeon(seed);
      for (let lx = x0 + 1; lx < x1; lx += lightSpacing) {
        if (hash(Math.floor(lx * 10), rj) % 3 !== 0) continue;
        const sl = pStreetlight(nMat);
        sl.position.set(lx, 0, z0 - 0.5);
        scene.add(sl);
      }
      for (let lz = z0 + 1; lz < z1; lz += lightSpacing) {
        if (hash(ri, Math.floor(lz * 10)) % 3 !== 0) continue;
        const sl = pStreetlight(nMat);
        sl.position.set(x0 - 0.5, 0, lz);
        scene.add(sl);
      }

      // vehicles parked along roads in commercial/industrial
      if (zone === "commercial" || zone === "industrial") {
        if (hash(ri + 1, rj + 1) % 3 === 0) {
          const car = pCar(0x1a1a28);
          car.position.set(x0 + 1 + hashF(ri * 3, rj * 7) * (bw - 2), 0, z0 - 1.2);
          car.rotation.y = Math.PI / 2;
          scene.add(car);
        }
        if (hash(ri + 2, rj + 2) % 5 === 0) {
          const bus = pBus(nMat);
          bus.position.set(x0 + 1, 0, z0 - 1.2);
          scene.add(bus);
        }
      }

      // trees along sidewalks in residential
      if (zone === "residential") {
        const treeCount = 1 + hash(ri, rj) % 3;
        for (let t = 0; t < treeCount; t++) {
          const tx = x0 + 0.5 + hashF(ri + t * 3, rj) * (bw - 1);
          const tz = z0 - 0.8; // on sidewalk, not in road
          if (isOnPath(tx, tz, 1.0)) continue;
          const tree = pTree(1.2 + hash(ri + t, rj) % 2, 0.7 + hash(t, ri) % 2 * 0.3);
          tree.position.set(tx, 0, tz);
          scene.add(tree);
        }
      }

      // vending machines near commercial buildings
      if (zone === "commercial" && hash(ri * 5, rj * 5) % 4 === 0) {
        const vm = pVendingMachine(pickNeon(seed + 1));
        vm.position.set(x0 + 0.5, 0, z0 - 0.5);
        scene.add(vm);
      }

      // bus stops on major roads in commercial/residential
      if ((zone === "commercial" || zone === "residential") && hash(ri * 9, rj * 9) % 7 === 0) {
        const bs = pBusStop(pickNeon(seed + 2));
        bs.position.set(cx, 0, z0 - 1.5);
        scene.add(bs);
      }

      // neon signs on commercial buildings
      if (zone === "commercial" && hash(ri * 11, rj * 11) % 3 === 0) {
        const ns = pNeonSign(1.5 + hashF(ri, rj) * 1.5, 0.8 + hashF(rj, ri) * 0.8, pickNeon(seed + 3));
        ns.position.set(x0 + 1, 0, z1 + 0.5);
        scene.add(ns);
      }

      // trash cans near commercial/restaurant
      if ((zone === "commercial" || zone === "residential") && hash(ri * 13, rj * 13) % 3 === 0) {
        const tc = pTrashCan();
        tc.position.set(x0 + 0.3, 0, z0 - 0.6);
        scene.add(tc);
      }
    }
  }

  // 3. Landmark spire in downtown
  const spire = bLandmarkSpire(20, M.nCyan);
  spire.position.set(5, 0, -35);
  scene.add(spire);

  const spire2 = bLandmarkSpire(16, M.nMagenta);
  spire2.position.set(-8, 0, -38);
  scene.add(spire2);

  // 4. Hover pads (futuristic element)
  const hp1 = bHoverPad(M.nGreen);
  hp1.position.set(20, 0, -25);
  scene.add(hp1);

  const hp2 = bHoverPad(M.nPurple);
  hp2.position.set(-22, 0, -22);
  scene.add(hp2);

  // 5. Elevated highway + monorail
  addElevatedHighway(scene);

  // 6. Floating holographic billboards
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const dist = 24 + hash(i, 42) % 15;
    const px = Math.cos(a) * dist;
    const pz = Math.sin(a) * dist;
    if (isOnPath(px, pz, 5)) continue;
    const color = pickNeonColor(i * 17);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(3 + hash(i, 1) % 3, 1.5 + hash(i, 2) % 2),
      M.holo(color)
    );
    board.position.set(px, 8 + hash(i, 3) % 6, pz);
    board.lookAt(0, board.position.y, 0);
    scene.add(board);
  }
}
