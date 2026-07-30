import logoAsset from "@/assets/pameluxury-logo.png.asset.json";

export const LOGO_URL = logoAsset.url;

/** The PameLuxury mark. Used in nav, auth pages, admin and the splash screen. */
export function BrandLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src={LOGO_URL}
      alt="PameLuxury logo"
      width={64}
      height={64}
      className={`${className} object-contain rounded-md`}
    />
  );
}

export function BrandLockup({
  logoClassName = "h-8 w-8",
  textClassName = "",
}: {
  logoClassName?: string;
  textClassName?: string;
}) {
  return (
    <>
      <BrandLogo className={logoClassName} />
      <span className={textClassName}>
        Pame<span className="text-foreground">Luxury</span>
      </span>
    </>
  );
}
