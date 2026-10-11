import Image from "next/image";

const sizes = {
  small: { className: "size-9", pixels: "36px", text: "text-[10px]" },
  medium: { className: "size-10", pixels: "40px", text: "text-[11px]" },
  large: { className: "size-20", pixels: "80px", text: "text-[18px]" },
} as const;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("is-IS")).join("");
}

export function Avatar({ name, photoUrl, size = "small", className = "" }: { name: string; photoUrl?: string | null; size?: keyof typeof sizes; className?: string }) {
  const style = sizes[size];
  return (
    <span className={`relative grid shrink-0 overflow-hidden rounded-full bg-[var(--mint)] font-bold tracking-wide text-[#33483d] ring-1 ring-inset ring-black/[0.06] ${style.className} ${style.text} ${className}`}>
      {photoUrl ? <Image unoptimized fill sizes={style.pixels} src={photoUrl} alt={`Prófílmynd ${name}`} className="object-cover" /> : <span className="grid size-full place-items-center">{initials(name)}</span>}
    </span>
  );
}
