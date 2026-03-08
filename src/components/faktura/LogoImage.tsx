"use client";

export function LogoImage({ alt, className }: { alt: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt={alt}
      className={className}
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}
