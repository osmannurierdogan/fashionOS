import { useState } from "react";
import { Plus, X } from "lucide-react";
import { PALETTE, nearestPaletteColor, type ItemColor } from "@fashionos/shared";
import { Sheet } from "./ui";

export function ColorEditor({ value, onChange }: { value: ItemColor[]; onChange: (c: ItemColor[]) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("#888888");
  const add = (hex: string) => {
    if (value.length >= 5 || value.some((c) => c.hex.toLowerCase() === hex.toLowerCase())) return;
    onChange([...value, { hex: hex.toLowerCase(), name: nearestPaletteColor(hex).name }]);
    setOpen(false);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((c, i) => (
        <span key={c.hex + i} className="chip pr-1.5">
          <span className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} />
          {c.name ?? nearestPaletteColor(c.hex).name}
          {i === 0 && <span className="text-[10px] text-stone-400">ana</span>}
          <button type="button" aria-label="Rengi kaldır" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-full p-0.5 hover:bg-stone-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      {value.length < 5 && (
        <button type="button" className="chip" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Renk
        </button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Renk ekle">
        <div className="grid grid-cols-5 gap-3">
          {PALETTE.map((p) => (
            <button key={p.key} type="button" onClick={() => add(p.hex)} className="flex flex-col items-center gap-1">
              <span className="h-10 w-10 rounded-full ring-1 ring-black/10" style={{ background: p.hex }} />
              <span className="text-[11px] leading-tight text-stone-600">{p.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-3">
          <input type="color" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-10 w-14 rounded-lg" aria-label="Özel renk" />
          <button type="button" className="btn-secondary" onClick={() => add(custom)}>
            Özel rengi ekle ({nearestPaletteColor(custom).name})
          </button>
        </div>
      </Sheet>
    </div>
  );
}
