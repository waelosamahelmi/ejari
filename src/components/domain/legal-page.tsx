import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

/** Public legal document layout (privacy / terms). */
export function LegalPage({
  back,
  title,
  updated,
  intro,
  sections,
  contactTitle,
  contact,
}: {
  back: string;
  title: string;
  updated: string;
  intro: string;
  sections: { title: string; body: string }[];
  contactTitle: string;
  contact: string;
}) {
  return (
    <main className="bg-bg min-h-dvh">
      <div className="mx-auto w-full max-w-[760px] px-5 py-10 lg:py-16">
        <Link
          href="/welcome"
          className="text-link inline-flex items-center gap-1.5 text-[14px] font-medium"
        >
          <ArrowLeft className="size-4 ltr:rotate-180" />
          {back}
        </Link>
        <div className="mt-8 flex items-center gap-3">
          <Image src="/brand/mark.svg" alt="" width={36} height={36} className="dark:invert" />
          <span className="text-[17px] font-semibold">إيجاري | Ejari</span>
        </div>
        <h1 className="mt-6 text-[32px] leading-tight font-semibold sm:text-[38px]">{title}</h1>
        <p className="text-label-2 mt-2 text-[14px]">{updated}</p>
        <p className="mt-7 text-[16px] leading-8">{intro}</p>
        {sections.map((s) => (
          <section key={s.title} className="mt-8">
            <h2 className="text-[20px] font-semibold">{s.title}</h2>
            <p className="text-label-2 mt-2 text-[16px] leading-8">{s.body}</p>
          </section>
        ))}
        <section className="border-separator mt-10 border-t-[0.5px] pt-6">
          <h2 className="text-[16px] font-semibold">{contactTitle}</h2>
          <p className="text-label-2 mt-1.5 text-[15px]">{contact}</p>
        </section>
      </div>
    </main>
  );
}
