import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ShieldCheck, Truck, Headset, BadgePercent, ArrowRight, Zap } from "lucide-react";
import { getStorefront } from "@/lib/catalog.functions";
import { ProductCard } from "@/components/site/ProductCard";
import { CategoryIcon } from "@/components/site/CategoryIcon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STORE, whatsappLink } from "@/lib/store-config";
import { trackAdClick, trackAdView } from "@/lib/track";
import { FlashCountdown } from "@/components/site/FlashCountdown";
import { RecentlyViewed } from "@/components/site/RecentlyViewed";
import { Testimonials } from "@/components/site/Testimonials";

const storefrontQuery = queryOptions({
  queryKey: ["storefront"],
  queryFn: () => getStorefront(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(storefrontQuery),
  head: () => ({
    meta: [
      { title: "ABAWINA MALL — Appliances, TVs & Lifestyle Store in Mombasa" },
      {
        name: "description",
        content:
          "Shop fridges, smart TVs, kitchen appliances, phones, computers, fashion and beauty at ABAWINA MALL Mombasa. Fast delivery, M-Pesa on delivery, genuine warranty.",
      },
      { property: "og:title", content: "ABAWINA MALL — Mombasa's Home & Lifestyle Mall" },
      {
        property: "og:description",
        content:
          "Genuine appliances, electronics and lifestyle products with fast Mombasa delivery and countrywide courier.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "DepartmentStore",
          name: STORE.name,
          description: STORE.tagline,
          telephone: STORE.phone,
          email: STORE.email,
          address: {
            "@type": "PostalAddress",
            streetAddress: "Links Road, Nyali & Digo Road CBD",
            addressLocality: "Mombasa",
            postalCode: "80100",
            addressCountry: "KE",
          },
          priceRange: "KSh",
        }),
      },
    ],
  }),
  component: Home,
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold">The shop didn't load</h1>
      <p className="mt-2 text-muted-foreground">Please refresh the page to try again.</p>
    </div>
  ),
});

const PERKS = [
  { icon: Truck, title: "Fast Mombasa delivery", text: "Same-day in CBD, Nyali & Kizingo" },
  { icon: ShieldCheck, title: "Genuine warranty", text: "Manufacturer-backed on every item" },
  { icon: BadgePercent, title: "Lipa na M-Pesa", text: "Pay on delivery or before dispatch" },
  { icon: Headset, title: "Real human help", text: `Talk to us on ${STORE.phoneDisplay}` },
];

type StoreData = ReturnType<typeof useStorefrontData>;
function useStorefrontData() {
  return useSuspenseQuery(storefrontQuery).data;
}

function HeroCarousel({ data }: { data: StoreData }) {
  const slides = data.campaigns;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  const activeId = slides[index]?.id;
  useEffect(() => {
    if (activeId) trackAdView(activeId);
  }, [activeId]);

  if (!slides.length) return null;

  return (
    <div className="surface-panel relative h-full min-h-56 overflow-hidden sm:min-h-80 lg:min-h-96">
      {slides.map((slide, i) => {
        const slug = data.categories.find((c) => c.id === slide.category_id)?.slug ?? "appliances";
        const active = i === index;
        return (
          <Link
            key={slide.id}
            to="/category/$slug"
            params={{ slug }}
            aria-hidden={!active}
            tabIndex={active ? 0 : -1}
            onClick={() => trackAdClick(slide.id)}
            className={`absolute inset-0 transition-all duration-700 ease-out ${
              active ? "z-10 scale-100 opacity-100" : "pointer-events-none scale-105 opacity-0"
            }`}
          >
            {slide.image_url ? (
              <img loading={i === 0 ? "eager" : "lazy"} decoding="async" src={slide.image_url} alt={slide.title} className="h-full w-full object-cover" />
            ) : (
              <div className="bg-hero-glow h-full w-full" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div
              className={`absolute inset-x-0 bottom-0 p-3 transition-all delay-200 duration-700 sm:p-6 ${
                active ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
            >
              <div className="flex flex-wrap gap-1.5">
                <Badge className="text-[10px] uppercase tracking-wide sm:text-xs">Mombasa · Nyali · CBD</Badge>
                {slide.discount_label ? (
                  <Badge variant="destructive" className="text-[10px] uppercase sm:text-xs">
                    {slide.discount_label}
                  </Badge>
                ) : null}
              </div>
              <h2 className="mt-2 line-clamp-2 font-display text-lg font-bold leading-tight sm:text-3xl">
                {slide.headline ?? slide.title}
              </h2>
              {slide.description ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">{slide.description}</p>
              ) : null}
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground sm:text-sm">
                {slide.cta_text ?? "Shop now"} <ArrowRight className="size-3.5" />
              </span>
            </div>
          </Link>
        );
      })}
      <div className="absolute right-3 top-3 z-20 flex gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.id}
            aria-label={`Show advert ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === index ? "w-6 bg-primary" : "w-1.5 bg-foreground/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function Home() {
  const data = useStorefrontData();

  return (
    <div>
      <section className="mx-auto max-w-7xl px-2 py-3 sm:px-4 sm:py-6">
        <div className="grid grid-cols-[20%_minmax(0,1fr)] gap-2 sm:gap-4">
          <nav
            aria-label="Categories"
            className="surface-panel flex max-h-56 flex-col gap-0.5 overflow-y-auto p-1 sm:max-h-80 lg:max-h-96 sm:p-2"
          >
            {data.categories.map((category, i) => (
              <Link
                key={category.id}
                to="/category/$slug"
                params={{ slug: category.slug }}
                style={{ animationDelay: `${i * 40}ms` }}
                className="animate-fade-in flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-center text-muted-foreground transition-colors hover:bg-secondary hover:text-primary sm:flex-row sm:gap-2 sm:px-2 sm:text-left"
              >
                <CategoryIcon name={category.icon} className="size-4 shrink-0 text-primary sm:size-5" />
                <span className="line-clamp-2 min-w-0 text-[9px] font-medium leading-tight sm:text-sm">
                  {category.name}
                </span>
              </Link>
            ))}
          </nav>
          <HeroCarousel data={data} />
        </div>
      </section>

      {data.flash.length ? (
        <section className="mx-auto max-w-7xl px-2 py-4 sm:px-4 sm:py-6">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-destructive px-3 py-2 text-destructive-foreground">
            <Zap className="size-5 animate-pulse" />
            <h2 className="font-display text-lg font-bold sm:text-xl">Flash deals</h2>
            {data.flash[0]?.flash_ends_at ? (
              <span className="ml-auto text-sm font-semibold">
                Next ends in <FlashCountdown endsAt={data.flash[0]!.flash_ends_at!} />
              </span>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
            {data.flash.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {data.deals.length ? (
        <section className="mx-auto max-w-7xl px-2 py-4 sm:px-4 sm:py-6">
          <div className="flex items-center gap-2">
            <Zap className="size-5 animate-pulse text-primary" />
            <h2 className="font-display text-xl font-bold sm:text-2xl">Top deals</h2>
            <span className="text-xs text-muted-foreground sm:text-sm">Limited stock, real discounts</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
            {data.deals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-2 py-4 sm:px-4 sm:py-6">
        <h2 className="font-display text-xl font-bold sm:text-2xl">More for you</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
          {data.featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <div className="px-2 sm:px-4">
        <RecentlyViewed />
        <Testimonials />
      </div>

      <section className="mx-auto grid max-w-7xl gap-3 px-2 py-8 sm:grid-cols-2 sm:px-4 lg:grid-cols-4">
        {PERKS.map((perk) => (
          <div key={perk.title} className="surface-panel flex items-start gap-3 p-4">
            <perk.icon className="size-6 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold">{perk.title}</p>
              <p className="text-xs text-muted-foreground">{perk.text}</p>
            </div>
          </div>
        ))}
        <Button variant="outline" asChild className="sm:col-span-2 lg:col-span-4">
          <a href={whatsappLink("Hi ABAWINA MALL, I'd like help choosing a product.")} target="_blank" rel="noreferrer">
            Chat on WhatsApp
          </a>
        </Button>
      </section>
    </div>
  );
}
