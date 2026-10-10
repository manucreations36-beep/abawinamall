import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { NewsletterForm } from "./NewsletterForm";

const KEY = "abawina-welcome-seen-v1";
const SESSION_MS = 30 * 60 * 1000; // show again only after 30 min away

export function WelcomePopup() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const seenAt = Number(localStorage.getItem(KEY) ?? 0);
    if (seenAt && Date.now() - seenAt < SESSION_MS) return;
    const t = setTimeout(() => setOpen(true), 8000);
    return () => clearTimeout(t);
  }, []);
  const close = () => {
    localStorage.setItem(KEY, String(Date.now()));
    setOpen(false);
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm" onClick={close}>
      <div
        className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button aria-label="Close" onClick={close} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
          <X className="size-5" />
        </button>
        <p className="font-display text-xl font-extrabold">
          Karibu to <span className="text-gradient-brand">ABAWINA</span> MALL
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Join our list for flash deals, new arrivals and members-only offers in Mombasa.
        </p>
        <div className="mt-4">
          <NewsletterForm source="welcome_popup" onDone={close} />
        </div>
      </div>
    </div>
  );
}
