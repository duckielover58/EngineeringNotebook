import Image from "next/image";

export function EngiLogLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/engilog-logo.png"
      alt=""
      width={size}
      height={size}
      className={className ?? "shrink-0 rounded-md"}
      priority
      aria-hidden
    />
  );
}
