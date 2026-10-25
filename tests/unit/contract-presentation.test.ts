import { describe, expect, it } from "vitest";
import { renderContract, type ContractTemplate } from "@/domain/templates";
import { restoreContractPresentation } from "@/domain/contract-presentation";

const template: ContractTemplate = {
  type: "investment",
  name: "lease",
  preamble:
    "عقد إيجار\nالطرف الأول: {{owner_name}}، المالك\nويحمل بطاقة مدنية رقم: {{owner_civil_id}}\nالمستأجر: {{tenant_name}}",
  clauses: [
    {
      key: "rent",
      position: 1,
      body: "الإيجار {{rent_amount}} د.ك {{#purpose}}لاستعماله {{purpose}}{{/purpose}}",
    },
  ],
};
const vars = {
  owner_name: "عبدالله",
  owner_civil_id: "245010700022",
  tenant_name: "شركة",
  rent_amount: "625.000",
  purpose: "محل",
};

describe("contract print presentation", () => {
  it("marks only actual substitutions, including nested conditional fields", () => {
    const result = renderContract(template, vars);
    expect(result.preambleParts?.[1]).toEqual([
      { text: "الطرف الأول: " },
      { text: "عبدالله", variable: "owner_name" },
      { text: "، المالك" },
    ]);
    expect(result.clauses[0]?.parts?.map((p) => p.text).join("")).toBe(result.clauses[0]?.text);
    expect(result.clauses[0]?.parts?.filter((p) => p.variable).map((p) => p.variable)).toEqual([
      "rent_amount",
      "purpose",
    ]);
  });
  it("repairs missing owner details in a legacy snapshot without changing saved rent", () => {
    const saved = renderContract(template, {
      ...vars,
      owner_name: "",
      owner_civil_id: "",
      rent_amount: "550.000",
    });
    delete saved.preambleParts;
    for (const clause of saved.clauses) delete clause.parts;
    const result = restoreContractPresentation(saved, renderContract(template, vars));
    expect(result.preamble[1]).toBe("الطرف الأول: عبدالله، المالك");
    expect(result.preamble[2]).toContain("245010700022");
    expect(result.clauses[0]?.text).toContain("550.000");
    expect(result.clauses[0]?.parts?.find((p) => p.variable === "rent_amount")?.text).toBe(
      "550.000",
    );
    expect(saved.preamble[1]).toBe("الطرف الأول: ، المالك");
  });
  it("repairs blank owner fields in structured snapshots as well", () => {
    const saved = renderContract(template, { ...vars, owner_name: "", owner_civil_id: "" });
    const result = restoreContractPresentation(saved, renderContract(template, vars));
    expect(result.preamble[1]).toContain("عبدالله");
    expect(result.preamble[2]).toContain("245010700022");
  });
  it("preserves a previously saved owner and custom legal text", () => {
    const saved = renderContract(template, { ...vars, owner_name: "المالك الأصلي" });
    saved.clauses[0]!.text = "شروط خاصة محفوظة";
    delete saved.clauses[0]!.parts;
    const result = restoreContractPresentation(saved, renderContract(template, vars));
    expect(result.preamble[1]).toContain("المالك الأصلي");
    expect(result.clauses[0]?.text).toBe("شروط خاصة محفوظة");
    expect(result.clauses[0]?.parts).toBeUndefined();
  });
  it("treats user-provided markup as text", () => {
    const result = renderContract(template, { ...vars, owner_name: "<script>alert(1)</script>" });
    expect(result.preambleParts?.[1]?.[1]?.text).toBe("<script>alert(1)</script>");
  });
});
