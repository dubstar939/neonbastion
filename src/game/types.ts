import type { TowerKind } from "./data/towers";

export interface PlacedTower {
  id: number;
  kind: TowerKind;
  x: number;
  z: number;
  level: number; // 1..5
  cooldown: number;
}

export type GameState = "menu" | "playing" | "paused" | "won" | "lost";

export interface Stats {
  lives: number;
  cores: number;
  wave: number;        // current wave number (1..100), 0 if not started
  totalWaves: number;
  enemiesAlive: number;
  enemiesRemaining: number; // including not-yet-spawned in current wave
  state: GameState;
  intermission: boolean;
  intermissionLeft: number;
  killCount: number;
  damageDealt: number;
}
