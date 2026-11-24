import { describe, expect, it } from "vitest";
import {
  clausesReferencing,
  includedClauses,
  renderContract,
  renderContractChecked,
  type ContractTemplate,
} from "@/domain/templates";
import { contractFileName } from "@/domain/contract-file-name";

const tpl: ContractTemplate = {
  type: "investment",
  name: "t",
  preamble: "عقد\nمقدمة",
  clauses: [
    { key: "term", position: 1, body: "مدة العقد سنة." },
    { key: "water", position: 2, body: "الماء العذب.", optional: false },
    { key: "end", position: 3, body: "ينتهي حسب البند ({{clause_ref:term}})." },
    { key: "opt", position: 4, body: "اختياري.", optional: true, defaultEnabled: false },
  ],
};

describe("per-contract clause omission", () => {
  it("omits a non-optional clause only when the contract says so", () => {
    expect(includedClauses(tpl, {}).map((c) => c.key)).toEqual(["term", "water", "end"]);
    expect(includedClauses(tpl, {}, { enabled: { water: false } }).map((c) => c.key)).toEqual([
      "term",
      "end",
    ]);
  });
  it("renumbers the remaining clauses and keeps their wording", () => {
    const r = renderContract(tpl, {}, { enabled: { water: false } });
    expect(r.clauses.map((c) => [c.number, c.key])).toEqual([
      [1, "term"],
      [2, "end"],
    ]);
    expect(r.clauses[1]!.text).toBe("ينتهي حسب البند (1).");
  });
  it("still lets optional clauses be switched on", () => {
    expect(includedClauses(tpl, {}, { enabled: { opt: true } }).map((c) => c.key)).toContain("opt");
  });
  it("reports clauses that point at a clause being omitted", () => {
    expect(clausesReferencing(tpl, "term", {})).toEqual(["end"]);
    expect(clausesReferencing(tpl, "water", {})).toEqual([]);
  });
});

describe("clause references to omitted clauses", () => {
  it("finds no unresolved reference when every referenced clause is kept", () => {
    expect(renderContractChecked(tpl, {}).unresolvedRefs).toEqual([]);
    expect(renderContractChecked(tpl, {}, { enabled: { water: false } }).unresolvedRefs).toEqual(
      [],
    );
  });
  it("reports the clause that points at an omitted clause, without rewording it", () => {
    const { rendered, unresolvedRefs } = renderContractChecked(
      tpl,
      {},
      { enabled: { term: false } },
    );
    expect(unresolvedRefs).toEqual([{ number: 2, key: "term" }]);
    // The clause text is not rewritten here; activation is blocked instead.
    expect(rendered.clauses[1]!.text).toBe("ينتهي حسب البند (—).");
  });
  it("reports a reference inside an edited or special clause, and one inside the closing", () => {
    const withText = renderContractChecked(
      tpl,
      {},
      { enabled: { term: false }, text: { water: "حسب البند {{clause_ref:term}}." } },
    );
    expect(withText.unresolvedRefs.map((u) => u.number).sort()).toEqual([1, 2]);
    const custom = renderContractChecked(
      { ...tpl, closing: "راجع البند {{clause_ref:term}}." },
      {},
      { enabled: { term: false } },
      [{ key: "c1", text: "بند خاص {{clause_ref:term}}." }],
    );
    expect(custom.unresolvedRefs).toEqual(
      expect.arrayContaining([
        { number: 3, key: "term" },
        { number: null, key: "term" },
      ]),
    );
  });
  it("does not report a reference that sits in a section that does not render", () => {
    const t2: ContractTemplate = {
      ...tpl,
      clauses: [
        { key: "term", position: 1, body: "مدة." },
        { key: "end", position: 2, body: "ينتهي {{#show}}حسب البند {{clause_ref:term}}{{/show}}." },
      ],
    };
    expect(
      renderContractChecked(t2, { show: false }, { enabled: { term: false } }).unresolvedRefs,
    ).toEqual([]);
    expect(
      renderContractChecked(t2, { show: true }, { enabled: { term: false } }).unresolvedRefs,
    ).toEqual([{ number: 1, key: "term" }]);
  });
  it("renders the same contract text as before", () => {
    expect(renderContractChecked(tpl, {}).rendered).toEqual(renderContract(tpl, {}));
  });
});

describe("contract file name", () => {
  it("names property and unit with its type", () => {
    expect(
      contractFileName({
        contractNo: "C-2026-00007",
        propertyName: "السالمية 89",
        units: [{ label: "1", type: "shop" }],
      }),
    ).toBe("عقد - السالمية 89 - محل 1 - C-2026-00007");
  });
  it("prefers a custom type label and strips unsafe characters", () => {
    expect(
      contractFileName({
        contractNo: "C/1",
        propertyName: 'برج: "الزهراء"',
        units: [{ label: "5", type: "apartment", typeLabel: "شقة" }],
      }),
    ).toBe("عقد - برج الزهراء - شقة 5 - C 1");
  });
});
