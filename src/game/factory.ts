// =============================================================
// Low-poly mesh factories — detailed multi-part models with
// emissive neon accents, animated joints, and level-scaling.
// =============================================================

import * as THREE from "three";
import { TOWERS, type TowerKind } from "./data/towers";
import type { EnemyDef } from "./data/enemies";

// Reusable shared geometries / materials cache for perf
const _geoCache = new Map<string, THREE.BufferGeometry>();
function geo<T extends THREE.BufferGeometry>(key: string, factory: () => T): T {
  let g = _geoCache.get(key) as T | undefined;
  if (!g) { g = factory(); _geoCache.set(key, g); }
  return g;
}

const matMetal = (color: number, em = 0, emI = 0) =>
  new THREE.MeshStandardMaterial({
    color, emissive: em, emissiveIntensity: emI,
    metalness: 0.85, roughness: 0.35,
  });

const matEmissive = (color: number, intensity = 2) =>
  new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: color, emissiveIntensity: intensity,
    metalness: 0.2, roughness: 0.4,
  });

const matCarbon = () =>
  new THREE.MeshStandardMaterial({
    color: 0x14141c, metalness: 0.9, roughness: 0.55,
  });

// =============================================================
// TOWER MESHES — each is a Group with a rotating "head" subgroup
// =============================================================

export function buildTowerMesh(kind: TowerKind, level: number): THREE.Group {
  const def = TOWERS[kind];
  const group = new THREE.Group();
  const accent = def.color;
  const baseCol = def.baseColor;

  // ---- Hex tech base (3 stacked plates) ----
  const basePlate = new THREE.Mesh(
    geo(`base-l-${baseCol}`, () => new THREE.CylinderGeometry(1.05, 1.2, 0.18, 6)),
    matMetal(baseCol, accent, 0.3)
  );
  basePlate.position.y = 0.09;
  group.add(basePlate);

  const basePlate2 = new THREE.Mesh(
    geo(`base-m-${baseCol}`, () => new THREE.CylinderGeometry(0.92, 1.0, 0.12, 6)),
    matMetal(0x0a0a14, accent, 0.4)
  );
  basePlate2.position.y = 0.24;
  group.add(basePlate2);

  // glowing inner ring
  const ring = new THREE.Mesh(
    geo(`base-ring`, () => new THREE.TorusGeometry(0.78, 0.05, 8, 24)),
    matEmissive(accent, 1.8)
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.32;
  group.add(ring);

  // 3 small glow nodes on the base
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const node = new THREE.Mesh(
      geo("base-node", () => new THREE.SphereGeometry(0.07, 8, 6)),
      matEmissive(accent, 2.5)
    );
    node.position.set(Math.cos(a) * 0.95, 0.18, Math.sin(a) * 0.95);
    group.add(node);
  }

  // ---- Pillar / rotating yoke ----
  const pillar = new THREE.Mesh(
    geo("pillar", () => new THREE.CylinderGeometry(0.32, 0.42, 0.55, 8)),
    matCarbon()
  );
  pillar.position.y = 0.6;
  group.add(pillar);

  // turret head subgroup (rotates)
  const head = new THREE.Group();
  head.position.y = 1.05;
  group.add(head);
  (group as any).userData.head = head;

  // ---- Per-tower head ----
  switch (kind) {
    case "pulse": buildPulseHead(head, accent, level); break;
    case "laser": buildLaserHead(head, accent, level); break;
    case "emp": buildEmpHead(head, accent, level); break;
    case "plasma": buildPlasmaHead(head, accent, level); break;
    case "railgun": buildRailgunHead(head, accent, level); break;
    case "nano": buildNanoHead(head, accent, level); break;
    case "quantum": buildQuantumHead(head, accent, level); break;
  }

  // ---- Level chevrons stacked on the back of the base ----
  for (let i = 0; i < level; i++) {
    const chev = new THREE.Mesh(
      geo("chev", () => new THREE.BoxGeometry(0.22, 0.05, 0.07)),
      matEmissive(accent, 2)
    );
    chev.position.set(0, 0.36 + i * 0.08, -0.92);
    group.add(chev);
  }

  // ---- Level 5 evolution aura ring ----
  if (level >= 5) {
    const aura = new THREE.Mesh(
      geo("aura", () => new THREE.RingGeometry(1.25, 1.35, 32)),
      new THREE.MeshBasicMaterial({
        color: accent, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
      })
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.05;
    (aura as any).userData.spinSpeed = 0.6;
    (group as any).userData.aura = aura;
    group.add(aura);

    // floating orbital crystals
    for (let i = 0; i < 3; i++) {
      const cryst = new THREE.Mesh(
        geo("evo-cryst", () => new THREE.OctahedronGeometry(0.12, 0)),
        matEmissive(accent, 3)
      );
      const a = (i / 3) * Math.PI * 2;
      cryst.position.set(Math.cos(a) * 1.15, 1.4 + Math.sin(a) * 0.2, Math.sin(a) * 1.15);
      (cryst as any).userData.orbit = { a, speed: 1.2 };
      group.add(cryst);
    }
  }

  return group;
}

// ----- PULSE: rotating gatling barrels ----------------------------
function buildPulseHead(head: THREE.Group, accent: number, level: number) {
  const housing = new THREE.Mesh(
    geo("pulse-house", () => new THREE.BoxGeometry(0.7, 0.5, 0.7)),
    matMetal(0x1a1a2a, accent, 0.4)
  );
  head.add(housing);

  const cap = new THREE.Mesh(
    geo("pulse-cap", () => new THREE.CylinderGeometry(0.22, 0.28, 0.2, 8)),
    matMetal(0x222236, accent, 0.5)
  );
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.35;
  head.add(cap);

  // barrels: 1 → 2 → 4 → 6 → 8
  const barrelCounts = [1, 2, 2, 4, 6];
  const barrels = barrelCounts[Math.min(level - 1, 4)];
  const barrelGroup = new THREE.Group();
  barrelGroup.position.z = 0.45;
  (barrelGroup as any).userData.spinSpeed = 6;
  (head as any).userData.spinChild = barrelGroup;
  head.add(barrelGroup);

  for (let i = 0; i < barrels; i++) {
    const a = (i / barrels) * Math.PI * 2;
    const off = barrels === 1 ? 0 : 0.13;
    const bar = new THREE.Mesh(
      geo("pulse-barrel", () => new THREE.CylinderGeometry(0.05, 0.05, 0.85, 6)),
      matMetal(0x2a2a3a)
    );
    bar.rotation.x = Math.PI / 2;
    bar.position.set(Math.cos(a) * off, Math.sin(a) * off, 0.42);
    barrelGroup.add(bar);

    // muzzle glow
    const muzzle = new THREE.Mesh(
      geo("pulse-muzzle", () => new THREE.SphereGeometry(0.045, 6, 4)),
      matEmissive(accent, 3)
    );
    muzzle.position.set(Math.cos(a) * off, Math.sin(a) * off, 0.85);
    barrelGroup.add(muzzle);
  }

  // sight on top
  const sight = new THREE.Mesh(
    geo("pulse-sight", () => new THREE.BoxGeometry(0.1, 0.1, 0.3)),
    matEmissive(accent, 1.5)
  );
  sight.position.set(0, 0.32, 0.1);
  head.add(sight);
}

// ----- LASER: focusing crystals + lens ----------------------------
function buildLaserHead(head: THREE.Group, accent: number, level: number) {
  const body = new THREE.Mesh(
    geo("laser-body", () => new THREE.OctahedronGeometry(0.45, 0)),
    matMetal(0x1a0a2a, accent, 0.4)
  );
  body.rotation.x = Math.PI / 4;
  head.add(body);

  // emitter barrel
  const barrel = new THREE.Mesh(
    geo("laser-barrel", () => new THREE.CylinderGeometry(0.13, 0.18, 0.6, 8)),
    matMetal(0x18182a, accent, 0.5)
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.55;
  head.add(barrel);

  // glowing lens
  const lens = new THREE.Mesh(
    geo("laser-lens", () => new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12)),
    matEmissive(accent, 4)
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.85;
  head.add(lens);

  // floating focusing crystals (one per level, max 5)
  for (let i = 0; i < Math.min(level, 5); i++) {
    const a = (i / 5) * Math.PI * 2;
    const cryst = new THREE.Mesh(
      geo("laser-cryst", () => new THREE.OctahedronGeometry(0.07, 0)),
      matEmissive(accent, 3)
    );
    cryst.position.set(Math.cos(a) * 0.35, 0.3, Math.sin(a) * 0.35);
    (cryst as any).userData.orbit = { a, speed: 2 };
    head.add(cryst);
  }

  // top fin
  const fin = new THREE.Mesh(
    geo("laser-fin", () => new THREE.BoxGeometry(0.08, 0.4, 0.5)),
    matEmissive(accent, 1.2)
  );
  fin.position.y = 0.4;
  head.add(fin);
}

// ----- EMP: pulsing tesla coil sphere -----------------------------
function buildEmpHead(head: THREE.Group, accent: number, level: number) {
  // base coil
  const coilBase = new THREE.Mesh(
    geo("emp-base", () => new THREE.CylinderGeometry(0.3, 0.45, 0.25, 8)),
    matMetal(0x14082a, accent, 0.5)
  );
  head.add(coilBase);

  // tesla rings stacked
  for (let i = 0; i < 3; i++) {
    const r = 0.4 - i * 0.05;
    const ring = new THREE.Mesh(
      geo(`emp-ring-${i}`, () => new THREE.TorusGeometry(r, 0.025, 6, 16)),
      matEmissive(accent, 2.5)
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2 + i * 0.12;
    (ring as any).userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * (1 + i * 0.5);
    head.add(ring);
  }

  // central plasma orb
  const orb = new THREE.Mesh(
    geo("emp-orb", () => new THREE.IcosahedronGeometry(0.18 + level * 0.02, 0)),
    matEmissive(accent, 4)
  );
  orb.position.y = 0.45;
  (orb as any).userData.pulse = true;
  head.add(orb);

  // wireframe shell
  const shell = new THREE.Mesh(
    geo("emp-shell", () => new THREE.IcosahedronGeometry(0.5, 0)),
    new THREE.MeshBasicMaterial({ color: accent, wireframe: true, transparent: true, opacity: 0.55 })
  );
  shell.position.y = 0.4;
  (shell as any).userData.spinSpeed = 0.4;
  head.add(shell);

  // antenna prongs (more with level)
  const prongs = 3 + Math.min(level, 5);
  for (let i = 0; i < prongs; i++) {
    const a = (i / prongs) * Math.PI * 2;
    const prong = new THREE.Mesh(
      geo("emp-prong", () => new THREE.ConeGeometry(0.04, 0.3, 4)),
      matEmissive(accent, 2)
    );
    prong.position.set(Math.cos(a) * 0.4, 0.55, Math.sin(a) * 0.4);
    prong.lookAt(0, 1.5, 0);
    head.add(prong);
  }
}

// ----- PLASMA: angled mortar with glowing core --------------------
function buildPlasmaHead(head: THREE.Group, accent: number, level: number) {
  const body = new THREE.Mesh(
    geo("plasma-body", () => new THREE.BoxGeometry(0.75, 0.45, 0.65)),
    matMetal(0x0c1a0c, accent, 0.4)
  );
  head.add(body);

  // mortar tube
  const mortar = new THREE.Mesh(
    geo("plasma-mortar", () => new THREE.CylinderGeometry(0.22, 0.3, 0.85, 8)),
    matMetal(0x1a2a1a, accent, 0.3)
  );
  mortar.rotation.x = -Math.PI / 4;
  mortar.position.set(0, 0.3, 0.15);
  head.add(mortar);

  // muzzle ring
  const muzzleRing = new THREE.Mesh(
    geo("plasma-mring", () => new THREE.TorusGeometry(0.22, 0.04, 6, 12)),
    matEmissive(accent, 2)
  );
  muzzleRing.rotation.x = -Math.PI / 4 + Math.PI / 2;
  muzzleRing.position.set(0, 0.6, 0.45);
  head.add(muzzleRing);

  // glowing plasma orb in muzzle
  const muzzleOrb = new THREE.Mesh(
    geo("plasma-orb", () => new THREE.SphereGeometry(0.16, 8, 6)),
    matEmissive(accent, 4)
  );
  muzzleOrb.position.set(0, 0.6, 0.45);
  (muzzleOrb as any).userData.pulse = true;
  head.add(muzzleOrb);

  // ammo drums on the sides (more with level)
  const drums = Math.min(level, 4);
  for (let i = 0; i < drums; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const drum = new THREE.Mesh(
      geo("plasma-drum", () => new THREE.CylinderGeometry(0.13, 0.13, 0.2, 8)),
      matMetal(0x1a3a1a, accent, 0.7)
    );
    drum.position.set(side * 0.4, -0.05, -0.15 + Math.floor(i / 2) * 0.2);
    drum.rotation.z = Math.PI / 2;
    head.add(drum);
  }

  // exhaust vents on the back
  const vent = new THREE.Mesh(
    geo("plasma-vent", () => new THREE.BoxGeometry(0.6, 0.12, 0.08)),
    matEmissive(accent, 1.5)
  );
  vent.position.set(0, 0.1, -0.32);
  head.add(vent);
}

// ----- RAILGUN: long twin rails with magnetic coils ---------------
function buildRailgunHead(head: THREE.Group, accent: number, _level: number) {
  const body = new THREE.Mesh(
    geo("rail-body", () => new THREE.BoxGeometry(0.55, 0.45, 0.65)),
    matMetal(0x2a2206, accent, 0.4)
  );
  head.add(body);

  // long rail
  const rail = new THREE.Mesh(
    geo("rail-main", () => new THREE.BoxGeometry(0.2, 0.2, 1.8)),
    matMetal(0x33330a, accent, 0.3)
  );
  rail.position.z = 0.95;
  head.add(rail);

  // glowing parallel rails (top & bottom)
  for (const sy of [-1, 1]) {
    const r = new THREE.Mesh(
      geo("rail-side", () => new THREE.BoxGeometry(0.04, 0.04, 1.8)),
      matEmissive(accent, 3)
    );
    r.position.set(0, sy * 0.13, 0.95);
    head.add(r);
  }

  // magnetic accelerator coils along the rail
  for (let i = 0; i < 4; i++) {
    const coil = new THREE.Mesh(
      geo("rail-coil", () => new THREE.TorusGeometry(0.18, 0.04, 6, 12)),
      matEmissive(accent, 2)
    );
    coil.rotation.y = Math.PI / 2;
    coil.position.z = 0.4 + i * 0.4;
    head.add(coil);
  }

  // muzzle brake
  const muzzle = new THREE.Mesh(
    geo("rail-muzzle", () => new THREE.CylinderGeometry(0.18, 0.22, 0.18, 8)),
    matMetal(0x3a3a0a, accent, 0.6)
  );
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.z = 1.9;
  head.add(muzzle);

  // capacitor (back-mounted glowing block)
  const cap = new THREE.Mesh(
    geo("rail-cap", () => new THREE.BoxGeometry(0.4, 0.3, 0.25)),
    matEmissive(accent, 1.8)
  );
  cap.position.set(0, 0.05, -0.4);
  head.add(cap);

  // sight
  const sight = new THREE.Mesh(
    geo("rail-sight", () => new THREE.BoxGeometry(0.06, 0.18, 0.4)),
    matMetal(0x222222)
  );
  sight.position.set(0, 0.35, 0.5);
  head.add(sight);
}

// ----- NANO: hive dodecahedron with floating drones ---------------
function buildNanoHead(head: THREE.Group, accent: number, level: number) {
  const hive = new THREE.Mesh(
    geo("nano-hive", () => new THREE.DodecahedronGeometry(0.45, 0)),
    matMetal(0x062a1f, accent, 0.6)
  );
  head.add(hive);

  // glowing core
  const core = new THREE.Mesh(
    geo("nano-core", () => new THREE.IcosahedronGeometry(0.18, 0)),
    matEmissive(accent, 4)
  );
  (core as any).userData.pulse = true;
  head.add(core);

  // hexagonal vents/holes on the hive
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const vent = new THREE.Mesh(
      geo("nano-vent", () => new THREE.RingGeometry(0.08, 0.11, 6)),
      matEmissive(accent, 2)
    );
    vent.position.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45);
    vent.lookAt(Math.cos(a) * 2, 0, Math.sin(a) * 2);
    head.add(vent);
  }

  // floating drone swarm (more with level)
  const droneCount = 4 + level;
  for (let i = 0; i < droneCount; i++) {
    const a = (i / droneCount) * Math.PI * 2;
    const drone = new THREE.Mesh(
      geo("nano-drone", () => new THREE.OctahedronGeometry(0.05, 0)),
      matEmissive(accent, 3.5)
    );
    drone.position.set(Math.cos(a) * 0.7, Math.sin(a * 1.3) * 0.2, Math.sin(a) * 0.7);
    (drone as any).userData.orbit = { a, speed: 1.5 + (i % 3) * 0.5, radius: 0.7 + (i % 2) * 0.1 };
    head.add(drone);
  }

  // top antenna
  const ant = new THREE.Mesh(
    geo("nano-ant", () => new THREE.ConeGeometry(0.04, 0.35, 4)),
    matEmissive(accent, 2)
  );
  ant.position.y = 0.6;
  head.add(ant);
}

// ----- QUANTUM: triple-axis torus with central singularity --------
function buildQuantumHead(head: THREE.Group, accent: number, _level: number) {
  // base
  const dais = new THREE.Mesh(
    geo("q-dais", () => new THREE.CylinderGeometry(0.45, 0.5, 0.15, 8)),
    matMetal(0x2a0822, accent, 0.5)
  );
  head.add(dais);

  // three orbital rings on different axes
  const ring1 = new THREE.Mesh(
    geo("q-ring", () => new THREE.TorusGeometry(0.5, 0.05, 8, 24)),
    matEmissive(accent, 2.5)
  );
  (ring1 as any).userData.spinSpeed = 1.2;
  head.add(ring1);

  const ring2 = new THREE.Mesh(
    geo("q-ring", () => new THREE.TorusGeometry(0.5, 0.05, 8, 24)),
    matEmissive(accent, 2.5)
  );
  ring2.rotation.x = Math.PI / 2;
  (ring2 as any).userData.spinSpeed = -1.5;
  head.add(ring2);

  const ring3 = new THREE.Mesh(
    geo("q-ring", () => new THREE.TorusGeometry(0.5, 0.05, 8, 24)),
    matEmissive(accent, 2.5)
  );
  ring3.rotation.z = Math.PI / 2;
  (ring3 as any).userData.spinSpeed = 0.9;
  head.add(ring3);

  // singularity orb
  const orb = new THREE.Mesh(
    geo("q-orb", () => new THREE.IcosahedronGeometry(0.22, 1)),
    matEmissive(accent, 5)
  );
  (orb as any).userData.pulse = true;
  head.add(orb);

  // tendrils / lightning fingers
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const t = new THREE.Mesh(
      geo("q-tendril", () => new THREE.ConeGeometry(0.03, 0.6, 4)),
      matEmissive(accent, 2.5)
    );
    t.position.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4);
    t.lookAt(Math.cos(a) * 2, 0.6, Math.sin(a) * 2);
    head.add(t);
  }
}

// =============================================================
// ENEMY MESHES — shaped per archetype, scale-aware
// =============================================================

export function buildEnemyMesh(def: EnemyDef): THREE.Group {
  const group = new THREE.Group();
  const s = def.scale;
  const mat = matMetal(def.color, def.emissive, 0.7);
  const accentMat = matEmissive(def.emissive, 2.5);
  const darkMat = matCarbon();

  switch (def.shape) {
    case "drone": {
      // central body
      const body = new THREE.Mesh(
        geo("e-drone-body", () => new THREE.OctahedronGeometry(0.4, 0)),
        mat
      );
      body.scale.setScalar(s);
      group.add(body);

      // cyclops eye
      const eye = new THREE.Mesh(
        geo("e-drone-eye", () => new THREE.SphereGeometry(0.12, 8, 6)),
        accentMat
      );
      eye.position.set(0, 0, 0.42 * s);
      eye.scale.setScalar(s);
      group.add(eye);

      // 4 thrusters
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const thr = new THREE.Mesh(
          geo("e-drone-thr", () => new THREE.CylinderGeometry(0.08, 0.05, 0.18, 6)),
          accentMat
        );
        thr.position.set(Math.cos(a) * 0.35 * s, -0.15 * s, Math.sin(a) * 0.35 * s);
        thr.rotation.x = Math.PI;
        group.add(thr);
      }

      // top fin
      const fin = new THREE.Mesh(
        geo("e-drone-fin", () => new THREE.ConeGeometry(0.08, 0.25, 4)),
        mat
      );
      fin.position.y = 0.35 * s;
      group.add(fin);
      break;
    }

    case "walker": {
      // chassis
      const chassis = new THREE.Mesh(
        geo("e-walker-chassis", () => new THREE.BoxGeometry(0.8, 0.45, 0.9)),
        mat
      );
      chassis.scale.setScalar(s);
      chassis.position.y = 0.55 * s;
      group.add(chassis);

      // armored hull plate on top
      const hull = new THREE.Mesh(
        geo("e-walker-hull", () => new THREE.BoxGeometry(0.6, 0.2, 0.7)),
        darkMat
      );
      hull.position.y = 0.85 * s;
      hull.scale.setScalar(s);
      group.add(hull);

      // visor / eye strip
      const visor = new THREE.Mesh(
        geo("e-walker-visor", () => new THREE.BoxGeometry(0.5, 0.08, 0.06)),
        accentMat
      );
      visor.position.set(0, 0.7 * s, 0.46 * s);
      group.add(visor);

      // 4 legs (boxy with knee joints)
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
          const upper = new THREE.Mesh(
            geo("e-walker-up", () => new THREE.BoxGeometry(0.1, 0.4, 0.1)),
            darkMat
          );
          upper.position.set(sx * 0.32 * s, 0.32 * s, sz * 0.36 * s);
          upper.rotation.x = sz * 0.3;
          group.add(upper);

          const lower = new THREE.Mesh(
            geo("e-walker-low", () => new THREE.BoxGeometry(0.08, 0.35, 0.08)),
            darkMat
          );
          lower.position.set(sx * 0.32 * s, 0.05 * s, sz * 0.45 * s);
          group.add(lower);

          // foot pad
          const foot = new THREE.Mesh(
            geo("e-walker-foot", () => new THREE.BoxGeometry(0.18, 0.06, 0.2)),
            mat
          );
          foot.position.set(sx * 0.32 * s, -0.12 * s, sz * 0.45 * s);
          group.add(foot);
        }
      }

      // shoulder cannons
      for (const sx of [-1, 1]) {
        const can = new THREE.Mesh(
          geo("e-walker-cannon", () => new THREE.CylinderGeometry(0.06, 0.08, 0.3, 6)),
          accentMat
        );
        can.rotation.x = Math.PI / 2;
        can.position.set(sx * 0.32 * s, 0.85 * s, 0.4 * s);
        group.add(can);
      }
      break;
    }

    case "hover": {
      // saucer body
      const body = new THREE.Mesh(
        geo("e-hover-body", () => new THREE.SphereGeometry(0.55, 12, 8)),
        mat
      );
      body.scale.set(s, s * 0.55, s);
      body.position.y = 0.7;
      group.add(body);

      // cockpit dome
      const dome = new THREE.Mesh(
        geo("e-hover-dome", () => new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)),
        accentMat
      );
      dome.scale.setScalar(s);
      dome.position.y = 0.85;
      group.add(dome);

      // glowing thruster ring
      const ring = new THREE.Mesh(
        geo("e-hover-ring", () => new THREE.TorusGeometry(0.55, 0.06, 8, 18)),
        accentMat
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.55;
      ring.scale.set(s, s, s);
      (ring as any).userData.spinSpeed = 2;
      group.add(ring);

      // 3 weapon pods
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const pod = new THREE.Mesh(
          geo("e-hover-pod", () => new THREE.CylinderGeometry(0.07, 0.09, 0.25, 6)),
          mat
        );
        pod.position.set(Math.cos(a) * 0.5 * s, 0.7, Math.sin(a) * 0.5 * s);
        group.add(pod);
      }

      // bottom thruster glow
      const thr = new THREE.Mesh(
        geo("e-hover-thr", () => new THREE.ConeGeometry(0.3, 0.4, 8)),
        new THREE.MeshBasicMaterial({ color: def.emissive, transparent: true, opacity: 0.6 })
      );
      thr.scale.setScalar(s);
      thr.position.y = 0.3;
      thr.rotation.x = Math.PI;
      group.add(thr);
      break;
    }

    case "tank": {
      // treads
      for (const sx of [-1, 1]) {
        const tread = new THREE.Mesh(
          geo("e-tank-tread", () => new THREE.BoxGeometry(0.25, 0.3, 1.3)),
          darkMat
        );
        tread.scale.setScalar(s);
        tread.position.set(sx * 0.5 * s, 0.18 * s, 0);
        group.add(tread);

        // tread accent stripe
        const stripe = new THREE.Mesh(
          geo("e-tank-stripe", () => new THREE.BoxGeometry(0.04, 0.06, 1.3)),
          accentMat
        );
        stripe.position.set(sx * 0.62 * s, 0.18 * s, 0);
        group.add(stripe);
      }

      // chassis
      const chassis = new THREE.Mesh(
        geo("e-tank-chassis", () => new THREE.BoxGeometry(1.2, 0.35, 1.0)),
        mat
      );
      chassis.scale.setScalar(s);
      chassis.position.y = 0.45 * s;
      group.add(chassis);

      // sloped front armor
      const front = new THREE.Mesh(
        geo("e-tank-front", () => new THREE.BoxGeometry(1.2, 0.35, 0.2)),
        darkMat
      );
      front.scale.setScalar(s);
      front.position.set(0, 0.45 * s, 0.55 * s);
      front.rotation.x = -0.4;
      group.add(front);

      // turret
      const turret = new THREE.Mesh(
        geo("e-tank-turret", () => new THREE.CylinderGeometry(0.4, 0.5, 0.3, 8)),
        mat
      );
      turret.scale.setScalar(s);
      turret.position.y = 0.78 * s;
      group.add(turret);

      // main barrel
      const barrel = new THREE.Mesh(
        geo("e-tank-barrel", () => new THREE.CylinderGeometry(0.08, 0.08, 0.95, 8)),
        darkMat
      );
      barrel.scale.setScalar(s);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.78 * s, 0.55 * s);
      group.add(barrel);

      // muzzle glow
      const muzzle = new THREE.Mesh(
        geo("e-tank-muzzle", () => new THREE.SphereGeometry(0.1, 6, 4)),
        accentMat
      );
      muzzle.position.set(0, 0.78 * s, 1.05 * s);
      group.add(muzzle);

      // commander cupola
      const cupola = new THREE.Mesh(
        geo("e-tank-cup", () => new THREE.SphereGeometry(0.12, 8, 6)),
        accentMat
      );
      cupola.position.set(0, 0.95 * s, -0.05 * s);
      group.add(cupola);
      break;
    }

    case "elite": {
      // angular core body
      const body = new THREE.Mesh(
        geo("e-elite-body", () => new THREE.DodecahedronGeometry(0.55, 0)),
        mat
      );
      body.scale.setScalar(s);
      body.position.y = 0.75;
      group.add(body);

      // crown spikes
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const spike = new THREE.Mesh(
          geo("e-elite-spike", () => new THREE.ConeGeometry(0.08, 0.5, 4)),
          accentMat
        );
        spike.position.set(Math.cos(a) * 0.5 * s, 1.05, Math.sin(a) * 0.5 * s);
        spike.lookAt(Math.cos(a) * 2, 1.4, Math.sin(a) * 2);
        group.add(spike);
      }

      // floating armor plates
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const plate = new THREE.Mesh(
          geo("e-elite-plate", () => new THREE.BoxGeometry(0.25, 0.4, 0.05)),
          darkMat
        );
        plate.position.set(Math.cos(a) * 0.7 * s, 0.7, Math.sin(a) * 0.7 * s);
        plate.lookAt(0, 0.7, 0);
        (plate as any).userData.orbit = { a, speed: 0.8, radius: 0.7 * s, y: 0.7 };
        group.add(plate);
      }

      // base / legs
      const base = new THREE.Mesh(
        geo("e-elite-base", () => new THREE.CylinderGeometry(0.3, 0.5, 0.3, 6)),
        darkMat
      );
      base.scale.setScalar(s);
      base.position.y = 0.2;
      group.add(base);

      // eye
      const eye = new THREE.Mesh(
        geo("e-elite-eye", () => new THREE.SphereGeometry(0.1, 8, 6)),
        accentMat
      );
      eye.position.set(0, 0.85, 0.5 * s);
      group.add(eye);
      break;
    }

    case "titan": {
      // massive central core
      const core = new THREE.Mesh(
        geo("e-titan-core", () => new THREE.IcosahedronGeometry(1.0, 1)),
        new THREE.MeshStandardMaterial({
          color: def.color, emissive: def.emissive, emissiveIntensity: 1.5,
          metalness: 0.85, roughness: 0.3,
        })
      );
      core.position.y = 2.2;
      group.add(core);

      // outer shell (semi-transparent armor)
      const shell = new THREE.Mesh(
        geo("e-titan-shell", () => new THREE.IcosahedronGeometry(1.4, 0)),
        new THREE.MeshStandardMaterial({
          color: def.color, emissive: def.emissive, emissiveIntensity: 0.6,
          metalness: 0.9, roughness: 0.4, transparent: true, opacity: 0.7,
          flatShading: true,
        })
      );
      shell.position.y = 2.2;
      (shell as any).userData.spinSpeed = -0.3;
      group.add(shell);

      // 3 orbiting halos at different angles
      for (let i = 0; i < 3; i++) {
        const halo = new THREE.Mesh(
          geo("e-titan-halo", () => new THREE.TorusGeometry(1.7, 0.08, 8, 32)),
          accentMat
        );
        halo.position.y = 2.2;
        halo.rotation.x = (i / 3) * Math.PI;
        halo.rotation.z = (i / 3) * Math.PI * 0.7;
        (halo as any).userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * (0.4 + i * 0.2);
        group.add(halo);
      }

      // 4 colossal legs
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
          const upper = new THREE.Mesh(
            geo("e-titan-up", () => new THREE.BoxGeometry(0.35, 1.3, 0.35)),
            mat
          );
          upper.position.set(sx * 0.85, 1.3, sz * 0.85);
          upper.rotation.x = -sz * 0.25;
          upper.rotation.z = -sx * 0.15;
          group.add(upper);

          const lower = new THREE.Mesh(
            geo("e-titan-low", () => new THREE.BoxGeometry(0.3, 1.2, 0.3)),
            mat
          );
          lower.position.set(sx * 1.05, 0.4, sz * 1.05);
          group.add(lower);

          // glowing knee joint
          const knee = new THREE.Mesh(
            geo("e-titan-knee", () => new THREE.SphereGeometry(0.18, 8, 6)),
            accentMat
          );
          knee.position.set(sx * 0.95, 0.85, sz * 0.95);
          group.add(knee);

          // foot pad
          const foot = new THREE.Mesh(
            geo("e-titan-foot", () => new THREE.BoxGeometry(0.55, 0.18, 0.55)),
            mat
          );
          foot.position.set(sx * 1.05, 0.0, sz * 1.05);
          group.add(foot);
        }
      }

      // central glowing eye / weak point
      const eye = new THREE.Mesh(
        geo("e-titan-eye", () => new THREE.SphereGeometry(0.35, 12, 8)),
        matEmissive(def.emissive, 4)
      );
      eye.position.set(0, 2.2, 1.05);
      (eye as any).userData.pulse = true;
      group.add(eye);

      // shoulder weapons
      for (const sx of [-1, 1]) {
        const wpn = new THREE.Mesh(
          geo("e-titan-wpn", () => new THREE.BoxGeometry(0.4, 0.4, 0.8)),
          mat
        );
        wpn.position.set(sx * 1.4, 2.5, 0);
        group.add(wpn);

        const wpnGlow = new THREE.Mesh(
          geo("e-titan-wglow", () => new THREE.SphereGeometry(0.15, 6, 4)),
          accentMat
        );
        wpnGlow.position.set(sx * 1.4, 2.5, 0.45);
        group.add(wpnGlow);
      }
      break;
    }
  }

  // hovering enemies levitate
  if (def.traits.includes("flying") || def.shape === "hover" || def.shape === "drone") {
    group.position.y = 1.4;
  }

  // mark for stealth shimmer
  if (def.traits.includes("stealth")) {
    group.traverse((c) => {
      if ((c as any).isMesh) {
        const m = (c as any).material;
        if (m && m.transparent !== undefined) {
          m.transparent = true;
          m.opacity = 0.55;
        }
      }
    });
  }

  return group;
}
