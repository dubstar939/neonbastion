import { TOWERS, type TowerKind, type TowerLevelStats } from "../game/data/towers";

interface Props {
  selected: { id: number; kind: TowerKind; level: number } | null;
  cores: number;
  onUpgrade: () => void;
  onSell: () => void;
  onClose: () => void;
}

export function UpgradePanel({ selected, cores, onUpgrade, onSell, onClose }: Props) {
  if (!selected) return null;
  const def = TOWERS[selected.kind];
  const cur = def.levels[selected.level - 1];
  const next = selected.level < 5 ? def.levels[selected.level] : null;
  const colorHex = `#${def.color.toString(16).padStart(6, "0")}`;
  const isEvolving = selected.level === 4;

  return (
    <div className="pointer-events-auto absolute right-4 top-28 w-80 z-20">
      <div
        className="border-2 bg-black/80 backdrop-blur-md rounded-lg p-3 shadow-2xl"
        style={{ borderColor: colorHex + "aa", boxShadow: `0 0 30px ${colorHex}55` }}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[10px] font-mono tracking-widest text-white/50">// TOWER</div>
            <div className="text-base font-bold" style={{ color: colorHex, textShadow: `0 0 10px ${colorHex}` }}>
              {selected.level === 5 ? def.evolvedName : def.name}
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-sm px-2">✕</button>
        </div>

        <div className="flex items-center gap-1 mb-3">
          {[1, 2, 3, 4, 5].map((lv) => (
            <div
              key={lv}
              className={`flex-1 h-2 rounded ${lv <= selected.level ? "" : "bg-white/10"}`}
              style={lv <= selected.level ? { background: colorHex, boxShadow: `0 0 6px ${colorHex}` } : undefined}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <StatBlock label="LV" cur={selected.level} next={next ? selected.level + 1 : null} />
          <StatBlock label="DMG" cur={cur.damage} next={next?.damage ?? null} />
          <StatBlock label="RNG" cur={cur.range} next={next?.range ?? null} />
          <StatBlock label="ROF" cur={cur.fireRate.toFixed(2)} next={next?.fireRate ?? null} />
          {(cur.splashRadius || next?.splashRadius) && (
            <StatBlock label="AOE" cur={cur.splashRadius ?? "-"} next={next?.splashRadius ?? null} />
          )}
          {(cur.slowPct || next?.slowPct) && (
            <StatBlock label="SLOW" cur={cur.slowPct ? `${Math.round(cur.slowPct * 100)}%` : "-"} next={next?.slowPct ? `${Math.round(next.slowPct * 100)}%` : null} />
          )}
          {(cur.burnDps || next?.burnDps) && (
            <StatBlock label="BURN/s" cur={cur.burnDps ?? "-"} next={next?.burnDps ?? null} />
          )}
          {(cur.armorShred || next?.armorShred) && (
            <StatBlock label="A.SHRED" cur={cur.armorShred ?? "-"} next={next?.armorShred ?? null} />
          )}
          {(cur.pierce || next?.pierce) && (
            <StatBlock label="PIERCE" cur={cur.pierce ?? "-"} next={next?.pierce ?? null} />
          )}
          {(cur.chainTargets || next?.chainTargets) && (
            <StatBlock label="CHAIN" cur={cur.chainTargets ?? "-"} next={next?.chainTargets ?? null} />
          )}
          {(cur.empStunDuration || next?.empStunDuration) && (
            <StatBlock label="STUN" cur={cur.empStunDuration ? `${cur.empStunDuration}s` : "-"} next={next?.empStunDuration ? `${next.empStunDuration}s` : null} />
          )}
        </div>

        {cur.special && (
          <div className="mt-3 p-2 rounded border border-white/10 bg-white/5 text-[11px] text-white/80">
            <span className="text-cyan-300 font-mono mr-1">SPECIAL:</span>{cur.special}
          </div>
        )}

        {isEvolving && next && (
          <div className="mt-3 p-2 rounded border-2 border-fuchsia-400/70 bg-fuchsia-900/20">
            <div className="text-[10px] font-mono tracking-widest text-fuchsia-300">⚡ TIER EVOLUTION READY</div>
            <div className="text-sm font-bold text-fuchsia-200 mt-0.5">
              {def.name} → {def.evolvedName}
            </div>
            <div className="text-[10px] text-fuchsia-200/70 mt-1">{next.special}</div>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          {next ? (
            <button
              onClick={onUpgrade}
              disabled={cores < next.cost}
              className={`flex-1 px-3 py-2 rounded font-mono text-sm border-2 transition ${
                cores >= next.cost
                  ? "border-cyan-300 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-400/30"
                  : "border-white/10 bg-black/40 text-white/30 cursor-not-allowed"
              }`}
            >
              ▲ Upgrade ⬢{next.cost}
            </button>
          ) : (
            <div className="flex-1 px-3 py-2 rounded font-mono text-sm border-2 border-fuchsia-400/60 bg-fuchsia-900/20 text-fuchsia-200 text-center">
              MAX TIER
            </div>
          )}
          <button
            onClick={onSell}
            className="px-3 py-2 rounded font-mono text-sm border border-rose-400/60 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
          >
            Sell
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, cur, next }: { label: string; cur: any; next: TowerLevelStats[keyof TowerLevelStats] | string | number | null }) {
  const showArrow = next !== null && next !== undefined && next !== cur;
  return (
    <div className="p-2 rounded border border-white/10 bg-black/40">
      <div className="text-[9px] tracking-widest text-white/40">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-white">{cur}</span>
        {showArrow && (
          <>
            <span className="text-white/30">→</span>
            <span className="text-emerald-300">{String(next)}</span>
          </>
        )}
      </div>
    </div>
  );
}
