import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { subcategoryLabel, type ItemDTO } from "@fashionos/shared";
import { cn } from "../lib/utils";

export function ItemThumb({ item, className }: { item: ItemDTO; className?: string }) {
  return (
    <div className={cn("relative aspect-square overflow-hidden rounded-2xl bg-stone-100", className)}>
      <img src={item.image.thumbUrl} alt={item.name} loading="lazy" className="h-full w-full object-contain p-2" />
      {item.favorite && <Heart className="absolute top-2 right-2 h-4 w-4 fill-rose-500 text-rose-500" />}
    </div>
  );
}

export function itemTitle(i: ItemDTO) {
  return i.name || `${i.colors[0]?.name ?? ""} ${subcategoryLabel(i.category, i.subcategory)}`.trim();
}

export function ItemCard({ item, to, onClick, selected }: { item: ItemDTO; to?: string; onClick?: () => void; selected?: boolean }) {
  const body = (
    <>
      <ItemThumb item={item} className={cn(selected && "ring-2 ring-ink")} />
      <div className="mt-1.5 px-0.5">
        <p className="truncate text-sm font-medium">{itemTitle(item)}</p>
        <div className="mt-0.5 flex items-center gap-1">
          {item.colors.slice(0, 3).map((c) => (
            <span key={c.hex} className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} />
          ))}
          <span className="ml-1 truncate text-xs text-stone-500">{item.brand}</span>
        </div>
      </div>
    </>
  );
  if (to) return <Link to={to} className="block">{body}</Link>;
  return (
    <button type="button" onClick={onClick} className="block w-full text-left">
      {body}
    </button>
  );
}
