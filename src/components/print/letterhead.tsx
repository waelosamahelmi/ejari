import Image from "next/image";

/** Bilingual letterhead: brand mark (or org logo) + org name (AR/EN) + thin ink rule; org logo may sit beside the mark. */
export function Letterhead({
  orgName,
  orgNameEn,
  logoUrl,
  show,
}: {
  orgName: string;
  orgNameEn: string | null;
  logoUrl?: string | null;
  show: boolean;
}) {
  if (!show) return null;
  return (
    <div
      className="mb-5 flex items-center justify-between gap-4 border-b-[1.2pt] border-black pb-3"
      dir="rtl"
    >
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={48}
            height={48}
            unoptimized
            className="size-12 object-contain"
          />
        ) : (
          <Image src="/brand/mark.svg" alt="" width={40} height={40} className="size-10" />
        )}
        <div className="leading-tight">
          <div className="text-[14pt] font-bold">{orgName}</div>
          {orgNameEn && (
            <div className="text-[9pt] text-neutral-600" dir="ltr">
              {orgNameEn}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PoweredBy({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="mt-8 text-center text-[8pt] text-neutral-500">
      بواسطة إيجاري · Powered by Ejari — ejarikw.com
    </div>
  );
}
