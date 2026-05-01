import type { WaveDef } from "../game/data/enemies";

interface Props {
  current: WaveDef | null;
  next: WaveDef | null;
  intermission: boolean;
  onStartNow: () => void;
}

export function WavePreview({ current, next, intermission, onStartNow }: Props) {
  const showWave = current ?? next;
  if (!showWave) return null;

  const display = intermission ? next : current;
  if (!display) return null;
  return (
    <div className="pointer-events-auto absolute left-4 top-32 w-72 z-20">
      <div className={`border ${display.isBoss ? "border-fuchsia-400/70" : "border-cyan-500/40"} bg-black/70 backdrop-blur-md rounded-lg p-3`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono tracking-widest text-white/50">
              {intermission ? "// INCOMING" : "// CURRENT"}
            </div>
            <div className={`font-bold ${display.isBoss ? "text-fuchsia-200" : "text-cyan-100"}`}>
              {display.label}
            </div>
          </div>
          {intermission && (
            <button
              onClick={onStartNow}
              className="px-2 py-1 text-[10px] font-mono tracking-widest border border-emerald-400/60 bg-emerald-500/10 text-emerald-200 rounded hover:bg-emerald-400/20"
            >
              ▶ START
            </button>
          )}
        </div>

        <div className="mt-2">
          <div className="text-[9px] tracking-widest text-white/40">ENEMY TYPES</div>
          <ul className="mt-1 space-y-0.5">
            {display.preview.map((p, i) => (
              <li key={i} className="text-xs text-white/80 font-mono flex items-center gap-1.5">
                <span className="text-cyan-300">▸</span> {p}
              </li>
            ))}
          </ul>
        </div>

        {display.resistances.length > 0 && (
          <div className="mt-2">
            <div className="text-[9px] tracking-widest text-white/40">RESISTANCES</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {display.resistances.map((r, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-rose-400/40 bg-rose-500/10 text-rose-200 font-mono">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-2 text-[10px] font-mono text-amber-200">
          REWARD ⬢ {display.reward}
        </div>
      </div>
    </div>
  );
}
