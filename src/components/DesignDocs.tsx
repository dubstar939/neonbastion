import { useMemo, useState } from "react";
import { TOWERS, TOWER_ORDER } from "../game/data/towers";
import { ENEMIES, buildWaveTable } from "../game/data/enemies";

interface Props {
  onClose: () => void;
}

type Tab = "design" | "towers" | "enemies" | "waves" | "boss" | "code";

export function DesignDocs({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("design");
  const waves = useMemo(() => buildWaveTable(), []);

  return (
    <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md pointer-events-auto overflow-hidden">
      <div className="h-full flex flex-col max-w-6xl mx-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-mono tracking-[0.3em] text-cyan-300">// NEON BASTION — DESIGN DOCUMENT</h2>
          <button onClick={onClose} className="px-3 py-1 border border-rose-400/60 text-rose-200 rounded hover:bg-rose-500/20 font-mono text-sm">
            ✕ CLOSE
          </button>
        </div>

        <div className="flex gap-1 mb-3 flex-wrap">
          {(
            [
              ["design", "1. Design"],
              ["towers", "2. Towers"],
              ["enemies", "3. Enemies"],
              ["waves", "4. Waves 1-100"],
              ["boss", "5. Omega Titan"],
              ["code", "6. Code Skeleton"],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3 py-1.5 text-xs font-mono rounded border transition ${
                tab === k
                  ? "bg-cyan-500/20 border-cyan-300 text-cyan-100"
                  : "bg-black/40 border-white/10 text-white/60 hover:border-cyan-400/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto pr-2 text-sm leading-relaxed text-white/80">
          {tab === "design" && (
            <Section title="High-Level Design">
              <p>
                <span className="text-cyan-300 font-bold">Neon Bastion</span> is a 3D tower-defense game
                set in 3500 AD. Players defend an arcology core from 100 waves of robotic invaders along
                a fixed neon corridor. The aesthetic is low-poly cyberpunk: dark city, glowing accents
                in cyan/magenta/violet/green, holographic UI.
              </p>
              <h4>Core Loop</h4>
              <ul>
                <li>Earn <em>Energy Cores</em> by killing robotic enemies and surviving waves.</li>
                <li>Spend cores to place and upgrade 7 unique tower archetypes.</li>
                <li>Each tower has 5 levels — level 5 unlocks a <strong>Tier Evolution</strong>.</li>
                <li>Survive escalating wave brackets and defeat the Omega Core Titan on wave 100.</li>
              </ul>
              <h4>Manager Architecture</h4>
              <ul>
                <li><b>GameManager</b> — top-level state machine (menu/playing/paused/won/lost), economy, lives.</li>
                <li><b>WaveManager</b> — 100-wave table, spawn queue, intermissions.</li>
                <li><b>EnemyManager</b> — pooling, status effects (slow/burn/stun), pathfinding along waypoints.</li>
                <li><b>TowerManager</b> — placement validation, target acquisition, firing logic, upgrades.</li>
                <li><b>UIManager</b> — HUD, build menu, upgrade panel, wave preview, boss bar.</li>
              </ul>
              <h4>Pillars</h4>
              <ul>
                <li><b>Data-driven</b> — all towers/enemies/waves come from a single tweakable table.</li>
                <li><b>Pooled</b> — projectiles and enemies recycle through pools to keep the heap quiet.</li>
                <li><b>Readable</b> — small managers, no placeholder code, clear separation of concerns.</li>
              </ul>
            </Section>
          )}

          {tab === "towers" && (
            <Section title="Tower Archetypes & Tier Evolutions">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {TOWER_ORDER.map((k) => {
                  const def = TOWERS[k];
                  const c = `#${def.color.toString(16).padStart(6, "0")}`;
                  return (
                    <div key={k} className="border rounded p-3" style={{ borderColor: c + "66" }}>
                      <div className="flex items-center justify-between">
                        <div className="font-bold" style={{ color: c }}>{def.name}</div>
                        <div className="text-[10px] font-mono text-white/40">L5 → {def.evolvedName}</div>
                      </div>
                      <div className="text-xs text-white/60 mb-2">{def.description}</div>
                      <table className="w-full text-[10px] font-mono">
                        <thead className="text-white/40">
                          <tr><th className="text-left">LV</th><th>COST</th><th>DMG</th><th>RNG</th><th>ROF</th><th>SPECIAL</th></tr>
                        </thead>
                        <tbody>
                          {def.levels.map((l) => (
                            <tr key={l.level} className={l.evolved ? "text-fuchsia-200" : "text-white/80"}>
                              <td>{l.level}{l.evolved ? "★" : ""}</td>
                              <td className="text-center">{l.cost}</td>
                              <td className="text-center">{l.damage}</td>
                              <td className="text-center">{l.range}</td>
                              <td className="text-center">{l.fireRate}</td>
                              <td className="text-[10px]">{l.special ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
              <h4>Tower Schema (TypeScript)</h4>
              <pre className="bg-black/60 border border-cyan-500/30 rounded p-3 text-xs text-cyan-100 overflow-auto">
{`interface TowerDef {
  kind: TowerKind;
  name: string;
  evolvedName: string;     // shown at level 5
  description: string;
  damageType: DamageType;
  color: number; baseColor: number;
  levels: TowerLevelStats[]; // length 5
}
interface TowerLevelStats {
  level: number;       // 1..5
  cost: number;        // build cost (lv1) or upgrade cost
  damage: number;
  range: number;
  fireRate: number;    // shots/sec
  splashRadius?: number;
  slowPct?: number; slowDuration?: number;
  burnDps?: number;  burnDuration?: number;
  pierce?: number; chainTargets?: number;
  armorShred?: number; empStunDuration?: number;
  evolved?: boolean; evolvedName?: string; special?: string;
}`}
              </pre>
            </Section>
          )}

          {tab === "enemies" && (
            <Section title="Enemy Roster">
              <table className="w-full text-xs font-mono">
                <thead className="text-white/50 border-b border-white/10">
                  <tr>
                    <th className="text-left p-1">NAME</th>
                    <th className="p-1">HP</th>
                    <th className="p-1">SPD</th>
                    <th className="p-1">ARM</th>
                    <th className="p-1">SHIELD</th>
                    <th className="p-1">BOUNTY</th>
                    <th className="text-left p-1">TRAITS</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(ENEMIES).map((e) => (
                    <tr key={e.kind} className="border-b border-white/5">
                      <td className="text-white/90 p-1">{e.name}</td>
                      <td className="text-center p-1">{e.baseHp}</td>
                      <td className="text-center p-1">{e.baseSpeed}</td>
                      <td className="text-center p-1">{e.baseArmor}</td>
                      <td className="text-center p-1">{e.shield ?? "—"}</td>
                      <td className="text-center p-1 text-amber-300">⬢ {e.bounty}</td>
                      <td className="p-1 text-cyan-300">{e.traits.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h4>Enemy Schema</h4>
              <pre className="bg-black/60 border border-cyan-500/30 rounded p-3 text-xs text-cyan-100 overflow-auto">
{`interface EnemyDef {
  kind: string; name: string;
  baseHp: number;
  baseSpeed: number;       // units/sec
  baseArmor: number;       // flat damage reduction
  shield?: number;         // separate shield pool
  bounty: number;          // cores on kill
  damageToCore: number;    // lives lost on breach
  traits: ("stealth"|"shield"|"flying"|"emp"|"regen"|"boss")[];
  // visuals
  color: number; emissive: number; scale: number;
  shape: "drone"|"walker"|"hover"|"tank"|"elite"|"titan";
}`}
              </pre>
            </Section>
          )}

          {tab === "waves" && (
            <Section title="Wave Progression Table (1-100)">
              <p className="mb-2 text-white/60">
                Procedurally derived from a wave-bracket schema. Every 10th wave is an elite surge with
                fewer but tankier units. Wave 100 spawns the Omega Core Titan.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-[10px] font-mono">
                {waves.map((w) => (
                  <div
                    key={w.index}
                    className={`p-1.5 rounded border ${
                      w.isBoss
                        ? "border-fuchsia-400/80 bg-fuchsia-900/40 text-fuchsia-100"
                        : w.index % 10 === 0
                        ? "border-amber-400/60 bg-amber-900/20 text-amber-100"
                        : "border-white/10 bg-black/40 text-white/70"
                    }`}
                  >
                    <div className="flex justify-between">
                      <b>W{w.index}</b>
                      <span className="text-amber-300">⬢{w.reward}</span>
                    </div>
                    <div className="truncate">{w.preview.join(", ")}</div>
                    {w.resistances.length > 0 && (
                      <div className="text-rose-300/80 truncate">{w.resistances.join(" · ")}</div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {tab === "boss" && (
            <Section title="Omega Core Titan — Wave 100">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Stat label="HP" value="60,000" />
                <Stat label="Shield (regenerating)" value="25,000" />
                <Stat label="Armor" value="35" />
                <Stat label="Speed" value="0.7 u/s" />
                <Stat label="Bounty" value="⬢ 5000" />
                <Stat label="Damage to Core" value="50 lives" />
              </div>
              <h4>Phase 1 — Awakening (100% – 66% HP)</h4>
              <ul>
                <li>Slow march along the corridor with full shield.</li>
                <li>Summons 2 Scout Drone minions every 11s.</li>
                <li>Continuous shield regen 1.5%/sec.</li>
              </ul>
              <h4>Phase 2 — Disruption (66% – 33% HP)</h4>
              <ul>
                <li>Shield rebuilt to 50% on phase entry.</li>
                <li>Movement speed +20%.</li>
                <li>Summons 3 minions every 7s.</li>
              </ul>
              <h4>Phase 3 — Annihilation (&lt; 33% HP)</h4>
              <ul>
                <li>Shield rebuilt to 35%, movement +15% (cumulative).</li>
                <li>Summons 4 minions every 4s — true swarm pressure.</li>
                <li>Hp regen ramps to 0.1%/sec.</li>
              </ul>
              <h4>Resistances & Counters</h4>
              <ul>
                <li><b>Heavy Armor (35)</b> — bring Railgun / Gauss for armor shred.</li>
                <li><b>Regenerating shields</b> — burst with Plasma Siege or chain Prism Lances.</li>
                <li><b>Phase resist</b> — only EMP and Quantum can target stealth-summoned variants.</li>
                <li><b>Recommended loadout</b> — 1× Singularity Engine (kite/slow), 2× Gauss Accelerator (single-target burst), 2× Plasma Siege (clear summons), 1× Neuro-EMP (drop shields).</li>
              </ul>
            </Section>
          )}

          {tab === "code" && (
            <Section title="Code Skeleton (TypeScript / OOP — engine-agnostic)">
              <p>
                The full implementation is in <code>src/game/engine.ts</code>. Below are the key
                manager surfaces. The same pattern translates directly to C# / Unity (replace
                <code>THREE.Group</code> with <code>GameObject</code>, etc).
              </p>
              <h4>WaveManager</h4>
              <pre className="bg-black/60 border border-cyan-500/30 rounded p-3 text-xs text-cyan-100 overflow-auto">{`class WaveManager {
  waves: WaveDef[] = buildWaveTable();          // 1..100
  currentIndex = -1; queue: SpawnTask[] = [];

  startNextWave() {
    this.currentIndex++;
    const w = this.waves[this.currentIndex];
    let t = 0;
    for (const s of w.spawns)
      for (let i = 0; i < s.count; i++)
        this.queue.push({ def: ENEMIES[s.enemyKind], at: now()+t, hpMult: s.hpMult,
                          speedMult: s.speedMult, armorBonus: s.armorBonus }),
        t += s.intervalMs/1000;
  }

  update(dt: number) {
    while (this.queue.length && this.queue[0].at <= now())
      EnemyManager.spawn(this.queue.shift()!);

    if (this.queue.length === 0 && EnemyManager.alive() === 0)
      GameManager.onWaveCleared(this.waves[this.currentIndex]);
  }
}`}</pre>

              <h4>Tower base + upgrade</h4>
              <pre className="bg-black/60 border border-cyan-500/30 rounded p-3 text-xs text-cyan-100 overflow-auto">{`abstract class Tower {
  level = 1;
  constructor(public def: TowerDef, public pos: Vec3) {}
  get stats(): TowerLevelStats { return this.def.levels[this.level-1]; }

  update(dt: number, enemies: Enemy[]) {
    this.cooldown -= dt;
    const target = this.acquireTarget(enemies, this.stats.range);
    if (target && this.cooldown <= 0) {
      this.cooldown = 1 / this.stats.fireRate;
      this.fire(target);
    }
  }
  abstract fire(target: Enemy): void;

  upgrade(cores: ResourceSystem): boolean {
    if (this.level >= 5) return false;
    const cost = this.def.levels[this.level].cost;
    if (!cores.spend(cost)) return false;
    this.level++;                 // level 5 = Tier Evolution
    return true;
  }
}`}</pre>

              <h4>Enemy base</h4>
              <pre className="bg-black/60 border border-cyan-500/30 rounded p-3 text-xs text-cyan-100 overflow-auto">{`class Enemy {
  hp: number; shield: number; armor: number; speed: number;
  segIndex = 0; segT = 0; alive = true;

  update(dt: number) {
    if (this.stunUntil > now()) return;
    this.advanceAlongPath(dt * this.speed);
    if (this.burnUntil > now()) this.takeDamage(this.burnDps*dt, true);
  }

  takeDamage(d: number, dot=false) {
    if (!dot) d = Math.max(1, d - this.armor);
    if (this.shield > 0) {
      const a = Math.min(this.shield, d);
      this.shield -= a; d -= a;
    }
    if ((this.hp -= d) <= 0) this.die();
  }
}`}</pre>

              <h4>Pathfinding / movement</h4>
              <pre className="bg-black/60 border border-cyan-500/30 rounded p-3 text-xs text-cyan-100 overflow-auto">{`advanceAlongPath(distance: number) {
  while (distance > 0 && this.segIndex < PATH.length-1) {
    const a = PATH[this.segIndex], b = PATH[this.segIndex+1];
    const segLen = a.distanceTo(b);
    const remain = segLen * (1 - this.segT);
    if (distance < remain) { this.segT += distance/segLen; return; }
    distance -= remain; this.segIndex++; this.segT = 0;
  }
  if (this.segIndex >= PATH.length-1) GameManager.coreHit(this);
}`}</pre>

              <h4>Resource system (Energy Cores)</h4>
              <pre className="bg-black/60 border border-cyan-500/30 rounded p-3 text-xs text-cyan-100 overflow-auto">{`class ResourceSystem {
  cores = 250;
  earn(n: number)  { this.cores += n; UIManager.refresh(); }
  spend(n: number) {
    if (this.cores < n) return false;
    this.cores -= n; UIManager.refresh(); return true;
  }
}`}</pre>

              <h4>UI hooks</h4>
              <pre className="bg-black/60 border border-cyan-500/30 rounded p-3 text-xs text-cyan-100 overflow-auto">{`class UIManager {
  refresh() {
    HUD.lives  = GameManager.lives;
    HUD.cores  = ResourceSystem.cores;
    HUD.wave   = WaveManager.currentIndex + 1;
    HUD.total  = 100;
  }

  showUpgrade(tower: Tower) {
    const cur  = tower.stats;
    const next = tower.def.levels[tower.level]; // may be undefined
    UpgradePanel.render({
      name: tower.level === 5 ? tower.def.evolvedName : tower.def.name,
      current: cur, next, cost: next?.cost,
      isEvolution: tower.level === 4,
    });
  }

  previewWave(w: WaveDef) {
    WavePreview.render({ label: w.label, enemies: w.preview,
                         resistances: w.resistances, reward: w.reward });
  }
}`}</pre>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 [&_h4]:text-cyan-300 [&_h4]:font-mono [&_h4]:tracking-widest [&_h4]:mt-4 [&_h4]:text-sm [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:space-y-1 [&_code]:text-fuchsia-300 [&_code]:font-mono">
      <h3 className="text-lg font-bold text-fuchsia-300 border-b border-fuchsia-500/30 pb-1">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-fuchsia-500/30 rounded p-2 bg-fuchsia-900/10">
      <div className="text-[10px] text-white/50 font-mono tracking-widest">{label}</div>
      <div className="text-fuchsia-200 font-bold">{value}</div>
    </div>
  );
}
