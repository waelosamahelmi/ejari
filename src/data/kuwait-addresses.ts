/**
 * Kuwait governorates and areas.
 * Source: PACI Statistical Reports / "Areas of Kuwait" (en.wikipedia.org/wiki/Areas_of_Kuwait,
 * revision 2026-09-27), which cites the Central Statistical Bureau Geoportal (gis.csb.gov.kw).
 * Values are canonical Arabic names stored in the database and printed in Arabic documents.
 * Reviewed 2026-10-03. Update this file when PACI publishes new areas.
 */
export type AddressLocale = "ar" | "en";

export interface KuwaitArea {
  value: string;
  ar: string;
  en: string;
}

export interface KuwaitGovernorate {
  value: string;
  ar: string;
  en: string;
  areas: KuwaitArea[];
}

const a = (value: string, en: string): KuwaitArea => ({ value, ar: value, en });

export const OTHER_AREA: KuwaitArea = a("أخرى", "Other");

export const KUWAIT_GOVERNORATES: KuwaitGovernorate[] = [
  {
    value: "العاصمة",
    ar: "العاصمة",
    en: "Capital",
    areas: [
      a("ضاحية عبدالله السالم", "Abdullah Al-Salem"),
      a("العديلية", "Adailiya"),
      a("حدائق السور", "Al-Sour Gardens"),
      a("بنيد القار", "Bneid Al-Gar"),
      a("الدعية", "Daiya"),
      a("الدسمة", "Dasma"),
      a("الدوحة", "Doha"),
      a("ميناء الدوحة", "Doha Port"),
      a("الفيحاء", "Faiha"),
      a("فيلكا", "Failaka Island"),
      a("غرناطة", "Granada"),
      a("جبلة", "Jibla"),
      a("كيفان", "Kaifan"),
      a("الخالدية", "Khaldiya"),
      a("المنصورية", "Mansouriya"),
      a("المرقاب", "Mirqab"),
      a("النهضة", "Nahdha"),
      a("شمال غرب الصليبيخات", "North West Sulaibikhat"),
      a("النزهة", "Nuzha"),
      a("القادسية", "Qadsiya"),
      a("قرطبة", "Qortuba"),
      a("الروضة", "Rawda"),
      a("الشامية", "Shamiya"),
      a("شرق", "Sharq"),
      a("الشويخ", "Shuwaikh"),
      a("الشويخ الصناعية", "Shuwaikh Industrial Area"),
      a("ميناء الشويخ", "Shuwaikh Port"),
      a("الصليبخات", "Sulaibikhat"),
      a("القيروان", "Qairawan"),
      a("السرة", "Surra"),
      a("جزيرة عوهة", "Ouha Island"),
      a("جزيرة مسكان", "Miskan Island"),
      a("جزيرة أم النمل", "Umm an Namil Island"),
      a("اليرموك", "Yarmouk"),
    ],
  },
  {
    value: "حولي",
    ar: "حولي",
    en: "Hawalli",
    areas: [
      a("بيان", "Bayan"),
      a("الجابرية", "Jabriya"),
      a("الرميثية", "Rumaithiya"),
      a("سلام", "Salam"),
      a("سلوى", "Salwa"),
      a("البدع", "Al-Bida'a"),
      a("أنجفة", "Anjafa"),
      a("حولي", "Hawally"),
      a("حطين", "Hitteen"),
      a("مشرف", "Mishrif"),
      a("مبارك العبدالله", "Mubarak Al-Abdullah"),
      a("السالمية", "Salmiya"),
      a("الشعب", "Shaab"),
      a("الشهداء", "Shuhada"),
      a("الصديق", "Al-Siddiq"),
      a("منطقة الوزارات", "Ministries Area"),
      a("الزهراء", "Zahra"),
    ],
  },
  {
    value: "الفروانية",
    ar: "الفروانية",
    en: "Farwaniya",
    areas: [
      a("عبدالله المبارك", "Abdullah Al-Mubarak"),
      a("منطقة المطار", "Airport District"),
      a("الأندلس", "Andalus"),
      a("العارضية", "Ardiya"),
      a("العارضية حرفية", "Ardiya Herafiya"),
      a("اشبيلية", "Ishbiliya"),
      a("الضجيج", "Al-Dajeej"),
      a("الفروانية", "Farwaniya"),
      a("الفردوس", "Ferdous"),
      a("جليب الشيوخ", "Jleeb Al-Shuyoukh"),
      a("خيطان", "Khaitan"),
      a("العمرية", "Omariya"),
      a("الرابية", "Rabiya"),
      a("الري", "Al-Rai"),
      a("الرقعي", "Al-Riggai"),
      a("الرحاب", "Rehab"),
      a("صباح الناصر", "Sabah Al-Nasser"),
      a("جامعة صباح السالم", "Sabah Al-Salem University"),
      a("غرب عبدالله المبارك", "West Abdullah Al-Mubarak"),
      a("جنوب عبدالله المبارك", "South Abdullah Al-Mubarak"),
      a("الصليبية الصناعية", "Sulaibiya Industrial"),
    ],
  },
  {
    value: "الأحمدي",
    ar: "الأحمدي",
    en: "Ahmadi",
    areas: [
      a("أبو حليفة", "Abu Halifa"),
      a("ميناء عبدالله", "Mina Abdulla"),
      a("الأحمدي", "Ahmadi"),
      a("علي صباح السالم", "Ali Sabah Al-Salem"),
      a("العقيلة", "Egaila"),
      a("بر الأحمدي", "Bar Al-Ahmadi"),
      a("بنيدر", "Bnaider"),
      a("الظهر", "Dhaher"),
      a("الفحيحيل", "Fahaheel"),
      a("فهد الأحمد", "Fahad Al-Ahmad"),
      a("هدية", "Hadiya"),
      a("جابر العلي", "Jaber Al-Ali"),
      a("الجليعة", "Al-Julaia'a"),
      a("الخيران", "Khairan"),
      a("المهبولة", "Mahboula"),
      a("المنقف", "Mangaf"),
      a("المقوع", "Magwa"),
      a("وفرة السكنية", "Wafra Residential"),
      a("النويصيب", "Al-Nuwaiseeb"),
      a("الرقة", "Riqqa"),
      a("صباح الأحمد", "Sabah Al Ahmad"),
      a("مدينة صباح الأحمد البحرية", "Sabah Al Ahmad Sea City"),
      a("الصباحية", "Sabahiya"),
      a("الشعيبة", "Shuaiba Industrial"),
      a("جنوب الصباحية", "South Sabahiya"),
      a("الوفرة", "Wafra"),
      a("الزور", "Zoor"),
      a("الفنطاس", "Fintas"),
      a("الشدادية الصناعية", "Al Shadadiya Industrial"),
    ],
  },
  {
    value: "الجهراء",
    ar: "الجهراء",
    en: "Jahra",
    areas: [
      a("العبدلي", "Abdali"),
      a("المطلاع", "Al-Mutlaa"),
      a("كاظمة", "Kazma"),
      a("بحرة", "Bahra"),
      a("كبد", "Kabd"),
      a("الشقايه", "Al-Sheqaya"),
      a("النهضة", "Al-Nahda"),
      a("أمغرة", "Amghara Industrial"),
      a("بر الجهراء", "Bar Al-Jahra"),
      a("الجهراء", "Jahra"),
      a("الجهراء الصناعية الحرفية", "Jahra Industrial Herafiya"),
      a("النعيم", "Naeem"),
      a("النسيم", "Nasseem"),
      a("العيون", "Oyoun"),
      a("القصر", "Qasr"),
      a("جابر الأحمد", "Jaber Al-Ahmad"),
      a("سعد العبدالله", "Saad Al Abdullah"),
      a("السالمي", "Salmi"),
      a("الصبية", "Subiya"),
      a("الصليبية", "Sulaibiya"),
      a("الصليبية الزراعية", "Sulaibiya Agricultural Area"),
      a("الصليبية السكنية", "Sulaibiya Residential"),
      a("تيماء", "Taima"),
      a("الواحة", "Waha"),
      a("جزيرة بوبيان", "Bubiyan Island"),
      a("جزيرة وربة", "Warbah Island"),
    ],
  },
  {
    value: "مبارك الكبير",
    ar: "مبارك الكبير",
    en: "Mubarak Al-Kabeer",
    areas: [
      a("أبو الحصانية", "Abu Al Hasaniya"),
      a("أبو فطيرة", "Abu Ftaira"),
      a("العدان", "Al-Adan"),
      a("القرين", "Al Qurain"),
      a("القصور", "Al-Qusour"),
      a("الفنيطيس", "Al-Fnaitees"),
      a("المسيلة", "Messila"),
      a("المسايل", "Al-Masayel"),
      a("مبارك الكبير", "Mubarak Al-Kabeer"),
      a("صباح السالم", "Sabah Al-Salem"),
      a("صبحان", "Subhan Industrial"),
      a("الوسطى", "Wista"),
      a("غرب أبو فطيرة حرفية", "West Abu Ftaira Herafiya"),
    ],
  },
];

export function findGovernorate(value: string | null | undefined): KuwaitGovernorate | undefined {
  if (!value) return undefined;
  return KUWAIT_GOVERNORATES.find((g) => g.value === value);
}

export function findArea(
  value: string | null | undefined,
  governorate?: string | null,
): KuwaitArea | undefined {
  if (!value) return undefined;
  const inGov = findGovernorate(governorate)?.areas.find((area) => area.value === value);
  if (inGov) return inGov;
  for (const g of KUWAIT_GOVERNORATES) {
    const area = g.areas.find((x) => x.value === value);
    if (area) return area;
  }
  return value === OTHER_AREA.value ? OTHER_AREA : undefined;
}

export function areaBelongsTo(
  areaValue: string | null | undefined,
  governorateValue: string | null | undefined,
): boolean {
  if (!areaValue || !governorateValue) return false;
  if (areaValue === OTHER_AREA.value) return true;
  return !!findGovernorate(governorateValue)?.areas.some((area) => area.value === areaValue);
}

/** "" only when the area is a known area that does not belong to the new governorate. */
export function areaAfterGovernorateChange(
  area: string | null | undefined,
  governorate: string | null | undefined,
): string {
  if (!area) return "";
  if (!findArea(area)) return area;
  return areaBelongsTo(area, governorate) ? area : "";
}

export function governorateLabel(
  value: string | null | undefined,
  locale: AddressLocale,
): string {
  if (!value) return "";
  const g = findGovernorate(value);
  if (!g) return value;
  return locale === "en" ? g.en : g.ar;
}

export function areaLabel(
  value: string | null | undefined,
  locale: AddressLocale,
  governorate?: string | null,
): string {
  if (!value) return "";
  const area = findArea(value, governorate);
  if (!area) return value;
  return locale === "en" ? area.en : area.ar;
}

export function locationLabel(
  governorate: string | null | undefined,
  area: string | null | undefined,
  locale: AddressLocale,
): string {
  return [governorateLabel(governorate, locale), areaLabel(area, locale, governorate)]
    .filter(Boolean)
    .join(" · ");
}
