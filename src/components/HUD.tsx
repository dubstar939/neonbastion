import type { Stats } from "../game/types";

interface Props {
  stats: Stats;
  bossHp: { hp: number; max: number; shield: number; maxShield: number; phase: number } | null;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSpeedChange: (m: number) => void;
  speed: number;
  onShowDocs: () => void;
}

export function HUD({ stats, bossHp, onPause, onResume, onReset, onSpeedChange, speed, onShowDocs }: Props) {
  const wavePct = stats.totalWaves > 0 ? (stats.wave / stats.totalWaves) * 100 : 0;
  return (
    <div className="pointer-events-none absolute top-0 left-0 right-0 p-4 flex flex-col gap-2 z-20">
      <div className="pointer-events-auto flex flex-wrap items-center gap-3">
        <Pill label="LIVES" value={stats.lives} color="text-rose-300" border="border-rose-500/60" glow="shadow-rose-500/30" />
        <Pill label="ENERGY CORES" value={stats.cores} color="text-cyan-200" border="border-cyan-400/60" glow="shadow-cyan-500/30" />
        <Pill
          label="WAVE"
          value={`${Math.max(0, stats.wave)} / ${stats.totalWaves}`}
          color="text-fuchsia-200"
          border="border-fuchsia-400/60"
          glow="shadow-fuchsia-500/30"
        />
        <Pill label="ALIVE" value={stats.enemiesAlive} color="text-amber-200" border="border-amber-400/60" glow="shadow-amber-500/30" />
        <Pill label="KILLS" value={stats.killCount} color="text-emerald-200" border="border-emerald-400/60" glow="shadow-emerald-500/30" />
        <div className="flex-1" />
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-cyan-500/40 bg-black/60 backdrop-blur-sm">
          <span className="text-[10px] tracking-widest text-cyan-300">SPEED</span>
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-2 py-0.5 text-xs font-mono rounded border transition ${
                speed === s
                  ? "bg-cyan-400/30 text-cyan-100 border-cyan-300"
                  : "bg-transparent text-cyan-300/70 border-cyan-500/30 hover:border-cyan-300"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        {stats.state === "playing" && (
          <button
            onClick={onPause}
            className="px-3 py-2 text-xs font-mono uppercase tracking-widest rounded border border-fuchsia-400/60 bg-black/60 text-fuchsia-200 hover:bg-fuchsia-500/20 transition"
          >
            Pause
          </button>
        )}
        {stats.state === "paused" && (
          <button
            onClick={onResume}
            className="px-3 py-2 text-xs font-mono uppercase tracking-widest rounded border border-emerald-400/60 bg-black/60 text-emerald-200 hover:bg-emerald-500/20 transition"
          >
            Resume
          </button>
        )}
        <button
          onClick={onShowDocs}
          className="px-3 py-2 text-xs font-mono uppercase tracking-widest rounded border border-cyan-400/60 bg-black/60 text-cyan-200 hover:bg-cyan-500/20 transition"
        >
          Design Doc
        </button>
        <button
          onClick={onReset}
          className="px-3 py-2 text-xs font-mono uppercase tracking-widest rounded border border-rose-400/60 bg-black/60 text-rose-200 hover:bg-rose-500/20 transition"
        >
          Reset
        </button>
      </div>

      {/* Wave progress bar */}
      <div className="pointer-events-auto mt-1">
        <div className="h-1.5 w-full bg-fuchsia-950/60 border border-fuchsia-500/30 rounded overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-rose-400 transition-all"
            style={{ width: `${wavePct}%` }}
          />
        </div>
        {stats.intermission && stats.intermissionLeft > 0 && (
          <div className="text-[10px] mt-1 font-mono text-cyan-300 tracking-widest">
            NEXT WAVE IN {stats.intermissionLeft.toFixed(1)}s
          </div>
        )}
      </div>

      {/* Boss bar */}
      {bossHp && (
        <div className="pointer-events-auto mt-2 mx-auto w-full max-w-2xl border border-fuchsia-500/60 bg-black/70 backdrop-blur-md rounded-md p-2">
          <div className="flex justify-between text-[10px] font-mono tracking-widest text-fuchsia-200 mb-1">
            <span>OMEGA CORE TITAN — PHASE {bossHp.phase}</span>
            <span>{Math.ceil(bossHp.hp).toLocaleString()} / {bossHp.max.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-fuchsia-950 rounded overflow-hidden border border-fuchsia-500/40">
            <div className="h-full bg-gradient-to-r from-rose-500 to-fuchsia-400" style={{ width: `${(bossHp.hp / bossHp.max) * 100}%` }} />
          </div>
          {bossHp.maxShield > 0 && (
            <div className="h-1.5 mt-1 bg-cyan-950 rounded overflow-hidden border border-cyan-500/40">
              <div className="h-full bg-gradient-to-r from-cyan-300 to-blue-400" style={{ width: `${(bossHp.shield / bossHp.maxShield) * 100}%` }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Pill({ label, value, color, border, glow }: { label: string; value: any; color: string; border: string; glow: string }) {
  return (
    <div className={`px-3 py-2 rounded-md border ${border} bg-black/60 backdrop-blur-sm shadow-lg ${glow}`}>
      <div className="text-[9px] tracking-[0.2em] text-white/50">{label}</div>
      <div className={`text-lg font-mono leading-tight ${color}`}>{value}</div>
    </div>
  );
}
