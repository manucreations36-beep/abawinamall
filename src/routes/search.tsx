import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { searchProducts } from "@/lib/catalog.functions";
import { ProductCard } from "@/components/site/ProductCard";

const searchSchema = z.object({ q: z.string().catch("") });

const resultsQuery = (q: string) =>
  queryOptions({
    queryKey: ["search", q],
    queryFn: () => searchProducts({ data: { q } }),
  });

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(resultsQuery(deps.q)),
  head: () => ({
    meta: [
      { title: "Search products | ABAWINA MALL Mombasa" },
      {
        name: "description",
        content: "Search appliances, TVs, phones, computers, fashion and beauty at ABAWINA MALL.",
      },
      { property: "og:title", content: "Search products | ABAWINA MALL" },
      { property: "og:description", content: "Find what you need across the ABAWINA MALL catalogue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold">Search didn't load</h1>
    </div>
  ),
});

function SearchPage() {
  const { q } = Route.useSearch();
  const { data } = useSuspenseQuery(resultsQuery(q));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="font-display text-2xl font-bold">
        {q ? `Results for “${q}”` : "All products"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{data.products.length} products found</p>
      <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
        {data.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
