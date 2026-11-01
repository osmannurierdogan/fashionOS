import type { ItemDTO } from "@fashionos/shared";
import { cn } from "../lib/utils";

/**
 * Arka planı silinmiş parçaları "flat-lay" düzeninde dizer:
 * sol: dış giyim, orta: üst / alt (veya tek parça), alt: ayakkabı, sağ: aksesuarlar.
 */
export function Collage({ items, className }: { items: ItemDTO[]; className?: string }) {
  const outer = items.find((i) => i.category === "outerwear");
  const tops = items.filter((i) => i.category === "top");
  const bottom = items.find((i) => i.category === "bottom");
  const one = items.find((i) => i.category === "onepiece");
  const shoes = items.find((i) => i.category === "shoes");
  const acc = items.filter((i) => i.category === "accessory").slice(0, 4);

  const Img = ({ it, cls }: { it?: ItemDTO; cls: string }) =>
    it ? (
      <img
        src={it.image.thumbUrl}
        alt={it.name || it.subcategory}
        loading="lazy"
        className={cn("absolute object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.12)]", cls)}
      />
    ) : null;

  const hasSide = Boolean(outer) || tops.length > 1;
  const centerX = hasSide ? "left-[30%] w-[44%]" : "left-[18%] w-[56%]";
  return (
    <div className={cn("relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-stone-100 to-stone-50", className)}>
      {outer && <Img it={outer} cls="left-[2%] top-[4%] h-[52%] w-[38%]" />}
      {!outer && tops[1] && <Img it={tops[1]} cls="left-[2%] top-[4%] h-[46%] w-[34%]" />}
      {outer && tops[1] && <Img it={tops[1]} cls="left-[4%] top-[54%] h-[24%] w-[26%]" />}
      {one ? (
        <Img it={one} cls={cn(centerX, "top-[3%] h-[70%]")} />
      ) : (
        <>
          <Img it={tops[0]} cls={cn(centerX, "top-[3%] h-[38%]")} />
          <Img it={bottom} cls={cn(centerX, "top-[38%] h-[42%]")} />
        </>
      )}
      <Img it={shoes} cls={cn(hasSide ? "left-[34%]" : "left-[24%]", "bottom-[2%] h-[18%] w-[36%]")} />
      {acc.map((a, i) => (
        <div key={a.id} className="absolute right-[2%] h-[18%] w-[22%]" style={{ top: `${5 + i * 23}%` }}>
          <img
            src={a.image.thumbUrl}
            alt={a.name || a.subcategory}
            loading="lazy"
            className="h-full w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.12)]"
          />
        </div>
      ))}
    </div>
  );
}
