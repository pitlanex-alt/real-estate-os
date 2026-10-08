import Image from "next/image";

export function KelvoLogo({ className = "w-[112px]", priority = false }: { className?: string; priority?: boolean }) {
  return <Image src="/brand/kelvo-logo.svg" width={142} height={57} alt="Kelvo" priority={priority} className={`h-auto ${className}`} />;
}

export function KelvoMark({ className = "h-9", black = false, priority = false }: { className?: string; black?: boolean; priority?: boolean }) {
  return <Image src={black ? "/brand/kelvo-mark-black.svg" : "/brand/kelvo-mark.svg"} width={85} height={100} alt="Kelvo" priority={priority} className={`w-auto ${className}`} />;
}
