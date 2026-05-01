import { TOWERS, TOWER_ORDER, type TowerKind } from "../game/data/towers";

interface Props {
  selectedKind: TowerKind | null;
  cores: number;
  onSelect: (k: TowerKind | null) => void;
}

const ICONS: Record<TowerKind, string> = {
  pulse: "◎",
  laser: "✦",
  emp: "⚡",
  plasma: "❂",
  railgun: "↯",
  nano: "✺",
  quantum: "◉",
};

export function BuildMenu({ selectedKind, cores, onSelect }: Props) {
  return (
    <div className="pointer-events-auto absolute bottom-0 left-0 right-0 p-3 z-20">
      <div className="mx-auto max-w-5xl border border-cyan-500/40 bg-black/70 backdrop-blur-md rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-mono tracking-[0.3em] text-cyan-300">// BUILD ARRAY</h2>
          <div className="text-[10px] text-white/40 font-mono">
            Click a tower → click ground to place. Right-click cancels.
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {TOWER_ORDER.map((k) => {
            const def = TOWERS[k];
            const cost = def.levels[0].cost;
            const affordable = cores >= cost;
            const active = selectedKind === k;
            return (
              <button
                key={k}
                onClick={() => onSelect(active ? null : k)}
                disabled={!affordable && !active}
                className={`relative group p-2 rounded-md border-2 transition text-left ${
                  active
                    ? "bg-cyan-500/20 border-cyan-300 shadow-lg shadow-cyan-400/40"
                    : affordable
                    ? "bg-black/60 border-white/10 hover:border-cyan-400/60"
                    : "bg-black/40 border-white/5 opacity-50 cursor-not-allowed"
                }`}
                style={
                  active
                    ? { boxShadow: `0 0 20px #${def.color.toString(16).padStart(6, "0")}88` }
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-9 h-9 rounded flex items-center justify-center text-xl font-bold"
                    style={{
                      background: `#${def.baseColor.toString(16).padStart(6, "0")}`,
                      color: `#${def.color.toString(16).padStart(6, "0")}`,
                      textShadow: `0 0 10px #${def.color.toString(16).padStart(6, "0")}`,
                      border: `1px solid #${def.color.toString(16).padStart(6, "0")}88`,
                    }}
                  >
                    {ICONS[k]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono text-white/60 truncate">{def.name}</div>
                    <div
                      className={`text-xs font-mono ${affordable ? "text-cyan-200" : "text-rose-300"}`}
                    >
                      ⬢ {cost}
                    </div>
                  </div>
                </div>
                <div className="text-[9px] text-white/40 mt-1 leading-tight line-clamp-2">
                  {def.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
