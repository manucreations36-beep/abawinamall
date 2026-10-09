import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/warranty")({
  head: () => ({
    meta: [
      { title: "Warranty & Returns | ABAWINA MALL" },
      { name: "description", content: "How warranty claims, returns and exchanges work at ABAWINA MALL, Mombasa." },
      { property: "og:title", content: "Warranty & Returns — ABAWINA MALL" },
      { property: "og:description", content: "Manufacturer warranty, 7-day returns on faulty items and easy claims." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WarrantyPage,
});

const SECTIONS = [
  { h: "Manufacturer warranty", p: "Most electronics and appliances come with the manufacturer's warranty. The length is shown on each product page. Keep your receipt or order number." },
  { h: "Faulty on arrival", p: "If an item arrives damaged or not working, tell us within 7 days and we will repair, exchange or refund it." },
  { h: "Change of mind", p: "Unused items in their original sealed packaging can be exchanged within 7 days. Delivery costs are not refunded." },
  { h: "Not covered", p: "Physical damage, water damage, power surges, misuse, or repairs done by someone else." },
  { h: "How to make a claim", p: "Contact us with your order number, a photo or video of the problem, and your phone number. We will tell you where to bring the item or arrange pickup." },
];

function WarrantyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Warranty &amp; returns</h1>
      <div className="mt-6 space-y-4">
        {SECTIONS.map((s) => (
          <section key={s.h} className="surface-panel p-5">
            <h2 className="font-semibold">{s.h}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{s.p}</p>
          </section>
        ))}
      </div>
      <p className="mt-6 text-sm">Ready to claim? <Link to="/contact" className="text-primary underline">Contact us</Link>.</p>
    </div>
  );
}
