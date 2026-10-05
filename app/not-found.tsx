import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#111412] px-5 text-[#f3f1ea]">
      <section className="w-full max-w-xl border-y border-white/[0.08] py-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#819181]">
          Fannst ekki
        </p>
        <h1 className="mt-3 text-[27px] font-semibold tracking-[-0.035em]">
          Síðan eða færslan fannst ekki.
        </h1>
        <p className="mt-3 text-[14px] leading-6 text-[#7f8781]">
          Hún kann að hafa verið fjarlægð eða þú hefur ekki aðgang að henni.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-11 items-center rounded-[8px] border border-white/[0.1] px-4 text-[13px] text-[#a9b8a7]"
        >
          Til baka
        </Link>
      </section>
    </main>
  );
}
