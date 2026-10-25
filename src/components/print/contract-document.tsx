import type { ContractTextPart, RenderedContract } from "@/domain/templates";
import { cn } from "@/lib/utils";

/** Contract documents are Arabic legal text; their fixed labels belong to the document, not the UI locale. */
export const DOC_LABELS_AR = {
  party1: "الطرف الأول",
  party2: "الطرف الثاني",
  name: "الاسم",
  signature: "التوقيع",
  contractNo: "رقم العقد",
};

/**
 * A4 contract layout (§8.3): centered 26pt title, preamble, numbered clauses
 * with hanging indent, signature block kept with the last clause.
 * Used by the print route and the wizard's scaled preview.
 */
export function ContractDocument({
  rendered,
  ownerName,
  tenantName,
  className,
  labels,
}: {
  rendered: RenderedContract;
  ownerName: string;
  tenantName: string;
  className?: string;
  labels?: { party1: string; party2: string; name: string; signature: string; contractNo: string };
}) {
  const l = labels ?? DOC_LABELS_AR;
  const [title, ...preamble] = rendered.preamble;
  const clauses = rendered.clauses;
  const last = clauses.at(-1);
  return (
    <article
      dir="rtl"
      lang="ar"
      className={cn("contract-doc text-[12.5pt] leading-[1.9] text-black", className)}
    >
      <header className="mb-4">
        <h1 className="text-center text-[26pt] leading-tight font-bold">{title}</h1>
      </header>
      <div className="space-y-0.5">
        {preamble.map((l, i) => (
          <p key={i}>
            <ContractText text={l} parts={rendered.preambleParts?.[i + 1]} />
          </p>
        ))}
      </div>
      <ol className="mt-3 space-y-1.5">
        {clauses.map((c) => (
          <li
            key={c.key}
            className={cn(
              "grid break-inside-avoid grid-cols-[2.2em_1fr]",
              c === last && "break-after-avoid",
            )}
          >
            <span className="num font-semibold">{c.number}-</span>
            <span>
              <ContractText text={c.text} parts={c.parts} />
            </span>
          </li>
        ))}
      </ol>
      {rendered.closing.map((l, i) => (
        <p key={i} className="mt-2">
          <ContractText text={l} parts={rendered.closingParts?.[i]} />
        </p>
      ))}
      <section className="signature mt-10 grid break-inside-avoid grid-cols-2 gap-10">
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
              {l.signature}:{" "}
              <span className="inline-block w-40 border-b border-dotted border-black align-bottom" />
            </div>
          </div>
        ))}
      </section>
    </article>
  );
}

/** Black boilerplate with red contract-specific fields, matching the client's paper lease. */
function ContractText({ text, parts }: { text: string; parts?: ContractTextPart[] }) {
  if (
    !parts ||
    parts
      .map((p) => p.text)
      .join("")
      .trim() !== text
  )
    return <>{text}</>;
  return (
    <>
      {parts.map((part, index) => (
        <span key={index} className={part.variable ? "contract-field text-[#c62828]" : undefined}>
          {part.text}
        </span>
      ))}
    </>
  );
}
