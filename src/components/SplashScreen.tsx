import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/Brand";

const SEEN_KEY = "pameluxury-splash-seen";

/**
 * Luxury intro shown once per browser session before the app appears.
 * Fades itself out after ~2.4s and then unmounts.
 */
export function SplashScreen() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SEEN_KEY)) return;
    sessionStorage.setItem(SEEN_KEY, "1");
    setShow(true);
    const t1 = setTimeout(() => setLeaving(true), 2000);
    const t2 = setTimeout(() => setShow(false), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-500"
      style={{ opacity: leaving ? 0 : 1 }}
    >
      <div className="splash-glow flex flex-col items-center">
        <BrandLogo className="h-24 w-24 sm:h-28 sm:w-28" />
        <p className="mt-5 font-display font-extrabold tracking-[0.18em] text-2xl sm:text-3xl text-primary">
          PameLuxury
        </p>
        <p className="mt-2 text-xs sm:text-sm tracking-[0.3em] uppercase text-muted-foreground">
          Luxury, curated for you
        </p>
      </div>
    </div>
  );
}
