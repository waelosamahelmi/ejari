import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { loadPrintableContract } from "@/server/queries/contracts";
import { buildContractDocx } from "@/lib/export/contract-docx";

/** Editable Word version of one contract (RLS-scoped, same clauses as the printed document). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const doc = await loadPrintableContract(await supabaseServer(), id);
  if (!doc?.rendered) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const buf = await buildContractDocx({
    rendered: doc.rendered,
    ownerName: doc.parties.owner.name,
    tenantName: doc.parties.tenant.name,
    coTenantNames: doc.parties.coTenants.map((t) => t.name),
  });
  const name = `${doc.fileName}.docx`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="contract.docx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
