import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Shown on every visit (no remembered dismissal) unless already running as an installed app.
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos);
    const t = setTimeout(() => setShow(true), 1500);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show) return null;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Install ABAWINA MALL app"
      className="animate-fade-in fixed inset-x-3 bottom-20 z-50 mx-auto max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-2xl md:bottom-6 md:right-6 md:left-auto"
    >
      <button
        aria-label="Close"
        onClick={() => setShow(false)}
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3 pr-5">
        <img src="/icon-192.png" alt="" width={48} height={48} className="size-12 rounded-xl" />
        <div>
          <p className="font-display font-bold">Install the ABAWINA MALL app</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {deferred
              ? "Shop faster from your home screen or desktop."
              : ios
                ? "Tap Share, then “Add to Home Screen”."
                : "Open your browser menu and choose “Install app” or “Add to Home screen”."}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {deferred ? (
          <Button size="sm" className="flex-1 gap-1" onClick={install}>
            <Download className="size-4" /> Install app
          </Button>
        ) : null}
        <Button size="sm" variant="outline" className="flex-1" onClick={() => setShow(false)}>
          Not now
        </Button>
      </div>
    </div>
  );
}
