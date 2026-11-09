/** Full postal identity for ministry-facing receipts and property statements. */
export function fullPropertyAddress(
  p: {
    governorate?: string | null;
    area?: string | null;
    block?: string | null;
    street?: string | null;
    avenue?: string | null;
    house_or_plot?: string | null;
    paci_no?: string | null;
  },
  locale: "ar" | "en" = "ar",
): string {
  const labels =
    locale === "ar"
      ? ["قطعة", "شارع", "جادة", "منزل/قسيمة", "الرقم الآلي"]
      : ["Block", "Street", "Avenue", "House/plot", "PACI"];
  return [
    p.governorate,
    p.area,
    ...[p.block, p.street, p.avenue, p.house_or_plot, p.paci_no].map((value, i) =>
      value ? `${labels[i]} ${value}` : null,
    ),
  ]
    .filter(Boolean)
    .join(" · ");
}
