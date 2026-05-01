// =============================================================
// CREATURE DEFENSES — Skeletons, Crack Elves, High Templars
// These are mobile units that defend alongside towers
// =============================================================

import * as THREE from "three";
import { PATH_POINTS } from "../path";

export type UnitKind = "skeleton" | "crack_elf" | "high_templar" | "marauder" | "colossus";

export interface Unit {
  id: number;
  kind: UnitKind;
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  speed: number;
  cooldown: number;
  segIndex: number;
  segT: number;
  alive: boolean;
  lastAttack: number;
  level: number;
}

const UNIT_STATS: Record<UnitKind, { hp: number; dmg: number; range: number; speed: number; color: number }> = {
  skeleton:     { hp: 45,  dmg: 8,  range: 1.2, speed: 1.8, color: 0xaaaaaa },
  crack_elf:    { hp: 35,  dmg: 14, range: 7.0, speed: 2.2, color: 0x66ddff },
  high_templar: { hp: 60,  dmg: 6,  range: 5.5, speed: 1.4, color: 0xff66ff },
  marauder:     { hp: 110, dmg: 22, range: 4.0, speed: 1.6, color: 0xffaa00 },
  colossus:     { hp: 280, dmg: 45, range: 9.0, speed: 0.9, color: 0x00ffaa },
};

export function createUnit(kind: UnitKind, level: number = 1): Unit {
  const stats = UNIT_STATS[kind];
  const mesh = buildUnitMesh(kind, level);

  const u: Unit = {
    id: Math.floor(Math.random() * 1e9),
    kind,
    mesh,
    hp: Math.floor(stats.hp * (1 + (level - 1) * 0.25)),
    maxHp: Math.floor(stats.hp * (1 + (level - 1) * 0.25)),
    damage: Math.floor(stats.dmg * (1 + (level - 1) * 0.3)),
    range: stats.range * (1 + (level - 1) * 0.1),
    speed: stats.speed,
    cooldown: 0,
    segIndex: 0,
    segT: 0,
    alive: true,
    lastAttack: 0,
    level,
  };

  // Start near beginning of path
  mesh.position.copy(PATH_POINTS[0]);
  mesh.position.y = 0.6;
  if (kind === "high_templar") mesh.position.y = 1.0;

  return u;
}

function buildUnitMesh(kind: UnitKind, level: number): THREE.Group {
  const g = new THREE.Group();
  const baseColor = UNIT_STATS[kind].color;

  switch (kind) {
    case "skeleton": {
      // Simple low-poly skeleton
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 6), new THREE.MeshStandardMaterial({ color: baseColor }));
      body.position.y = 0.35;
      g.add(body);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
      skull.position.y = 0.7;
      g.add(skull);
      // glowing eyes
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      eyeL.position.set(-0.06, 0.72, 0.15);
      g.add(eyeL);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.06;
      g.add(eyeR);
      break;
    }
    case "crack_elf": {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.6, 6), new THREE.MeshStandardMaterial({ color: baseColor }));
      body.position.y = 0.4;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshStandardMaterial({ color: 0xaaffcc }));
      head.position.y = 0.75;
      g.add(head);
      // bow
      const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x334433 }));
      bow.rotation.z = Math.PI / 2;
      bow.position.set(0.25, 0.55, 0);
      g.add(bow);
      break;
    }
    case "high_templar": {
      const robe = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 6), new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.3 }));
      robe.position.y = 0.55;
      g.add(robe);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffeecc }));
      head.position.y = 1.05;
      g.add(head);
      // psi blade
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.7, 4), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
      blade.position.set(0.35, 0.8, 0);
      blade.rotation.z = -0.6;
      g.add(blade);
      break;
    }
    case "marauder": {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.35), new THREE.MeshStandardMaterial({ color: baseColor }));
      body.position.y = 0.45;
      g.add(body);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      gun.position.set(0.25, 0.55, 0.2);
      g.add(gun);
      break;
    }
    case "colossus": {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.5), new THREE.MeshStandardMaterial({ color: baseColor }));
      body.position.y = 0.6;
      g.add(body);
      // big cannon
      const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      cannon.rotation.x = Math.PI / 2;
      cannon.position.set(0, 0.7, 0.6);
      g.add(cannon);
      // glowing core
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: 0x00ffaa }));
      core.position.y = 1.1;
      g.add(core);
      break;
    }
  }

  // Level indicator
  if (level > 1) {
    const lv = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    lv.position.y = 1.3;
    g.add(lv);
  }

  return g;
}

export function updateUnits(
  units: Unit[],
  enemies: { mesh: THREE.Object3D; hp: number; maxHp: number; alive: boolean }[],
  dt: number,
  onDamageEnemy: (enemyIndex: number, dmg: number) => void
) {
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    if (!u.alive) {
      units.splice(i, 1);
      continue;
    }

    // Move along path
    let move = u.speed * dt;
    while (move > 0 && u.segIndex < PATH_POINTS.length - 1) {
      const a = PATH_POINTS[u.segIndex];
      const b = PATH_POINTS[u.segIndex + 1];
      const segLen = a.distanceTo(b);
      const remain = segLen * (1 - u.segT);
      if (move < remain) {
        u.segT += move / segLen;
        move = 0;
      } else {
        move -= remain;
        u.segIndex++;
        u.segT = 0;
      }
    }

    const a = PATH_POINTS[Math.min(u.segIndex, PATH_POINTS.length - 1)];
    const b = PATH_POINTS[Math.min(u.segIndex + 1, PATH_POINTS.length - 1)];
    const x = a.x + (b.x - a.x) * u.segT;
    const z = a.z + (b.z - a.z) * u.segT;
    u.mesh.position.x = x;
    u.mesh.position.z = z;

    // Attack nearest enemy in range
    u.cooldown -= dt;
    if (u.cooldown > 0) continue;

    let closest = -1;
    let closestDist = u.range * u.range;
    for (let e = 0; e < enemies.length; e++) {
      if (!enemies[e].alive) continue;
      const dx = enemies[e].mesh.position.x - u.mesh.position.x;
      const dz = enemies[e].mesh.position.z - u.mesh.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < closestDist) {
        closestDist = d2;
        closest = e;
      }
    }

    if (closest !== -1) {
      onDamageEnemy(closest, u.damage);
      u.cooldown = 0.8 + Math.random() * 0.4;
      // Simple attack visual
      u.mesh.scale.setScalar(1.15);
      setTimeout(() => { if (u.mesh) u.mesh.scale.setScalar(1); }, 80);
    }

    // Death
    if (u.hp <= 0) {
      u.alive = false;
    }
  }
}
