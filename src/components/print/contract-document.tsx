import Image from "next/image";
import type { RenderedContract } from "@/domain/templates";
import { cn } from "@/lib/utils";

/** Contract documents are Arabic legal text; their fixed labels belong to the document, not the UI locale. */
export const DOC_LABELS_AR = { party1: "الطرف الأول", party2: "الطرف الثاني", name: "الاسم", signature: "التوقيع", contractNo: "رقم العقد" };

/**
 * A4 contract layout (§8.3): centered 26pt title, preamble, numbered clauses
 * with hanging indent, signature block kept with the last clause.
 * Used by the print route and the wizard's scaled preview.
 */
export function ContractDocument({
  rendered,
  contractNo,
  ownerName,
  tenantName,
  qr,
  letterhead,
  className,
  labels,
}: {
  rendered: RenderedContract;
  contractNo: string;
  ownerName: string;
  tenantName: string;
  qr?: string | null;
  letterhead?: React.ReactNode;
  className?: string;
  labels?: { party1: string; party2: string; name: string; signature: string; contractNo: string };
}) {
  const l = labels ?? DOC_LABELS_AR;
  const [title, ...preamble] = rendered.preamble;
  const clauses = rendered.clauses;
  const last = clauses.at(-1);
  return (
    <article dir="rtl" lang="ar" className={cn("contract-doc text-[12.5pt] leading-[1.9] text-black", className)}>
      <header className="relative mb-4">
        {letterhead}
        <div className="absolute top-0 end-0 flex items-start gap-2 text-[8.5pt] leading-tight text-neutral-600">
          {qr && <Image src={qr} alt="" width={64} height={64} unoptimized className="size-16" />}
          <div className="num pt-1" dir="ltr">
            {l.contractNo}
            <br />
            <strong className="text-[10pt] text-black">{contractNo}</strong>
          </div>
        </div>
        <h1 className="pt-2 text-center text-[26pt] leading-tight font-bold">{title}</h1>
      </header>
      <div className="space-y-0.5">
        {preamble.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
      <ol className="mt-3 space-y-1.5">
        {clauses.map((c) => (
          <li key={c.key} className={cn("grid grid-cols-[2.2em_1fr] break-inside-avoid", c === last && "break-after-avoid")}>
            <span className="num font-semibold">{c.number}-</span>
            <span>{c.text}</span>
          </li>
        ))}
      </ol>
      {rendered.closing.map((l, i) => (
        <p key={i} className="mt-2">{l}</p>
      ))}
      <section className="signature mt-10 grid grid-cols-2 gap-10 break-inside-avoid">
        {[
          [l.party1, ownerName],
          [l.party2, tenantName],
        ].map(([p, n]) => (
          <div key={p} className="space-y-3">
            <div className="text-[13pt] font-bold">{p}</div>
            <div>
              {l.name}: <span className="font-semibold">{n}</span>
            </div>
            <div>
              {l.signature}: <span className="inline-block w-40 border-b border-dotted border-black align-bottom" />
            </div>
          </div>
        ))}
      </section>
    </article>
  );
}
