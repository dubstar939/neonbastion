import type { Stats } from "../game/types";

interface Props {
  stats: Stats;
  onStart: () => void;
  onReset: () => void;
}

export function StartOverlay({ stats, onStart, onReset }: Props) {
  if (stats.state === "playing" || stats.state === "paused") return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
      <div className="text-center max-w-2xl px-6">
        {stats.state === "menu" && (
          <>
            <div className="text-[10px] tracking-[0.5em] text-cyan-300 font-mono mb-2">// 3500 AD</div>
            <h1
              className="text-6xl font-black tracking-tight"
              style={{
                background: "linear-gradient(90deg,#00e5ff,#ff2bd6,#9d4bff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 0 40px rgba(255,43,214,0.4)",
              }}
            >
              NEON BASTION
            </h1>
            <div className="text-cyan-200 mt-2 font-mono text-sm tracking-widest">100 WAVES · 7 TOWERS · 1 OMEGA TITAN</div>
            <p className="text-white/70 mt-6 leading-relaxed">
              The arcology core is the last beacon of human cognition.
              Build defensive arrays along the corridor and survive 100 waves of robotic incursion,
              culminating in the <span className="text-fuchsia-300 font-semibold">Omega Core Titan</span>.
            </p>
            <button
              onClick={onStart}
              className="mt-8 px-10 py-4 text-xl font-mono tracking-[0.3em] border-2 border-cyan-300 text-cyan-100 bg-cyan-500/10 hover:bg-cyan-400/20 rounded transition shadow-2xl shadow-cyan-500/40"
            >
              ▶ INITIATE DEFENSE
            </button>
            <div className="text-[10px] mt-4 text-white/40 font-mono">
              LMB: select / build &nbsp;·&nbsp; RMB: cancel &nbsp;·&nbsp; Hotkeys 1-7
            </div>
          </>
        )}

        {stats.state === "won" && (
          <>
            <div className="text-[10px] tracking-[0.5em] text-emerald-300 font-mono mb-2">// VICTORY</div>
            <h1 className="text-6xl font-black text-emerald-200" style={{ textShadow: "0 0 40px rgba(0,255,170,0.5)" }}>
              CORE SECURED
            </h1>
            <p className="text-white/70 mt-4">
              You destroyed the Omega Core Titan and survived all 100 waves.
            </p>
            <div className="mt-4 text-cyan-200 font-mono">
              KILLS {stats.killCount} · DAMAGE {stats.damageDealt.toLocaleString()} · LIVES LEFT {stats.lives}
            </div>
            <button
              onClick={onReset}
              className="mt-8 px-10 py-4 text-xl font-mono tracking-[0.3em] border-2 border-emerald-300 text-emerald-100 bg-emerald-500/10 hover:bg-emerald-400/20 rounded"
            >
              ⟲ NEW GAME
            </button>
          </>
        )}

        {stats.state === "lost" && (
          <>
            <div className="text-[10px] tracking-[0.5em] text-rose-300 font-mono mb-2">// CORE BREACH</div>
            <h1 className="text-6xl font-black text-rose-300" style={{ textShadow: "0 0 40px rgba(255,80,120,0.5)" }}>
              SYSTEM LOST
            </h1>
            <p className="text-white/70 mt-4">
              The robotic legion overwhelmed your defenses on wave {stats.wave}.
            </p>
            <div className="mt-4 text-cyan-200 font-mono">
              KILLS {stats.killCount} · DAMAGE {stats.damageDealt.toLocaleString()}
            </div>
            <button
              onClick={onReset}
              className="mt-8 px-10 py-4 text-xl font-mono tracking-[0.3em] border-2 border-rose-300 text-rose-100 bg-rose-500/10 hover:bg-rose-400/20 rounded"
            >
              ⟲ TRY AGAIN
            </button>
          </>
        )}
      </div>
    </div>
  );
}
