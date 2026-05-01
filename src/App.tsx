import { useEffect, useRef, useState } from "react";
import { GameEngine } from "./game/engine";
import type { Stats } from "./game/types";
import { TOWER_ORDER, type TowerKind } from "./game/data/towers";
import { HUD } from "./components/HUD";
import { BuildMenu } from "./components/BuildMenu";
import { UpgradePanel } from "./components/UpgradePanel";
import { WavePreview } from "./components/WavePreview";
import { StartOverlay } from "./components/StartOverlay";
import { StartMenu } from "./components/StartMenu";
import { DesignDocs } from "./components/DesignDocs";

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [stats, setStats] = useState<Stats>({
    lives: 25, cores: 250, wave: 0, totalWaves: 100, enemiesAlive: 0, enemiesRemaining: 0,
    state: "menu", intermission: false, intermissionLeft: 0, killCount: 0, damageDealt: 0,
  });
  const [selectedKind, setSelectedKind] = useState<TowerKind | null>(null);
  const [selectedTower, setSelectedTower] = useState<{ id: number; kind: TowerKind; level: number } | null>(null);
  const [bossHp, setBossHp] = useState<{ hp: number; max: number; shield: number; maxShield: number; phase: number } | null>(null);
  const [speed, setSpeed] = useState(1);
  const [showDocs, setShowDocs] = useState(false);
  const [, forceTick] = useState(0);

  // mount engine
  useEffect(() => {
    if (!containerRef.current) return;
    const engine = new GameEngine(containerRef.current, {
      onStats: setStats,
      onPlacedChange: () => forceTick((n) => n + 1),
      onSelectionChange: (id) => {
        if (id === null) setSelectedTower(null);
        else setSelectedTower(engine.getSelectedTower());
      },
    });
    engineRef.current = engine;
    return () => engine.dispose();
  }, []);

  // poll boss hp at ~10Hz
  useEffect(() => {
    const i = setInterval(() => {
      if (engineRef.current) setBossHp(engineRef.current.getBoss());
    }, 100);
    return () => clearInterval(i);
  }, []);

  // refresh selected tower stats when stats change (level might have updated)
  useEffect(() => {
    if (engineRef.current) setSelectedTower(engineRef.current.getSelectedTower());
  }, [stats.cores]);

  // hotkeys (only when in-game)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showDocs) return;
      if (stats.state !== "playing" && stats.state !== "paused") return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= TOWER_ORDER.length) {
        const k = TOWER_ORDER[n - 1];
        engineRef.current?.setBuildKind(k);
        setSelectedKind(k);
      } else if (e.key === "Escape") {
        engineRef.current?.setBuildKind(null);
        setSelectedKind(null);
      } else if (e.key === " ") {
        e.preventDefault();
        if (stats.state === "playing" && stats.intermission) engineRef.current?.startNextWave();
      } else if (e.key.toLowerCase() === "u" && selectedTower) {
        engineRef.current?.upgradeSelected();
        setSelectedTower(engineRef.current?.getSelectedTower() ?? null);
      } else if (e.key.toLowerCase() === "p") {
        if (stats.state === "playing") engineRef.current?.pause();
        else if (stats.state === "paused") engineRef.current?.resume();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stats.state, stats.intermission, selectedTower, showDocs]);

  const handleSelectKind = (k: TowerKind | null) => {
    setSelectedKind(k);
    engineRef.current?.setBuildKind(k);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white select-none">
      {/* Three.js canvas mount */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Scanline / vignette overlay for cyberpunk feel */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.7) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-10 mix-blend-overlay opacity-15"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,255,255,0.06) 0px, rgba(0,255,255,0.06) 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* HUD only during gameplay */}
      {(stats.state === "playing" || stats.state === "paused") && (
        <HUD
          stats={stats}
          bossHp={bossHp}
          onPause={() => engineRef.current?.pause()}
          onResume={() => engineRef.current?.resume()}
          onReset={() => {
            engineRef.current?.reset();
            setSelectedTower(null);
            setSelectedKind(null);
          }}
          onSpeedChange={(m) => {
            setSpeed(m);
            engineRef.current?.setSpeed(m);
          }}
          speed={speed}
          onShowDocs={() => setShowDocs(true)}
        />
      )}

      {(stats.state === "playing" || stats.state === "paused") && (
        <>
          <BuildMenu selectedKind={selectedKind} cores={stats.cores} onSelect={handleSelectKind} />
          <WavePreview
            current={engineRef.current?.getCurrentWaveDef() ?? null}
            next={engineRef.current?.getNextWaveDef() ?? null}
            intermission={stats.intermission || stats.wave === 0}
            onStartNow={() => engineRef.current?.startNextWave()}
          />
          <UpgradePanel
            selected={selectedTower}
            cores={stats.cores}
            onUpgrade={() => {
              engineRef.current?.upgradeSelected();
              setSelectedTower(engineRef.current?.getSelectedTower() ?? null);
            }}
            onSell={() => engineRef.current?.sellSelected()}
            onClose={() => engineRef.current?.selectTower(null)}
          />
        </>
      )}

      {/* Real Start Menu when in menu state */}
      {stats.state === "menu" && (
        <StartMenu
          onStart={(diff) => engineRef.current?.startGame(diff)}
          onShowDocs={() => setShowDocs(true)}
        />
      )}

      {/* Win / Lose overlay */}
      {(stats.state === "won" || stats.state === "lost") && (
        <StartOverlay
          stats={stats}
          onStart={() => engineRef.current?.startGame()}
          onReset={() => engineRef.current?.reset()}
        />
      )}

      {showDocs && <DesignDocs onClose={() => setShowDocs(false)} />}

      {stats.state === "paused" && !showDocs && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="text-6xl font-black tracking-[0.4em] text-cyan-200" style={{ textShadow: "0 0 30px #00e5ff" }}>
            PAUSED
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
