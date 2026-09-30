import "server-only";
import ExcelJS from "exceljs";

export interface SheetColumn {
  header: string;
  key: string;
  width?: number;
  /** "money" (fils → dinars #,##0.000), "date", "int", "pct" or text. */
  type?: "money" | "date" | "int" | "pct" | "text";
}

export interface SheetSpec {
  name: string;
  title?: string;
  subtitle?: string;
  columns: SheetColumn[];
  rows: Record<string, unknown>[];
  totals?: Record<string, unknown>;
  rtl?: boolean;
}

const INK = "FF0E0F12";

/** Excel with RTL sheets, styled header, #,##0.000 money, frozen header and a totals row (§10.11). */
export async function buildWorkbook(sheets: SheetSpec[], meta: { creator: string }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.creator;
  wb.created = new Date();
  const used = new Set<string>();
  for (const s of sheets) {
    let name = s.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || "Sheet";
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${name.slice(0, 25)} (${n})`;
    used.add(name.toLowerCase());
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: s.rtl ?? true, state: "frozen", ySplit: s.title ? 3 : 1 }] });
    let headerRow = 1;
    if (s.title) {
      ws.mergeCells(1, 1, 1, s.columns.length);
      const t = ws.getCell(1, 1);
      t.value = s.title;
      t.font = { bold: true, size: 14 };
      t.alignment = { horizontal: "center" };
      ws.mergeCells(2, 1, 2, s.columns.length);
      const st = ws.getCell(2, 1);
      st.value = s.subtitle ?? "";
      st.font = { size: 10, color: { argb: "FF6B6E76" } };
      st.alignment = { horizontal: "center" };
      headerRow = 3;
    }
    ws.columns = s.columns.map((c) => ({ key: c.key, width: c.width ?? (c.type === "money" ? 16 : c.type === "date" ? 13 : 22) }));
    const hr = ws.getRow(headerRow);
    s.columns.forEach((c, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: "FF8E8E93" } } };
    });
    hr.height = 24;
    const put = (values: Record<string, unknown>, bold = false) => {
      const row = ws.addRow(
        Object.fromEntries(
          s.columns.map((c) => {
            const v = values[c.key];
            if (v === null || v === undefined || v === "") return [c.key, null];
            if (c.type === "money") return [c.key, Number(v) / 1000];
            if (c.type === "date") return [c.key, typeof v === "string" ? new Date(`${v}T00:00:00Z`) : v];
            return [c.key, v];
          }),
        ),
      );
      s.columns.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        if (c.type === "money") cell.numFmt = "#,##0.000";
        if (c.type === "date") cell.numFmt = "dd/mm/yyyy";
        if (c.type === "pct") cell.numFmt = "0.0%";
        if (bold) {
          cell.font = { bold: true };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F1F3" } };
          cell.border = { top: { style: "thin" } };
        }
      });
    };
    for (const r of s.rows) put(r);
    if (s.totals) put(s.totals, true);
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: s.columns.length } };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function xlsxResponse(buf: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "no-store",
    },
  });
}
