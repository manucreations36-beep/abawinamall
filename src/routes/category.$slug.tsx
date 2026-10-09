import { useEffect } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getCategoryPage } from "@/lib/catalog.functions";
import { ProductCard } from "@/components/site/ProductCard";
import { CategoryIcon } from "@/components/site/CategoryIcon";
import { Badge } from "@/components/ui/badge";
import { track } from "@/lib/track";

const categoryQuery = (slug: string) =>
  queryOptions({
    queryKey: ["category", slug],
    queryFn: () => getCategoryPage({ data: { slug } }),
  });

export const Route = createFileRoute("/category/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(categoryQuery(params.slug));
    if (!data.category) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.category?.name ?? "Shop";
    const description =
      loaderData?.category?.description ??
      `Buy ${name} at ABAWINA MALL Mombasa with genuine warranty and fast delivery.`;
    return {
      meta: [
        { title: `${name} in Mombasa | ABAWINA MALL` },
        { name: "description", content: description.slice(0, 158) },
        { property: "og:title", content: `${name} | ABAWINA MALL` },
        { property: "og:description", content: description.slice(0, 158) },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: CategoryPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold">Category not found</h1>
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

function CategoryPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(categoryQuery(slug));
  const category = data.category!;

  useEffect(() => {
    void track({ event_type: "category_view", category_id: category.id });
  }, [category.id]);

  return (
    <div>
      <section className="relative border-b border-border">
        {category.banner_url ? (
          <img loading="lazy" decoding="async"
            src={category.banner_url}
            alt={category.name}
            className="h-52 w-full object-cover opacity-40 sm:h-64"
          />
        ) : (
          <div className="h-40 bg-hero-glow" />
        )}
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-7xl px-4 pb-6">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-background/80 p-2.5 text-primary">
                <CategoryIcon name={category.icon} className="size-6" />
              </span>
              <h1 className="font-display text-3xl font-extrabold">{category.name}</h1>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {category.featured_tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <p className="text-sm text-muted-foreground">{data.products.length} products</p>
        {data.products.length ? (
          <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
            {data.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="mt-8 text-muted-foreground">
            Nothing listed here yet — call us on 0769 705 580 and we'll source it for you.
          </p>
        )}

        <div className="mt-12 flex flex-wrap gap-2">
          {data.categories.map((other) => (
            <Link
              key={other.id}
              to="/category/$slug"
              params={{ slug: other.slug }}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
            >
              {other.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
