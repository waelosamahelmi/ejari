import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ContractTextPart, RenderedContract } from "@/domain/templates";
import { DOC_LABELS_AR } from "@/components/print/contract-labels";

const FONT = "Arial";
const RED = "C62828";
const BODY = 25; // half-points: 12.5pt, same as the printed contract

function runs(
  text: string,
  parts: ContractTextPart[] | undefined,
  extra: { size?: number; bold?: boolean } = {},
) {
  const same =
    parts &&
    parts
      .map((p) => p.text)
      .join("")
      .trim() === text;
  const src: ContractTextPart[] = same ? parts! : [{ text }];
  return src.map(
    (p) =>
      new TextRun({
        text: p.text,
        font: FONT,
        rightToLeft: true,
        size: extra.size ?? BODY,
        bold: extra.bold,
        // Contract-specific fields are red, as on the printed paper lease.
        color: p.variable ? RED : undefined,
      }),
  );
}

const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: none, bottom: none, left: none, right: none };

/**
 * Editable Word (.docx) version of a rendered contract: the same wording and numbering as the
 * printed document, with real paragraphs so the office can adjust spacing and page layout.
 * No page count is forced.
 */
export async function buildContractDocx(input: {
  rendered: RenderedContract;
  ownerName: string;
  tenantName: string;
  coTenantNames?: string[];
}): Promise<Buffer> {
  const { rendered } = input;
  const [title, ...preamble] = rendered.preamble;
  const l = DOC_LABELS_AR;
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: runs(title ?? "", undefined, { size: 52, bold: true }),
    }),
    ...preamble.map(
      (line, i) =>
        new Paragraph({
          bidirectional: true,
          spacing: { after: 30, line: 320 },
          children: runs(line, rendered.preambleParts?.[i + 1]),
        }),
    ),
    ...rendered.clauses.map(
      (c) =>
        new Paragraph({
          bidirectional: true,
          spacing: { before: 60, after: 30, line: 320 },
          // Hanging indent: the number sits in the margin column, the text wraps under itself.
          indent: { start: 440, hanging: 440 },
          keepLines: true,
          children: [
            new TextRun({
              text: `${c.number}-\t`,
              font: FONT,
              rightToLeft: true,
              size: BODY,
              bold: true,
            }),
            ...runs(c.text, c.parts),
          ],
        }),
    ),
    ...rendered.closing.map(
      (line, i) =>
        new Paragraph({
          bidirectional: true,
          spacing: { before: 60, line: 320 },
          children: runs(line, rendered.closingParts?.[i]),
        }),
    ),
  ];
  const signers: [string, string][] = [
    [l.party1, input.ownerName],
    [l.party2, input.tenantName],
    ...(input.coTenantNames ?? []).map((n, i) => [`${l.party2} (${i + 2})`, n] as [string, string]),
  ];
  const cell = ([role, name]: [string, string]) =>
    new TableCell({
      borders: noBorders,
      width: { size: 50, type: WidthType.PERCENTAGE },
      margins: { top: 120, bottom: 120, left: 80, right: 80 },
      children: [
        new Paragraph({
          bidirectional: true,
          children: runs(role, undefined, { size: 26, bold: true }),
        }),
        new Paragraph({
          bidirectional: true,
          spacing: { before: 60 },
          children: runs(`${l.name}: ${name}`, undefined),
        }),
        new Paragraph({
          bidirectional: true,
          spacing: { before: 100 },
          children: runs(`${l.signature}: ..............................`, undefined),
        }),
      ],
    });
  const rows: TableRow[] = [];
  for (let i = 0; i < signers.length; i += 2) {
    const pair = signers.slice(i, i + 2).map(cell);
    if (pair.length === 1)
      pair.push(new TableCell({ borders: noBorders, children: [new Paragraph({})] }));
    rows.push(new TableRow({ cantSplit: true, children: pair }));
  }
  children.push(
    new Paragraph({ spacing: { before: 240 }, children: [] }),
    new Table({
      visuallyRightToLeft: true,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
      rows,
    }),
  );
  const doc = new Document({
    creator: "Ejari",
    title: title ?? "عقد",
    styles: { default: { document: { run: { font: FONT, size: BODY, rightToLeft: true } } } },
    sections: [
      {
        properties: {
          // A4 with modest 15 mm margins so the office can tighten or loosen the layout.
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 850, bottom: 850, left: 850, right: 850 },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
