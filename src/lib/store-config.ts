export const STORE = {
  name: "ABAWINA MALL",
  tagline: "Your all-in-one Home Appliances & Lifestyle Mall in Mombasa",
  phone: "+254769705580",
  phoneDisplay: "0769 705 580",
  whatsapp: "254769705580",
  email: "sales@abawinamall.co.ke",
  address: "Links Road, Nyali & Digo Road CBD, Mombasa 80100, Kenya",
  builtBy: { name: "Manucreations", url: "https://manucreations.lovable.app" },
} as const;

export const DELIVERY_ZONES = [
  { name: "City Center / CBD (Fast Delivery)", fee: 300 },
  { name: "Nyali Zone (Fast Delivery)", fee: 300 },
  { name: "Kizingo Zone (Fast Delivery)", fee: 300 },
  { name: "Tudor & Buxton (Fast Delivery)", fee: 350 },
  { name: "Bamburi & Shanzu (Fast Delivery)", fee: 400 },
  { name: "Mtwapa & Coastal Strip", fee: 500 },
  { name: "Changamwe & Port Reitz", fee: 450 },
  { name: "Diani & South Coast", fee: 700 },
  { name: "Voi & Taita Region", fee: 900 },
  { name: "Rest of Kenya (Countrywide Courier)", fee: 1200 },
] as const;

export const MPESA = { number: "0791511386", display: "0791 511 386", name: "Emmanuel Kalama" } as const;
export const MPESA_CODE_RE = /^[A-Z0-9]{10}$/;

// Kenyan mobile numbers: 07XX XXX XXX, 01XX XXX XXX, or +254/254 variants.
export const KE_PHONE_RE = /^(?:\+?254|0)(7|1)\d{8}$/;
export function normalizeKePhone(raw: string) {
  return raw.replace(/[\s-]/g, "");
}

export const PAYMENT_METHODS = [
  { id: "mpesa", label: `M-Pesa — send to ${MPESA.display} (${MPESA.name})` },
  { id: "cash", label: "Cash on delivery" },
  { id: "card", label: "Card on delivery" },
] as const;

export const ORDER_STATUSES = ["new", "confirmed", "dispatched", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function formatKsh(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `KSh ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

export function whatsappLink(message: string) {
  return `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(message)}`;
}
