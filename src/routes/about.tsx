import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Truck, ShieldCheck, Smartphone } from "lucide-react";
import { Testimonials } from "@/components/site/Testimonials";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About ABAWINA MALL | Nyali, Mombasa" },
      { name: "description", content: "Who we are: genuine electronics, appliances and home goods with fast Mombasa delivery and M-Pesa payment." },
      { property: "og:title", content: "About ABAWINA MALL" },
      { property: "og:description", content: "Genuine products, fair prices and fast delivery across Mombasa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

const VALUES = [
  { icon: BadgeCheck, title: "Genuine products", text: "We stock original brands with proper receipts." },
  { icon: ShieldCheck, title: "Warranty you can use", text: "Manufacturer warranty honoured right here in Mombasa." },
  { icon: Truck, title: "Fast delivery", text: "Same-day delivery in most of Mombasa." },
  { icon: Smartphone, title: "Easy payment", text: "Pay with M-Pesa or cash on delivery." },
];

function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">About ABAWINA MALL</h1>
      <p className="mt-4 max-w-3xl text-muted-foreground">
        ABAWINA MALL is a Mombasa shop for electronics, home appliances, kitchenware and beauty products.
        We help families and businesses buy genuine goods at fair prices, with friendly advice and quick delivery.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {VALUES.map((v) => (
          <div key={v.title} className="surface-panel flex gap-3 p-5">
            <v.icon className="size-6 shrink-0 text-primary" />
            <div><h2 className="font-semibold">{v.title}</h2><p className="text-sm text-muted-foreground">{v.text}</p></div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm">
        Questions? <Link to="/contact" className="text-primary underline">Contact us</Link> or read our <Link to="/warranty" className="text-primary underline">warranty &amp; returns</Link> policy.
      </p>
      <Testimonials showForm />
    </div>
  );
}
