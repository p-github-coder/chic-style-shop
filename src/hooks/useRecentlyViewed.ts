import { useEffect, useState } from "react";

const KEY = "pl:recentlyViewed";
const MAX = 12;

export type RecentItem = {
  id: string;
  slug: string;
  name: string;
  image: string;
  price: number;
};

function read(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch {
    return [];
  }
}

export function trackRecentlyViewed(item: RecentItem) {
  if (typeof window === "undefined") return;
  const list = read().filter((x) => x.id !== item.id);
  list.unshift(item);
  window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentItem[]>([]);
  useEffect(() => { setItems(read()); }, []);
  return items;
}
