// =============================================================
// Tower Data — data-driven, easy to tweak
// 7 towers x 5 levels (level 5 = Tier Evolution)
// =============================================================

export type TowerKind =
  | "pulse"
  | "laser"
  | "emp"
  | "plasma"
  | "railgun"
  | "nano"
  | "quantum";

export type DamageType =
  | "kinetic"
  | "energy"
  | "emp"
  | "explosive"
  | "swarm"
  | "exotic";

export interface TowerLevelStats {
  level: number;
  cost: number;          // Energy Cores to reach this level (level 1 = build cost)
  damage: number;        // per shot / per tick
  range: number;         // world units
  fireRate: number;      // shots per second
  special?: string;      // human readable
  // Per-tower mechanic numbers (only some apply)
  slowPct?: number;      // 0..1   movement speed reduction
  slowDuration?: number; // seconds
  burnDps?: number;      // dot
  burnDuration?: number;
  chainTargets?: number; // chain lightning style
  splashRadius?: number; // AoE
  armorShred?: number;   // flat armor reduction
  pierce?: number;       // pierces N enemies
  empStunDuration?: number;
  evolved?: boolean;     // level 5 marker
  evolvedName?: string;
}

export interface TowerDef {
  kind: TowerKind;
  name: string;
  evolvedName: string;
  description: string;
  damageType: DamageType;
  // Visual
  color: number;         // emissive accent
  baseColor: number;
  // Stats per level (index 0 = level 1)
  levels: TowerLevelStats[];
}

// Helper to build a level
const lvl = (
  level: number,
  cost: number,
  damage: number,
  range: number,
  fireRate: number,
  extra: Partial<TowerLevelStats> = {}
): TowerLevelStats => ({ level, cost, damage, range, fireRate, ...extra });

export const TOWERS: Record<TowerKind, TowerDef> = {
  pulse: {
    kind: "pulse",
    name: "Pulse Turret",
    evolvedName: "Pulse Blaster",
    description:
      "Reliable rapid-fire kinetic turret. Cheap, balanced, the backbone of any defense.",
    damageType: "kinetic",
    color: 0x00e5ff,
    baseColor: 0x0a2540,
    levels: [
      lvl(1, 50, 10, 9, 2.0, { special: "Single target" }),
      lvl(2, 40, 16, 10, 2.4, { special: "Improved barrel" }),
      lvl(3, 70, 26, 11, 2.8, { special: "Dual cannons", pierce: 1 }),
      lvl(4, 120, 42, 12, 3.2, { special: "Quad cannons", pierce: 2 }),
      lvl(5, 250, 80, 14, 4.0, {
        special: "PULSE BLASTER — armor shred + pierce 3",
        pierce: 3,
        armorShred: 5,
        evolved: true,
        evolvedName: "Pulse Blaster",
      }),
    ],
  },
  laser: {
    kind: "laser",
    name: "Laser Lance Tower",
    evolvedName: "Prism Lance",
    description:
      "Continuous beam weapon. Damage ramps up the longer it stays on a target.",
    damageType: "energy",
    color: 0xff2bd6,
    baseColor: 0x2a0a3a,
    levels: [
      lvl(1, 90, 20, 10, 4.0, { special: "Continuous beam" }),
      lvl(2, 70, 30, 11, 5.0),
      lvl(3, 110, 48, 12, 6.0, { special: "Focusing crystals" }),
      lvl(4, 180, 78, 13, 7.0, { burnDps: 12, burnDuration: 2 }),
      lvl(5, 320, 140, 15, 9.0, {
        special: "PRISM LANCE — splits to 3 targets, ignite",
        chainTargets: 3,
        burnDps: 30,
        burnDuration: 3,
        evolved: true,
        evolvedName: "Prism Lance",
      }),
    ],
  },
  emp: {
    kind: "emp",
    name: "EMP Disruptor",
    evolvedName: "Neuro-EMP Node",
    description:
      "Low damage but stuns and slows robotic enemies in a wide area.",
    damageType: "emp",
    color: 0x9d4bff,
    baseColor: 0x140a2a,
    levels: [
      lvl(1, 75, 4, 8, 1.0, {
        slowPct: 0.25,
        slowDuration: 1.5,
        empStunDuration: 0.2,
        splashRadius: 3,
      }),
      lvl(2, 60, 6, 9, 1.2, {
        slowPct: 0.35,
        slowDuration: 1.8,
        empStunDuration: 0.3,
        splashRadius: 3.4,
      }),
      lvl(3, 100, 10, 10, 1.4, {
        slowPct: 0.45,
        slowDuration: 2,
        empStunDuration: 0.45,
        splashRadius: 3.8,
      }),
      lvl(4, 160, 16, 11, 1.6, {
        slowPct: 0.55,
        slowDuration: 2.2,
        empStunDuration: 0.6,
        splashRadius: 4.2,
        armorShred: 4,
      }),
      lvl(5, 280, 30, 13, 2.0, {
        special: "NEURO-EMP — long stun, big radius, drops shields",
        slowPct: 0.7,
        slowDuration: 2.5,
        empStunDuration: 1.0,
        splashRadius: 5.5,
        armorShred: 10,
        evolved: true,
        evolvedName: "Neuro-EMP Node",
      }),
    ],
  },
  plasma: {
    kind: "plasma",
    name: "Plasma Mortar",
    evolvedName: "Plasma Siege Cannon",
    description:
      "Lobs explosive plasma rounds. Massive AoE, slow fire rate, great vs clusters.",
    damageType: "explosive",
    color: 0x39ff14,
    baseColor: 0x0c2a0c,
    levels: [
      lvl(1, 120, 35, 9, 0.7, { splashRadius: 2.4 }),
      lvl(2, 90, 55, 10, 0.8, { splashRadius: 2.6 }),
      lvl(3, 150, 90, 11, 0.9, { splashRadius: 3.0, burnDps: 8, burnDuration: 2 }),
      lvl(4, 220, 145, 12, 1.0, { splashRadius: 3.4, burnDps: 18, burnDuration: 2.5 }),
      lvl(5, 380, 260, 14, 1.2, {
        special: "PLASMA SIEGE — earthshaker rounds",
        splashRadius: 4.5,
        burnDps: 45,
        burnDuration: 3,
        evolved: true,
        evolvedName: "Plasma Siege Cannon",
      }),
    ],
  },
  railgun: {
    kind: "railgun",
    name: "Railgun Tower",
    evolvedName: "Gauss Accelerator",
    description:
      "Slow, hyper-accurate rail. Pierces multiple enemies in a line. Crushes armor.",
    damageType: "kinetic",
    color: 0xffd400,
    baseColor: 0x2a2206,
    levels: [
      lvl(1, 150, 80, 14, 0.5, { pierce: 2, armorShred: 3 }),
      lvl(2, 110, 120, 15, 0.55, { pierce: 2, armorShred: 4 }),
      lvl(3, 180, 180, 16, 0.65, { pierce: 3, armorShred: 6 }),
      lvl(4, 260, 270, 17, 0.75, { pierce: 4, armorShred: 9 }),
      lvl(5, 450, 460, 20, 0.9, {
        special: "GAUSS — full pierce, ignores most armor",
        pierce: 99,
        armorShred: 25,
        evolved: true,
        evolvedName: "Gauss Accelerator",
      }),
    ],
  },
  nano: {
    kind: "nano",
    name: "Nano-Swarm Hive",
    evolvedName: "Omega Hive",
    description:
      "Releases homing nano-drones that latch on and chew through enemies over time.",
    damageType: "swarm",
    color: 0x00ffa6,
    baseColor: 0x062a1f,
    levels: [
      lvl(1, 100, 6, 8, 3.0, { burnDps: 6, burnDuration: 3, chainTargets: 1 }),
      lvl(2, 80, 9, 8.5, 3.5, { burnDps: 10, burnDuration: 3.5, chainTargets: 2 }),
      lvl(3, 130, 14, 9, 4.0, { burnDps: 16, burnDuration: 4, chainTargets: 3 }),
      lvl(4, 200, 22, 10, 4.5, { burnDps: 26, burnDuration: 4, chainTargets: 4 }),
      lvl(5, 360, 40, 12, 5.5, {
        special: "OMEGA HIVE — relentless swarm",
        burnDps: 55,
        burnDuration: 5,
        chainTargets: 6,
        evolved: true,
        evolvedName: "Omega Hive",
      }),
    ],
  },
  quantum: {
    kind: "quantum",
    name: "Quantum Rift Tower",
    evolvedName: "Singularity Engine",
    description:
      "Tears spacetime to slow and damage all enemies in range. Endgame anchor.",
    damageType: "exotic",
    color: 0xff5af0,
    baseColor: 0x2a0822,
    levels: [
      lvl(1, 200, 12, 7, 2.0, {
        slowPct: 0.3,
        slowDuration: 1.0,
        splashRadius: 7,
        special: "Aura damage",
      }),
      lvl(2, 150, 20, 7.5, 2.2, {
        slowPct: 0.4,
        slowDuration: 1.0,
        splashRadius: 7.5,
      }),
      lvl(3, 240, 34, 8, 2.5, {
        slowPct: 0.5,
        slowDuration: 1.0,
        splashRadius: 8,
      }),
      lvl(4, 360, 56, 9, 3.0, {
        slowPct: 0.6,
        slowDuration: 1.0,
        splashRadius: 9,
        armorShred: 8,
      }),
      lvl(5, 600, 110, 11, 4.0, {
        special: "SINGULARITY — pulls and crushes",
        slowPct: 0.75,
        slowDuration: 1.0,
        splashRadius: 11,
        armorShred: 20,
        evolved: true,
        evolvedName: "Singularity Engine",
      }),
    ],
  },
};

export const TOWER_ORDER: TowerKind[] = [
  "pulse",
  "laser",
  "emp",
  "plasma",
  "railgun",
  "nano",
  "quantum",
];
