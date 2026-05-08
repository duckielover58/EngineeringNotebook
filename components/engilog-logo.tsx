import Image from "next/image";

export function EngiLogLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/engilog-logo-transparent.png"
      alt=""
      width={size}
      height={size}
      className={className ?? "shrink-0 object-contain"}
      priority
      aria-hidden
    />
  );
}
