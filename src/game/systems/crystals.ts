// =============================================================
// CRYSTAL UPGRADE SYSTEM
// Secondary enhancement layer for towers and units
// Each crystal gives a meaningful, impactful bonus
// =============================================================

export type CrystalType = "damage" | "range" | "speed" | "power";

export interface CrystalUpgrade {
  type: CrystalType;
  level: number;           // 1-3
  bonus: number;           // multiplier or flat bonus
  cost: number;            // Energy Cores to apply
}

export const CRYSTAL_INFO: Record<CrystalType, { name: string; desc: string; icon: string }> = {
  damage: { name: "Ruby Crystal",   desc: "+35% Damage", icon: "♦" },
  range:  { name: "Sapphire Lens",  desc: "+2 Range",    icon: "◈" },
  speed:  { name: "Emerald Core",   desc: "+40% Fire Rate", icon: "✦" },
  power:  { name: "Amethyst Core",  desc: "Stronger Special", icon: "◉" },
};

export function applyCrystal(_currentLevel: number, type: CrystalType): { multiplier: number; rangeBonus: number; fireRateMult: number } {
  let multiplier = 1;
  let rangeBonus = 0;
  let fireRateMult = 1;

  if (type === "damage") multiplier = 1.35;
  if (type === "range") rangeBonus = 2;
  if (type === "speed") fireRateMult = 1.4;
  if (type === "power") multiplier = 1.25; // special effect boost handled in tower logic

  return { multiplier, rangeBonus, fireRateMult };
}
