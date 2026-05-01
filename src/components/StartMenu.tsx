import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TOWERS, TOWER_ORDER, type TowerKind } from "../game/data/towers";
import { buildTowerMesh, buildEnemyMesh } from "../game/factory";
import { ENEMIES } from "../game/data/enemies";

type Difficulty = "recruit" | "operative" | "nightmare";

interface Props {
  onStart: (difficulty: Difficulty) => void;
  onShowDocs: () => void;
}

const DIFFICULTIES: { key: Difficulty; name: string; desc: string; color: string }[] = [
  { key: "recruit", name: "RECRUIT", desc: "40 lives · 400 cores · –25% enemy HP", color: "#39ff14" },
  { key: "operative", name: "OPERATIVE", desc: "25 lives · 250 cores · standard difficulty", color: "#00e5ff" },
  { key: "nightmare", name: "NIGHTMARE", desc: "15 lives · 200 cores · +40% HP, +15% speed", color: "#ff2bd6" },
];

export function StartMenu({ onStart, onShowDocs }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("operative");
  const [previewKind, setPreviewKind] = useState<TowerKind>("pulse");
  const [tab, setTab] = useState<"play" | "towers" | "controls">("play");

  // Mount three.js background
  useEffect(() => {
    if (!canvasRef.current) return;
    const container = canvasRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05050d);
    scene.fog = new THREE.Fog(0x05050d, 8, 35);

    const w = container.clientWidth;
    const h = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(0, 2.5, 7);
    camera.lookAt(0, 1.4, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // lights
    scene.add(new THREE.AmbientLight(0x4060a0, 0.4));
    const k = new THREE.DirectionalLight(0xff66ff, 0.9);
    k.position.set(5, 8, 5);
    scene.add(k);
    const r = new THREE.DirectionalLight(0x00e5ff, 0.9);
    r.position.set(-5, 6, -3);
    scene.add(r);

    // platform
    const plat = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.5, 0.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x0a0a18, emissive: 0x00e5ff, emissiveIntensity: 0.4, metalness: 0.7, roughness: 0.4 })
    );
    plat.position.y = 0.1;
    scene.add(plat);

    // hex grid floor lines
    const grid = new THREE.GridHelper(40, 40, 0x00e5ff, 0x110033);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.18;
    scene.add(grid);

    // distant city
    for (let i = 0; i < 50; i++) {
      const bh = 3 + Math.random() * 14;
      const bw = 0.7 + Math.random() * 1.4;
      const colR = Math.random();
      const col = colR < 0.4 ? 0xff2bd6 : colR < 0.7 ? 0x00e5ff : 0x9d4bff;
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, bw),
        new THREE.MeshStandardMaterial({ color: 0x05050d, emissive: col, emissiveIntensity: 0.4, metalness: 0.7, roughness: 0.5 })
      );
      const a = Math.random() * Math.PI * 2;
      const d = 14 + Math.random() * 18;
      b.position.set(Math.cos(a) * d, bh / 2, Math.sin(a) * d);
      scene.add(b);
    }

    // tower showcase (rebuilt when previewKind changes)
    const towerHolder = new THREE.Group();
    towerHolder.position.set(-1.6, 0.2, 0);
    scene.add(towerHolder);

    // enemy that walks past
    const enemyHolder = new THREE.Group();
    enemyHolder.position.set(2.0, 0.2, 0);
    scene.add(enemyHolder);

    // rain
    const rainCount = 800;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 40;
      rainPos[i * 3 + 1] = Math.random() * 20;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
    const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0x66ccff, size: 0.04, transparent: true, opacity: 0.4 }));
    scene.add(rain);

    // tower / enemy refs we can swap from outside
    const refs = {
      tower: null as THREE.Group | null,
      enemy: null as THREE.Group | null,
      enemyKind: "scout_drone",
      currentTower: "pulse" as TowerKind,
    };
    (renderer.domElement as any)._refs = refs;

    const buildTower = (kind: TowerKind) => {
      if (refs.tower) towerHolder.remove(refs.tower);
      const m = buildTowerMesh(kind, 5); // show fully evolved
      refs.tower = m;
      towerHolder.add(m);
    };
    const buildEnemy = () => {
      if (refs.enemy) enemyHolder.remove(refs.enemy);
      const kinds = ["scout_drone", "walker", "hover_mech", "heavy_tank", "elite_war_machine"];
      const pick = kinds[Math.floor(Math.random() * kinds.length)];
      const m = buildEnemyMesh(ENEMIES[pick]);
      m.position.set(0, 0, 0);
      refs.enemy = m;
      refs.enemyKind = pick;
      enemyHolder.add(m);
    };
    buildTower(previewKind);
    buildEnemy();
    (renderer.domElement as any)._buildTower = buildTower;
    (renderer.domElement as any)._buildEnemy = buildEnemy;

    const clock = new THREE.Clock();
    let raf = 0;
    let enemyT = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const t = clock.getElapsedTime();
      // animate tagged parts on tower
      if (refs.tower) {
        refs.tower.rotation.y += dt * 0.4;
        refs.tower.traverse((c) => {
          const ud: any = (c as any).userData;
          if (!ud) return;
          if (ud.spinSpeed) c.rotation.z += dt * ud.spinSpeed;
          if (ud.pulse) c.scale.setScalar(1 + Math.sin(t * 4 + c.id) * 0.18);
          if (ud.orbit) {
            const o = ud.orbit;
            const rad = o.radius ?? 0.7;
            o.a += dt * (o.speed ?? 1);
            c.position.x = Math.cos(o.a) * rad;
            c.position.z = Math.sin(o.a) * rad;
          }
        });
      }
      // enemy walks across, then resets
      enemyT += dt * 0.5;
      if (refs.enemy) {
        const range = 4;
        const x = (((enemyT % 4) / 4) * range * 2) - range;
        refs.enemy.position.x = x;
        refs.enemy.rotation.y = Math.PI / 2;
        if (refs.enemyKind === "scout_drone" || refs.enemyKind === "hover_mech") {
          refs.enemy.position.y = 1.4 + Math.sin(t * 3) * 0.15;
        }
        // when it loops around, swap to a different enemy
        if (enemyT > 4) {
          enemyT = 0;
          buildEnemy();
        }
      }
      // rain
      const positions = rain.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] -= 18 * dt;
        if (positions[i + 1] < 0) {
          positions[i + 1] = 20;
          positions[i] = (Math.random() - 0.5) * 40;
          positions[i + 2] = (Math.random() - 0.5) * 40;
        }
      }
      rain.geometry.attributes.position.needsUpdate = true;

      // gentle camera sway
      camera.position.x = Math.sin(t * 0.15) * 0.4;
      camera.lookAt(0, 1.4, 0);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const ww = container.clientWidth;
      const hh = container.clientHeight;
      camera.aspect = ww / hh;
      camera.updateProjectionMatrix();
      renderer.setSize(ww, hh);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when previewKind changes, ask renderer to swap tower
  useEffect(() => {
    const dom = canvasRef.current?.querySelector("canvas") as any;
    if (dom?._buildTower) dom._buildTower(previewKind);
  }, [previewKind]);

  const previewDef = TOWERS[previewKind];
  const previewColorHex = `#${previewDef.color.toString(16).padStart(6, "0")}`;

  return (
    <div className="absolute inset-0 z-40 bg-black overflow-hidden">
      {/* 3D animated background */}
      <div ref={canvasRef} className="absolute inset-0" />

      {/* dark vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0.2) 30%, rgba(0,0,0,0.85) 100%)" }} />
      {/* scanlines */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-20"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, rgba(0,255,255,0.08) 0px, rgba(0,255,255,0.08) 1px, transparent 1px, transparent 3px)",
        }}
      />

      <div className="relative h-full flex flex-col items-center justify-center px-6 py-8">
        {/* Title */}
        <div className="text-center mb-3">
          <div className="text-[11px] tracking-[0.6em] text-cyan-300 font-mono mb-2 animate-pulse">
            // YEAR 3500 — ARCOLOGY DEFENSE PROTOCOL
          </div>
          <h1
            className="text-7xl md:text-8xl font-black tracking-tight leading-none"
            style={{
              background: "linear-gradient(90deg,#00e5ff 0%,#ff2bd6 50%,#9d4bff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 30px rgba(255,43,214,0.5))",
            }}
          >
            NEON BASTION
          </h1>
          <div className="mt-2 flex items-center justify-center gap-3 text-cyan-200/80 font-mono text-xs tracking-[0.3em]">
            <span>100 WAVES</span>
            <span className="text-fuchsia-400">◆</span>
            <span>7 TOWERS</span>
            <span className="text-fuchsia-400">◆</span>
            <span>1 OMEGA TITAN</span>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 mb-4">
          {([
            ["play", "▶ PLAY"],
            ["towers", "✦ ARSENAL"],
            ["controls", "⌨ CONTROLS"],
          ] as [typeof tab, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-5 py-2 text-xs font-mono tracking-[0.25em] rounded border-2 transition ${
                tab === k
                  ? "bg-cyan-400/20 border-cyan-300 text-cyan-100 shadow-lg shadow-cyan-500/40"
                  : "bg-black/50 border-white/10 text-white/50 hover:border-cyan-400/50 hover:text-cyan-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Main panel */}
        <div className="w-full max-w-4xl border-2 border-cyan-500/40 bg-black/75 backdrop-blur-md rounded-lg p-5 shadow-2xl shadow-cyan-500/20">
          {tab === "play" && (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] tracking-[0.3em] text-cyan-300 font-mono mb-2">// SELECT DIFFICULTY</div>
                <div className="grid grid-cols-3 gap-3">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.key}
                      onClick={() => setDifficulty(d.key)}
                      className={`p-3 rounded border-2 text-left transition ${
                        difficulty === d.key
                          ? "bg-white/10"
                          : "bg-black/40 border-white/10 hover:bg-white/5"
                      }`}
                      style={
                        difficulty === d.key
                          ? { borderColor: d.color, boxShadow: `0 0 20px ${d.color}66` }
                          : undefined
                      }
                    >
                      <div
                        className="font-bold text-base tracking-widest"
                        style={{ color: d.color, textShadow: `0 0 8px ${d.color}` }}
                      >
                        {d.name}
                      </div>
                      <div className="text-[10px] text-white/60 font-mono mt-1 leading-tight">
                        {d.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-white/70 text-sm leading-relaxed">
                  The arcology core is humanity's last beacon. A robotic legion converges along
                  the neon corridor in <span className="text-fuchsia-300">100 escalating waves</span>,
                  culminating in the multi-phase <span className="text-fuchsia-300">Omega Core Titan</span>.
                  Build, upgrade, and tier-evolve seven towers to hold the line.
                </p>
              </div>

              <button
                onClick={() => onStart(difficulty)}
                className="w-full mt-2 py-4 text-2xl font-mono tracking-[0.4em] rounded border-2 border-cyan-300 bg-gradient-to-r from-cyan-500/20 via-fuchsia-500/20 to-cyan-500/20 hover:from-cyan-500/40 hover:via-fuchsia-500/40 hover:to-cyan-500/40 text-cyan-100 transition shadow-2xl shadow-cyan-500/40"
              >
                ▶ INITIATE DEFENSE
              </button>

              <div className="flex gap-2 justify-center">
                <button
                  onClick={onShowDocs}
                  className="px-4 py-2 text-xs font-mono tracking-widest border border-fuchsia-400/50 bg-fuchsia-500/10 text-fuchsia-200 rounded hover:bg-fuchsia-400/20"
                >
                  📖 DESIGN DOCUMENT
                </button>
              </div>
            </div>
          )}

          {tab === "towers" && (
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4 space-y-1.5 max-h-[400px] overflow-auto pr-1">
                {TOWER_ORDER.map((k) => {
                  const def = TOWERS[k];
                  const c = `#${def.color.toString(16).padStart(6, "0")}`;
                  const active = previewKind === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setPreviewKind(k)}
                      className={`w-full text-left p-2 rounded border-2 transition ${
                        active ? "bg-white/10" : "bg-black/40 border-white/10 hover:bg-white/5"
                      }`}
                      style={active ? { borderColor: c, boxShadow: `0 0 15px ${c}55` } : undefined}
                    >
                      <div className="font-bold text-sm" style={{ color: c, textShadow: `0 0 6px ${c}` }}>
                        {def.name}
                      </div>
                      <div className="text-[10px] text-white/50 font-mono">
                        L5 → {def.evolvedName}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="col-span-8">
                <div className="border-2 rounded p-3" style={{ borderColor: previewColorHex + "88" }}>
                  <div className="text-[10px] tracking-widest text-white/40 font-mono">SHOWN AT TIER 5 (FULLY EVOLVED)</div>
                  <div className="text-2xl font-bold mt-0.5" style={{ color: previewColorHex, textShadow: `0 0 10px ${previewColorHex}` }}>
                    {previewDef.evolvedName}
                  </div>
                  <div className="text-sm text-white/70 mt-2">{previewDef.description}</div>

                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs font-mono">
                    {previewDef.levels.map((l) => (
                      <div key={l.level} className={`p-2 rounded border ${l.evolved ? "border-fuchsia-400/70 bg-fuchsia-900/20" : "border-white/10 bg-black/40"}`}>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-white/60">L{l.level}{l.evolved ? " ★" : ""}</span>
                          <span className="text-amber-300">⬢{l.cost}</span>
                        </div>
                        <div className="text-white/80">DMG {l.damage} · RNG {l.range} · {l.fireRate}/s</div>
                        {l.special && <div className="text-[10px] text-cyan-300 mt-0.5 leading-tight">{l.special}</div>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-[10px] text-white/40 mt-2 font-mono">
                  ← Pick a tower to see it rotating in the showcase to the left.
                </div>
              </div>
            </div>
          )}

          {tab === "controls" && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Section title="Mouse">
                <Key combo="LMB" desc="Select tower / place tower / select unit" />
                <Key combo="RMB drag" desc="Orbit camera around the arena" />
                <Key combo="RMB click" desc="Cancel build / deselect" />
                <Key combo="MMB drag" desc="Orbit camera (alt)" />
                <Key combo="Wheel" desc="Zoom in / out" />
              </Section>
              <Section title="Keyboard">
                <Key combo="1 – 7" desc="Select Pulse / Laser / EMP / Plasma / Rail / Nano / Quantum" />
                <Key combo="U" desc="Upgrade selected tower" />
                <Key combo="P" desc="Pause / resume" />
                <Key combo="Space" desc="Start next wave (during intermission)" />
                <Key combo="Esc" desc="Cancel current build action" />
              </Section>
              <Section title="Gameplay">
                <li>Earn <span className="text-amber-300">⬢ Energy Cores</span> on every kill and at the end of each wave.</li>
                <li>Towers cannot be placed on the path. Hover shows valid (green) / blocked (red) cells.</li>
                <li>Each tower has 5 upgrade levels. <span className="text-fuchsia-300">Level 5 = Tier Evolution</span>.</li>
                <li>Wave 100 spawns the multi-phase <span className="text-fuchsia-300">Omega Core Titan</span>.</li>
                <li>Sell a tower for 60% of its total invested cost.</li>
              </Section>
              <Section title="Counter Tips">
                <li><span className="text-cyan-300">Stealth units</span> can only be targeted by EMP or Quantum towers.</li>
                <li><span className="text-cyan-300">Shielded enemies</span> regenerate — burst through with Plasma or Railgun.</li>
                <li><span className="text-cyan-300">Heavy armor</span> needs Railgun's armor shred or EMP's debuff.</li>
                <li><span className="text-cyan-300">Swarms</span> are best handled with Plasma AoE and Quantum aura.</li>
              </Section>
            </div>
          )}
        </div>

        <div className="mt-3 text-[10px] text-white/30 font-mono tracking-widest">
          v1.0 · NEON BASTION CORE :: SYSTEM READY
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.3em] text-cyan-300 font-mono mb-2">{title}</div>
      <ul className="space-y-1.5 text-white/70 [&_li]:flex [&_li]:gap-2 [&_li]:items-start">
        {children}
      </ul>
    </div>
  );
}

function Key({ combo, desc }: { combo: string; desc: string }) {
  return (
    <li>
      <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/40 text-cyan-100 font-mono text-[11px] min-w-[70px] text-center">
        {combo}
      </span>
      <span className="text-white/70">{desc}</span>
    </li>
  );
}
