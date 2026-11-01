import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CATEGORIES, type ItemDTO } from "@fashionos/shared";
import { api } from "../lib/api";
import { Chips, PageLoader, Sheet } from "./ui";
import { ItemCard } from "./ItemCard";

export function useAllItems() {
  return useQuery({ queryKey: ["items", "all"], queryFn: () => api.get<{ items: ItemDTO[] }>("/api/items").then((r) => r.items) });
}

/** Gardıroptan parça seçme penceresi (tekli veya çoklu) */
export function ItemPicker({
  open,
  onClose,
  selected,
  onToggle,
  title = "Parça seç",
}: {
  open: boolean;
  onClose: () => void;
  selected: string[];
  onToggle: (item: ItemDTO) => void;
  title?: string;
}) {
  const items = useAllItems();
  const [cat, setCat] = useState("");
  const list = (items.data ?? []).filter((i) => !cat || i.category === cat);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <Chips scroll options={[["", "Tümü"], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.label] as [string, string])]} value={cat} onChange={setCat} />
      {items.isLoading ? (
        <PageLoader />
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {list.map((i) => (
            <ItemCard key={i.id} item={i} selected={selected.includes(i.id)} onClick={() => onToggle(i)} />
          ))}
        </div>
      )}
      <button className="btn-primary sticky bottom-0 mt-4 w-full" onClick={onClose}>Tamam</button>
    </Sheet>
  );
}
