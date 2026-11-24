import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INVESTMENT_TEMPLATE, RESIDENTIAL_TEMPLATE } from "@/domain/template-seeds";
import { buildTemplateVars, renderContract, type TemplateVarsInput } from "@/domain/templates";
import { buildContractDocx } from "@/lib/export/contract-docx";

/** Fully populated synthetic contract (no real client data). */
const input = (type: "investment" | "residential"): TemplateVarsInput => ({
  contractNo: "I-2026-00007",
  type,
  contractDate: "2026-11-24",
  startDate: "2026-12-01",
  firstCollectionDate: "2026-12-01",
  endDate: "2027-11-30",
  termMonths: 12,
  autoRenew: true,
  monthlyRentFils: 625000,
  purpose: type === "investment" ? "محل تجاري" : "سكن عائلي",
  utilitiesParty: "tenant",
  waterParty: "tenant",
  electricityFixedFils: 0,
  freeMonths: 1,
  noticePeriodMonths: 3,
  securityDepositFils: 625000,
  owner: { name: "عبدالله محمد سالم الراشد", civilId: "245010700022", phones: ["99887766"] },
  tenant: {
    name: "شركة المثال التجارية ذ.م.م",
    civilId: "301020300044",
    phones: ["55667788"],
    licenceNo: "123456",
    signatoryName: "فهد جاسم محمد",
    signatoryCivilId: "285030400055",
  },
  coTenants: [],
  property: {
    area: "السالمية",
    block: "10",
    street: "114",
    houseOrPlot: "89",
    paciNo: "93984941",
    propertyType: "building",
  },
  units: [{ label: "1", type: type === "investment" ? "shop" : "apartment", paciNo: "10234567" }],
});
const vars = buildTemplateVars(input("investment"));

describe("editable Word contract", () => {
  it("contains every rendered clause with the same numbering and keeps red fields", async () => {
    const rendered = renderContract(INVESTMENT_TEMPLATE, vars);
    const buf = await buildContractDocx({
      rendered,
      ownerName: "عبدالله محمد سالم الراشد",
      tenantName: "شركة المثال التجارية ذ.م.م",
    });
    if (process.env.DOCX_OUT) writeFileSync(process.env.DOCX_OUT, buf);
    if (process.env.DOCX_OUT) {
      const res = renderContract(RESIDENTIAL_TEMPLATE, buildTemplateVars(input("residential")), {
        enabled: { [RESIDENTIAL_TEMPLATE.clauses[3]!.key]: false },
      });
      writeFileSync(
        process.env.DOCX_OUT.replace(".docx", "-res.docx"),
        await buildContractDocx({
          rendered: res,
          ownerName: "عبدالله محمد سالم الراشد",
          tenantName: "شركة المثال التجارية ذ.م.م",
          coTenantNames: ["مريم أحمد علي"],
        }),
      );
    }
    const file = join(tmpdir(), `contract-${process.pid}.docx`);
    writeFileSync(file, buf);
    const xml = execFileSync("unzip", ["-p", file, "word/document.xml"], { encoding: "utf8" });
    for (const c of rendered.clauses) expect(xml).toContain(`${c.number}-`);
    expect(xml).toContain("C62828");
    expect(xml).toContain("<w:bidi/>");
  });
  it("omits a clause chosen per contract", async () => {
    const first = INVESTMENT_TEMPLATE.clauses[0]!.key;
    const full = renderContract(INVESTMENT_TEMPLATE, vars);
    const cut = renderContract(INVESTMENT_TEMPLATE, vars, { enabled: { [first]: false } });
    expect(cut.clauses.length).toBe(full.clauses.length - 1);
  });
});
