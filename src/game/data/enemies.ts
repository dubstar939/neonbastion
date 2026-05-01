// =============================================================
// Enemy archetypes + 100-wave progression generator
// =============================================================

export type EnemyTrait = "stealth" | "shield" | "flying" | "emp" | "regen" | "boss";

export interface EnemyDef {
  kind: string;
  name: string;
  baseHp: number;
  baseSpeed: number;     // units/sec
  baseArmor: number;     // flat damage reduction
  shield?: number;       // separate shield pool
  bounty: number;        // energy cores on kill
  damageToCore: number;  // lives lost if reaches core
  traits: EnemyTrait[];
  // visual
  color: number;
  emissive: number;
  scale: number;
  shape: "drone" | "walker" | "hover" | "tank" | "elite" | "titan";
}

export const ENEMIES: Record<string, EnemyDef> = {
  // 1-20: light drones, scouts
  scout_drone: {
    kind: "scout_drone",
    name: "Scout Drone",
    baseHp: 30, baseSpeed: 2.6, baseArmor: 0, bounty: 6, damageToCore: 1,
    traits: [], color: 0x66e0ff, emissive: 0x00aaff, scale: 0.5, shape: "drone",
  },
  light_drone: {
    kind: "light_drone",
    name: "Light Drone",
    baseHp: 55, baseSpeed: 2.2, baseArmor: 1, bounty: 8, damageToCore: 1,
    traits: [], color: 0x88ccff, emissive: 0x0099ff, scale: 0.55, shape: "drone",
  },
  recon_flyer: {
    kind: "recon_flyer",
    name: "Recon Flyer",
    baseHp: 70, baseSpeed: 3.0, baseArmor: 0, bounty: 10, damageToCore: 1,
    traits: ["flying"], color: 0x00ffd5, emissive: 0x00ffaa, scale: 0.55, shape: "drone",
  },

  // 21-40: armored walkers, shielded bots
  walker: {
    kind: "walker",
    name: "Armored Walker",
    baseHp: 220, baseSpeed: 1.5, baseArmor: 6, bounty: 14, damageToCore: 1,
    traits: [], color: 0xff7733, emissive: 0xff3300, scale: 0.75, shape: "walker",
  },
  shield_bot: {
    kind: "shield_bot",
    name: "Shielded Bot",
    baseHp: 200, baseSpeed: 1.6, baseArmor: 3, shield: 200, bounty: 18, damageToCore: 1,
    traits: ["shield"], color: 0x66aaff, emissive: 0x3366ff, scale: 0.8, shape: "walker",
  },

  // 41-60: hover mechs, EMP units
  hover_mech: {
    kind: "hover_mech",
    name: "Hover Mech",
    baseHp: 380, baseSpeed: 2.0, baseArmor: 4, bounty: 22, damageToCore: 1,
    traits: ["flying"], color: 0xb066ff, emissive: 0x9933ff, scale: 0.85, shape: "hover",
  },
  emp_unit: {
    kind: "emp_unit",
    name: "EMP Unit",
    baseHp: 320, baseSpeed: 1.7, baseArmor: 2, bounty: 24, damageToCore: 2,
    traits: ["emp"], color: 0xffee00, emissive: 0xffaa00, scale: 0.8, shape: "hover",
  },

  // 61-80: heavy tanks, laser crawlers
  heavy_tank: {
    kind: "heavy_tank",
    name: "Heavy Tank",
    baseHp: 900, baseSpeed: 1.1, baseArmor: 14, bounty: 35, damageToCore: 2,
    traits: [], color: 0xaa3333, emissive: 0xff2222, scale: 1.0, shape: "tank",
  },
  laser_crawler: {
    kind: "laser_crawler",
    name: "Laser Crawler",
    baseHp: 700, baseSpeed: 1.4, baseArmor: 8, bounty: 32, damageToCore: 2,
    traits: ["regen"], color: 0xff44aa, emissive: 0xff0077, scale: 0.9, shape: "tank",
  },

  // 81-99: elite AI war machines, stealth
  elite_war_machine: {
    kind: "elite_war_machine",
    name: "Elite War Machine",
    baseHp: 1700, baseSpeed: 1.4, baseArmor: 20, shield: 600, bounty: 55, damageToCore: 3,
    traits: ["shield", "regen"], color: 0xff2244, emissive: 0xff0033, scale: 1.05, shape: "elite",
  },
  stealth_unit: {
    kind: "stealth_unit",
    name: "Stealth Unit",
    baseHp: 1100, baseSpeed: 2.4, baseArmor: 6, bounty: 50, damageToCore: 2,
    traits: ["stealth"], color: 0x223355, emissive: 0x6688ff, scale: 0.85, shape: "elite",
  },

  // 100: boss
  omega_titan: {
    kind: "omega_titan",
    name: "Omega Core Titan",
    baseHp: 60000, baseSpeed: 0.7, baseArmor: 35, shield: 25000, bounty: 5000, damageToCore: 50,
    traits: ["boss", "shield", "regen"], color: 0xff00aa, emissive: 0xff00ff, scale: 2.4, shape: "titan",
  },
};

// =============================================================
// Wave definition
// =============================================================

export interface WaveSpawn {
  enemyKind: string;
  count: number;
  intervalMs: number;
  hpMult: number;
  speedMult: number;
  armorBonus: number;
}

export interface WaveDef {
  index: number;          // 1..100
  label: string;
  reward: number;         // bonus cores at end of wave
  spawns: WaveSpawn[];
  isBoss: boolean;
  preview: string[];      // enemy names for UI preview
  resistances: string[];  // human readable
}

// Procedural 100-wave table (data-driven, deterministic)
export function buildWaveTable(): WaveDef[] {
  const waves: WaveDef[] = [];

  for (let i = 1; i <= 100; i++) {
    if (i === 100) {
      waves.push({
        index: 100,
        label: "OMEGA CORE TITAN",
        reward: 2000,
        spawns: [
          { enemyKind: "omega_titan", count: 1, intervalMs: 0, hpMult: 1, speedMult: 1, armorBonus: 0 },
        ],
        isBoss: true,
        preview: ["Omega Core Titan"],
        resistances: ["Heavy Armor", "Shield Regen", "Phase Resist"],
      });
      continue;
    }

    // bracket selection
    let pool: string[];
    let base: number;
    let hpMult: number;
    let speedMult: number;
    let armorBonus = 0;
    let resistances: string[] = [];

    if (i <= 20) {
      pool = i < 8 ? ["scout_drone"] : i < 15 ? ["scout_drone", "light_drone"] : ["light_drone", "recon_flyer"];
      base = 8 + i;
      hpMult = 1 + i * 0.08;
      speedMult = 1 + i * 0.01;
      resistances = i >= 15 ? ["Light Armor"] : [];
    } else if (i <= 40) {
      pool = i < 30 ? ["walker", "light_drone"] : ["walker", "shield_bot"];
      base = 10 + Math.floor(i * 0.6);
      hpMult = 1 + i * 0.10;
      speedMult = 1 + i * 0.012;
      armorBonus = Math.floor((i - 20) * 0.4);
      resistances = ["Plate Armor", i >= 30 ? "Energy Shield" : ""].filter(Boolean);
    } else if (i <= 60) {
      pool = i < 50 ? ["hover_mech", "walker"] : ["hover_mech", "emp_unit"];
      base = 12 + Math.floor(i * 0.5);
      hpMult = 1 + i * 0.12;
      speedMult = 1 + i * 0.014;
      armorBonus = Math.floor((i - 20) * 0.5);
      resistances = ["Hover Plating", i >= 50 ? "EMP Hardened" : ""].filter(Boolean);
    } else if (i <= 80) {
      pool = i < 70 ? ["heavy_tank", "hover_mech"] : ["heavy_tank", "laser_crawler"];
      base = 8 + Math.floor(i * 0.35);
      hpMult = 1 + i * 0.16;
      speedMult = 1 + i * 0.012;
      armorBonus = Math.floor((i - 20) * 0.7);
      resistances = ["Reactive Armor", i >= 70 ? "Self-Repair" : ""].filter(Boolean);
    } else {
      pool = i < 90 ? ["elite_war_machine", "stealth_unit"] : ["elite_war_machine", "stealth_unit", "heavy_tank"];
      base = 6 + Math.floor(i * 0.3);
      hpMult = 1 + i * 0.20;
      speedMult = 1 + i * 0.013;
      armorBonus = Math.floor((i - 20) * 0.9);
      resistances = ["Cloaking Field", "Adaptive Shielding", "Nano Repair"];
    }

    // every 10th wave is mini-boss-ish (fewer, tankier)
    const elite = i % 10 === 0;
    if (elite) {
      hpMult *= 1.6;
      base = Math.max(3, Math.floor(base * 0.4));
      resistances.push("Elite Plating");
    }

    const spawns: WaveSpawn[] = pool.map((kind, idx) => ({
      enemyKind: kind,
      count: Math.max(1, Math.floor(base / pool.length) + (idx === 0 ? 1 : 0)),
      intervalMs: Math.max(280, 900 - i * 6),
      hpMult,
      speedMult,
      armorBonus,
    }));

    const previewNames = pool.map((k) => ENEMIES[k].name);

    waves.push({
      index: i,
      label: elite ? `Wave ${i} — Elite Surge` : `Wave ${i}`,
      reward: 20 + i * 4,
      spawns,
      isBoss: false,
      preview: previewNames,
      resistances,
    });
  }

  return waves;
}
