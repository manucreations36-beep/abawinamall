import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/store-config";

export function WhatsAppFab() {
  return (
    <a
      href={whatsappLink("Hi ABAWINA MALL, I need help with a product.")}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-20 right-4 md:bottom-5 md:right-5 z-50 inline-flex size-14 items-center justify-center rounded-full bg-success text-success-foreground shadow-glow transition-transform hover:scale-105"
    >
      <MessageCircle className="size-7" />
    </a>
  );
}
