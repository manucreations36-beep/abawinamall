import { createFileRoute, Link } from "@tanstack/react-router";
import { DELIVERY_ZONES, formatKsh, MPESA } from "@/lib/store-config";

export const Route = createFileRoute("/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery & Payment | ABAWINA MALL" },
      { name: "description", content: "Delivery zones and fees across Mombasa and Kenya, plus M-Pesa and cash on delivery options." },
      { property: "og:title", content: "Delivery & Payment | ABAWINA MALL" },
      { property: "og:description", content: "Fast Mombasa delivery from KSh 300 and countrywide courier." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeliveryPage,
});

function DeliveryPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-extrabold">Delivery &amp; payment</h1>
      <p className="mt-2 text-muted-foreground">
        Orders in Mombasa's fast-delivery zones usually arrive the same or next day. Countrywide orders go by courier.
      </p>
      <div className="mt-6 overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left">
            <tr><th className="p-3">Zone</th><th className="p-3 text-right">Fee</th></tr>
          </thead>
          <tbody>
            {DELIVERY_ZONES.map((z) => (
              <tr key={z.name} className="border-t border-border">
                <td className="p-3">{z.name}</td>
                <td className="p-3 text-right font-semibold">{formatKsh(z.fee)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-8 font-display text-xl font-bold">How to pay</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>M-Pesa: send to {MPESA.display} ({MPESA.name}) and enter your M-Pesa code at checkout.</li>
        <li>Cash or card on delivery.</li>
      </ul>
      <p className="mt-6 text-sm">
        Already ordered? <Link to="/track" search={{} as never} className="font-semibold text-primary hover:underline">Track your order</Link>
      </p>
    </div>
  );
}
