import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/Brand";

const SEEN_KEY = "pameluxury-splash-seen";

/**
 * Luxury intro shown once per browser session before the app appears.
 * Runs for ~3s with an animated "PameLuxury..." loading wordmark, then fades out.
 */
export function SplashScreen() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [dots, setDots] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SEEN_KEY)) return;
    sessionStorage.setItem(SEEN_KEY, "1");
    setShow(true);
    const cycle = setInterval(() => setDots((d) => (d + 1) % 4), 400);
    const t1 = setTimeout(() => setLeaving(true), 2600);
    const t2 = setTimeout(() => setShow(false), 3200);
    return () => {
      clearInterval(cycle);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-600"
      style={{ opacity: leaving ? 0 : 1 }}
    >
      <div className="splash-glow flex flex-col items-center px-6 text-center">
        <BrandLogo className="h-20 w-20 sm:h-28 sm:w-28" />
        <p className="mt-5 font-display font-extrabold tracking-[0.18em] text-xl sm:text-3xl text-primary">
          PameLuxury
          <span className="inline-block w-[1.6em] text-left">{".".repeat(dots)}</span>
        </p>
        <p className="mt-2 text-[10px] sm:text-sm tracking-[0.3em] uppercase text-muted-foreground">
          Luxury, curated for you
        </p>
        <div className="mt-7 h-0.5 w-40 sm:w-56 overflow-hidden rounded-full bg-border">
          <div className="splash-bar h-full w-1/3 rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
