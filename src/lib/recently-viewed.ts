import { useEffect, useState } from "react";

export type RecentProduct = {
  id: string;
  sku: string | null;
  name: string;
  price: number | string;
  original_price: number | string | null;
  flash_price?: number | string | null;
  flash_ends_at?: string | null;
  rating: number | string;
  reviews_count: number;
  image_url: string | null;
  badge: string | null;
  in_stock: boolean;
};

const KEY = "abawina-recent-v1";
const MAX = 12;
const EVENT = "abawina-recent-change";

function read(): RecentProduct[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as RecentProduct[];
  } catch {
    return [];
  }
}

export function rememberProduct(p: RecentProduct) {
  const list = [p, ...read().filter((x) => x.id !== p.id)].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVENT));
}

export function useRecentlyViewed(excludeId?: string) {
  const [items, setItems] = useState<RecentProduct[]>([]);
  useEffect(() => {
    const sync = () => setItems(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return excludeId ? items.filter((i) => i.id !== excludeId) : items;
}
