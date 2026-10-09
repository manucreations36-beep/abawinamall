import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Check, ShieldCheck, ShoppingCart, Star, Truck } from "lucide-react";
import { toast } from "sonner";
import { getProductPage } from "@/lib/catalog.functions";
import { ProductCard } from "@/components/site/ProductCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/lib/cart";
import { formatKsh, whatsappLink } from "@/lib/store-config";
import { track } from "@/lib/track";
import { compareAtPrice, effectivePrice, isFlashLive } from "@/lib/pricing";
import { rememberProduct } from "@/lib/recently-viewed";
import { WishlistButton } from "@/components/site/WishlistButton";
import { FlashCountdown } from "@/components/site/FlashCountdown";
import { ProductReviews } from "@/components/site/ProductReviews";
import { RecentlyViewed } from "@/components/site/RecentlyViewed";
import { BoughtTogether } from "@/components/site/BoughtTogether";

const productQuery = (sku: string) =>
  queryOptions({
    queryKey: ["product", sku],
    queryFn: () => getProductPage({ data: { sku } }),
  });

export const Route = createFileRoute("/product/$sku")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(productQuery(params.sku));
    if (!data.product) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const p = loaderData?.product;
    const title = p ? `${p.name} — ${formatKsh(p.price)} | ABAWINA MALL` : "Product | ABAWINA MALL";
    const description = (
      p?.description ?? "Genuine products with warranty and fast Mombasa delivery."
    ).slice(0, 158);
    const image = p?.image_url?.startsWith("https://") ? p.image_url : null;
    return {
      meta: [
        { title: title.slice(0, 70) },
        { name: "description", content: description },
        { property: "og:title", content: p?.name ?? "ABAWINA MALL" },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
    };
  },
  component: ProductPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold">Product not found</h1>
      <Link to="/" className="mt-4 inline-block text-primary hover:underline">
        Back to the shop
      </Link>
    </div>
  ),
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold">This page didn't load</h1>
    </div>
  ),
});

function ProductPage() {
  const { sku } = Route.useParams();
  const { data } = useSuspenseQuery(productQuery(sku));
  const product = data.product!;
  const cart = useCart();
  const images = [product.image_url, ...product.gallery].filter(Boolean) as string[];
  const [active, setActive] = useState(0);
  const price = effectivePrice(product);
  const original = compareAtPrice(product);
  const flash = isFlashLive(product);
  const specs = (product.specs ?? {}) as Record<string, string>;

  useEffect(() => {
    void track({ event_type: "product_view", product_id: product.id });
    rememberProduct({
      id: product.id, sku: product.sku, name: product.name, price: product.price,
      original_price: product.original_price, flash_price: product.flash_price,
      flash_ends_at: product.flash_ends_at, rating: product.rating,
      reviews_count: product.reviews_count, image_url: product.image_url,
      badge: product.badge, in_stock: product.in_stock,
    });
  }, [product]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">
          Home
        </Link>
        {data.category ? (
          <>
            {" / "}
            <Link
              to="/category/$slug"
              params={{ slug: data.category.slug }}
              className="hover:text-primary"
            >
              {data.category.name}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div>
          <div className="surface-panel aspect-square overflow-hidden bg-secondary">
            {images[active] ? (
              <img loading="eager" decoding="async" src={images[active]} alt={product.name} className="h-full w-full object-cover" />
            ) : null}
          </div>
          {images.length > 1 ? (
            <div className="mt-3 flex gap-3">
              {images.map((img, i) => (
                <button
                  key={img + i}
                  onClick={() => setActive(i)}
                  aria-label={`View image ${i + 1}`}
                  className={`size-20 overflow-hidden rounded-xl border ${i === active ? "border-primary" : "border-border"}`}
                >
                  <img loading="lazy" decoding="async" src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            {product.badge ? <Badge className="uppercase">{product.badge}</Badge> : null}
            {product.brand ? <Badge variant="secondary">{product.brand}</Badge> : null}
          </div>
          <h1 className="mt-3 font-display text-2xl font-extrabold sm:text-3xl">{product.name}</h1>
          <div className="mt-2 flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <a href="#reviews" className="flex items-center gap-2 hover:text-primary">
              <Star className="size-4 fill-accent text-accent" />
              {Number(product.rating).toFixed(1)} · {product.reviews_count} reviews
            </a>
            <WishlistButton productId={product.id} className="size-9 border border-border" />
          </div>
          {flash && product.flash_ends_at ? (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground">
              <span>⚡ Flash deal</span>
              <span>Ends in <FlashCountdown endsAt={product.flash_ends_at} /></span>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className="font-display text-3xl font-extrabold text-primary">
              {formatKsh(price)}
            </span>
            {original ? (
              <>
                <span className="text-muted-foreground line-through">{formatKsh(original)}</span>
                <Badge variant="destructive">
                  Save {formatKsh(original - price)}
                </Badge>
              </>
            ) : null}
          </div>

          <p className="mt-4 text-sm text-muted-foreground">{product.description}</p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              size="lg"
              disabled={!product.in_stock}
              onClick={() => {
                cart.add({
                  id: product.id,
                  sku: product.sku,
                  name: product.name,
                  price,
                  image_url: product.image_url,
                });
                toast.success("Added to cart", { description: product.name });
              }}
            >
              <ShoppingCart className="size-4" />
              {product.in_stock ? "Add to cart" : "Out of stock"}
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a
                href={whatsappLink(
                  `Hi ABAWINA MALL, I'm interested in ${product.name} (${formatKsh(price)}).`,
                )}
                target="_blank"
                rel="noreferrer"
              >
                Order on WhatsApp
              </a>
            </Button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="surface-panel flex items-start gap-2 p-3 text-xs">
              <ShieldCheck className="size-4 text-primary" />
              <span>{product.warranty ?? "Genuine manufacturer warranty"}</span>
            </div>
            <div className="surface-panel flex items-start gap-2 p-3 text-xs">
              <Truck className="size-4 text-primary" />
              <span>
                {product.in_stock
                  ? `In stock (${product.stock_count} units) · fast Mombasa delivery`
                  : "Currently out of stock"}
              </span>
            </div>
          </div>

          {product.features.length ? (
            <div className="mt-6">
              <h2 className="font-display text-lg font-bold">Key features</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {product.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {Object.keys(specs).length ? (
            <div className="mt-6">
              <h2 className="font-display text-lg font-bold">Specifications</h2>
              <dl className="surface-panel mt-3 divide-y divide-border text-sm">
                {Object.entries(specs).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      </div>

      <BoughtTogether main={product} others={data.related} />

      <ProductReviews productId={product.id} />

      {data.related.length ? (
        <section className="mt-14">
          <h2 className="font-display text-xl font-bold">You may also like</h2>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
            {data.related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      <RecentlyViewed excludeId={product.id} />
    </div>
  );
}
