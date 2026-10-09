export type PricedProduct = {
  price: number | string;
  original_price?: number | string | null;
  flash_price?: number | string | null;
  flash_ends_at?: string | null;
};

/** A flash deal is live when it has a lower flash price and its end time is still ahead. */
export function isFlashLive(p: PricedProduct, now: Date = new Date()): boolean {
  if (p.flash_price == null || !p.flash_ends_at) return false;
  const flash = Number(p.flash_price);
  return flash > 0 && flash < Number(p.price) && new Date(p.flash_ends_at).getTime() > now.getTime();
}

/** Price the shopper pays right now. */
export function effectivePrice(p: PricedProduct, now: Date = new Date()): number {
  return isFlashLive(p, now) ? Number(p.flash_price) : Number(p.price);
}

/** Price shown struck through, if any. */
export function compareAtPrice(p: PricedProduct, now: Date = new Date()): number | null {
  const pay = effectivePrice(p, now);
  const candidates = [Number(p.price), p.original_price ? Number(p.original_price) : 0];
  const best = Math.max(...candidates);
  return best > pay ? best : null;
}
