import { supabase } from "@/integrations/supabase/client";

function sessionId() {
  try {
    let id = localStorage.getItem("abawina-session");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("abawina-session", id);
    }
    return id;
  } catch {
    return null;
  }
}

type TrackInput = {
  event_type: "product_view" | "category_view" | "campaign_view" | "campaign_click" | "order";
  product_id?: string | null;
  category_id?: string | null;
  campaign_id?: string | null;
};

export async function track(input: TrackInput) {
  if (typeof window === "undefined") return;
  try {
    await supabase.from("page_events").insert({
      event_type: input.event_type,
      product_id: input.product_id ?? null,
      category_id: input.category_id ?? null,
      campaign_id: input.campaign_id ?? null,
      session_id: sessionId(),
      path: window.location.pathname,
    });
    if (input.campaign_id) {
      const metric = input.event_type === "campaign_click" ? "clicks" : "views";
      await supabase.rpc("bump_campaign_metric", {
        _campaign_id: input.campaign_id,
        _metric: metric,
      });
    }
  } catch {
    /* analytics must never break the page */
  }
}

const AD_KEY = "abawina-ad-click";
const seenAds = new Set<string>();

/** Counts an advert view once per page load. */
export function trackAdView(campaignId: string) {
  if (seenAds.has(campaignId)) return;
  seenAds.add(campaignId);
  void track({ event_type: "campaign_view", campaign_id: campaignId });
}

/** Counts an advert click and remembers it so a later order is credited to it. */
export function trackAdClick(campaignId: string) {
  try {
    sessionStorage.setItem(AD_KEY, campaignId);
  } catch {
    /* ignore */
  }
  void track({ event_type: "campaign_click", campaign_id: campaignId });
}

/** Credits a completed order to the advert the shopper clicked this visit. */
export async function trackOrderConversion() {
  if (typeof window === "undefined") return;
  try {
    const id = sessionStorage.getItem(AD_KEY);
    void track({ event_type: "order", campaign_id: null });
    if (!id) return;
    sessionStorage.removeItem(AD_KEY);
    await supabase.rpc("bump_campaign_metric", { _campaign_id: id, _metric: "conversions" });
  } catch {
    /* ignore */
  }
}
