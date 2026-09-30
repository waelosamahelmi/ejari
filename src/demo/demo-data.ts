/**
 * Deterministic demo data (§15). Fictional names and IDs, but the exact
 * structure and amounts of the client's paper documents so reports can be
 * verified. Used by unit tests (in-memory) and by the DB seeder.
 */
import { allocateFIFO, type OpenCharge } from "@/domain/allocation";
import { contractEndDate, makeDate, periodOf, type ISODate, type Period } from "@/domain/dates";
import { allocateExpenseLine, type AllocationMode } from "@/domain/expenses";
import { toFils, type Fils } from "@/domain/money";
import { generateSchedule } from "@/domain/schedule";
import { completeCivilId } from "@/domain/validation";
import type { Allocation, Charge, ContractStatus, ContractType, LegalStatus, Payment, PaymentMethod, UnitType } from "@/domain/types";
import type { Dataset } from "@/domain/reports";

// ---------------------------------------------------------------- ids

let counters: Record<string, number> = {};
const PREFIX: Record<string, string> = {
  org: "0a",
  user: "0b",
  owner: "0c",
  property: "0d",
  unit: "0e",
  tenant: "0f",
  contract: "1a",
  charge: "1b",
  payment: "1c",
  category: "1d",
  beneficiary: "1e",
  voucher: "1f",
  line: "2a",
  deposit: "2b",
  legal: "2c",
  template: "2d",
  clause: "2e",
  recurring: "2f",
};

/** Deterministic UUIDs like 0d000000-0000-4000-8000-000000000003. */
export function demoId(kind: keyof typeof PREFIX | string, n?: number): string {
  const c = n ?? (counters[kind] = (counters[kind] ?? 0) + 1);
  const p = PREFIX[kind] ?? "ff";
  return `${p}000000-0000-4000-8000-${String(c).padStart(12, "0")}`;
}

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function civilId(seed: number): string {
  // Fictional 1980s birth dates; pick the first combination with a valid checksum.
  for (let k = 0; k < 50; k++) {
    const yy = 70 + ((seed * 7 + k) % 25);
    const mm = 1 + ((seed * 3 + k) % 12);
    const dd = 1 + ((seed * 5 + k) % 28);
    const serial = String((seed * 7919 + k * 31) % 10000).padStart(4, "0");
    const id = completeCivilId(`2${String(yy).padStart(2, "0")}${String(mm).padStart(2, "0")}${String(dd).padStart(2, "0")}${serial}`);
    if (id) return id;
  }
  throw new Error("could not build civil id");
}

function phone(seed: number): string {
  const first = ["5", "6", "9"][seed % 3]!;
  return `${first}${String((seed * 104729 + 1234567) % 10_000_000).padStart(7, "0")}`;
}

// ---------------------------------------------------------------- types

export interface DemoUser {
  id: string;
  email: string;
  role: "admin" | "accountant" | "collector" | "owner";
  displayName: string;
}
export interface DemoOwner {
  id: string;
  fullName: string;
  civilId: string;
  phones: string[];
  email: string | null;
  iban: string | null;
  bankName: string | null;
  portalUserId: string | null;
}
export interface DemoProperty {
  id: string;
  name: string;
  nameEn: string;
  area: string;
  block: string;
  street: string;
  avenue: string | null;
  houseOrPlot: string;
  paciNo: string;
  propertyType: "residential" | "investment" | "mixed" | "industrial";
  floors: number;
  ownerId: string;
  coverImage: string | null;
}
export interface DemoUnit {
  id: string;
  propertyId: string;
  label: string;
  sortOrder: number;
  type: UnitType;
  floor: number | null;
  areaM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  askingRentFils: Fils;
  paciNo: string | null;
}
export interface DemoTenant {
  id: string;
  fullName: string;
  civilId: string;
  nationality: string;
  phones: string[];
}
export interface DemoContract {
  id: string;
  contractNo: string;
  type: ContractType;
  status: ContractStatus;
  tenantId: string;
  propertyId: string;
  unitIds: string[];
  contractDate: ISODate;
  startDate: ISODate;
  firstCollectionDate: ISODate;
  termMonths: number;
  endDate: ISODate;
  autoRenew: boolean;
  monthlyRentFils: Fils;
  purpose: string;
  utilitiesParty: "owner" | "tenant";
  electricityFixedFils: Fils;
  freeMonths: number;
  noticePeriodMonths: number;
  securityDepositFils: Fils;
  clauseOverrides: { enabled?: Record<string, boolean> };
}
export interface DemoPayment extends Payment {
  tenantId: string;
  method: PaymentMethod;
  systemNo: string;
  collectedBy: string;
}
export interface DemoVoucher {
  id: string;
  voucherNo: string;
  date: ISODate;
  paidFrom: "cash_box" | "bank" | "cheque";
  recipientName: string;
  notes: string;
  lines: {
    id: string;
    position: number;
    amountFils: Fils;
    categoryId: string;
    beneficiaryId: string;
    description: string;
    mode: AllocationMode;
    allocations: { propertyId: string; unitId: string | null; amountFils: Fils }[];
  }[];
}
export interface DemoCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  type: "operating" | "capital" | "payroll" | "owner_draw";
}
export interface DemoBeneficiary {
  id: string;
  name: string;
  kind: "staff" | "vendor" | "asset" | "other";
  monthlySalaryFils: Fils | null;
}
export interface DemoDeposit {
  id: string;
  date: ISODate;
  amountFils: Fils;
  destination: "owner_bank" | "office_bank" | "cash_to_owner";
  ownerId: string | null;
  bankName: string;
  reference: string;
  properties: { propertyId: string; amountFils: Fils }[];
}
export interface DemoLegalCase {
  id: string;
  contractId: string;
  tenantId: string;
  caseNo: string;
  court: string;
  type: "eviction" | "rent_claim" | "other";
  status: LegalStatus;
  amountClaimedFils: Fils;
  nextHearingDate: ISODate;
  lawyer: string;
}

export interface DemoData {
  org: { id: string; name: string; nameEn: string };
  users: DemoUser[];
  owners: DemoOwner[];
  properties: DemoProperty[];
  units: DemoUnit[];
  tenants: DemoTenant[];
  contracts: DemoContract[];
  charges: Charge[];
  payments: DemoPayment[];
  allocations: Allocation[];
  categories: DemoCategory[];
  beneficiaries: DemoBeneficiary[];
  vouchers: DemoVoucher[];
  deposits: DemoDeposit[];
  legalCases: DemoLegalCase[];
  /** Charges are materialized through this period. */
  materializedUntil: Period;
  today: ISODate;
}

export const DEMO_PASSWORD = "Demo12345!";
export const DEMO_TODAY: ISODate = "2026-09-30";
const MATERIALIZE_UNTIL: Period = "2026-12";

const JABRIYA_UNITS: { label: string; type: UnitType; rent: number; collected: number | null; floor: number | null }[] = [
  { label: "واحد", type: "apartment", rent: 300, collected: 300, floor: 1 },
  { label: "اثنين", type: "apartment", rent: 300, collected: 300, floor: 1 },
  { label: "ثلاثة", type: "apartment", rent: 450, collected: 450, floor: 1 },
  { label: "أربعة", type: "apartment", rent: 500, collected: 500, floor: 1 },
  { label: "خمسة", type: "apartment", rent: 300, collected: 300, floor: 2 },
  { label: "ستة", type: "apartment", rent: 300, collected: 300, floor: 2 },
  { label: "سبعة", type: "apartment", rent: 300, collected: 300, floor: 2 },
  { label: "ثمانية", type: "apartment", rent: 300, collected: 300, floor: 2 },
  { label: "تسعة", type: "apartment", rent: 320, collected: 300, floor: 3 },
  { label: "عشرة", type: "apartment", rent: 310, collected: 310, floor: 3 },
  { label: "أحد عشر", type: "apartment", rent: 300, collected: 300, floor: 3 },
  { label: "اثنا عشر", type: "apartment", rent: 320, collected: 320, floor: 3 },
  { label: "ثلاثة عشر", type: "apartment", rent: 300, collected: 300, floor: 4 },
  { label: "أربعة عشر", type: "apartment", rent: 320, collected: 320, floor: 4 },
  { label: "خمسة عشر", type: "apartment", rent: 300, collected: 300, floor: 4 },
  { label: "ستة عشر", type: "apartment", rent: 300, collected: 300, floor: 4 },
  { label: "سبعة عشر", type: "apartment", rent: 310, collected: 310, floor: 5 },
  { label: "ثمانية عشر", type: "apartment", rent: 300, collected: 300, floor: 5 },
  { label: "تسعة عشر", type: "apartment", rent: 310, collected: 310, floor: 5 },
  { label: "عشرون", type: "apartment", rent: 300, collected: 250, floor: 5 },
  { label: "واحد وعشرون", type: "apartment", rent: 270, collected: 270, floor: 6 },
  { label: "22", type: "apartment", rent: 0, collected: null, floor: 6 },
  { label: "23", type: "apartment", rent: 0, collected: null, floor: 6 },
  { label: "24", type: "apartment", rent: 0, collected: null, floor: 6 },
  { label: "غرفة", type: "room", rent: 100, collected: 100, floor: 7 },
  { label: "محل", type: "shop", rent: 0, collected: null, floor: 0 },
  { label: "نصف السرداب الأمامي", type: "basement_front_half", rent: 0, collected: null, floor: -1 },
  { label: "نصف السرداب الخلفي", type: "basement_back_half", rent: 0, collected: null, floor: -1 },
  { label: "السطح", type: "roof", rent: 0, collected: null, floor: null },
];

const FIRST_NAMES = [
  "خالد",
  "فهد",
  "سالم",
  "ناصر",
  "بدر",
  "يوسف",
  "عبدالله",
  "مشعل",
  "طلال",
  "حمد",
  "جاسم",
  "راشد",
  "سعود",
  "فيصل",
  "عادل",
  "منصور",
  "وليد",
  "هاني",
  "أحمد",
  "عمر",
  "ماجد",
  "زياد",
  "نواف",
  "سامي",
  "كريم",
  "إبراهيم",
  "مروان",
  "حسين",
  "علي",
  "باسل",
];
const FAMILY_NAMES = [
  "الحربي",
  "المطيري",
  "العنزي",
  "الشمري",
  "الرشيدي",
  "العجمي",
  "الهاجري",
  "الدوسري",
  "الكندري",
  "الفضلي",
  "البلوشي",
  "النجار",
  "حداد",
  "المصري",
  "الأنصاري",
  "القطان",
];
const NATIONALITIES = ["كويتي", "مصري", "هندي", "سوري", "أردني", "لبناني", "باكستاني", "فلبيني"];

/** Builds the full demo dataset. */
export function buildDemoData(): DemoData {
  counters = {};
  const rand = rng(157);
  const usedReceipts = new Set<string>();
  const receiptNo = () => {
    for (;;) {
      const digits = rand() < 0.5 ? 4 : 5;
      const n = Math.floor(rand() * 9 * 10 ** (digits - 1)) + 10 ** (digits - 1);
      const s = String(n);
      if (!usedReceipts.has(s)) {
        usedReceipts.add(s);
        return s;
      }
    }
  };

  const org = { id: demoId("org", 1), name: "مكتب الواحة لإدارة العقارات", nameEn: "Al Waha Property Management" };
  const users: DemoUser[] = [
    { id: demoId("user", 1), email: "admin@demo.test", role: "admin", displayName: "وائل" },
    { id: demoId("user", 2), email: "accountant@demo.test", role: "accountant", displayName: "ريم المحاسبة" },
    { id: demoId("user", 3), email: "collector@demo.test", role: "collector", displayName: "محمد المحصل" },
    { id: demoId("user", 4), email: "owner@demo.test", role: "owner", displayName: "عبدالعزيز الصالح" },
  ];
  const collectorId = users[2]!.id;

  const owners: DemoOwner[] = [
    {
      id: demoId("owner"),
      fullName: "عبدالعزيز محمد الصالح",
      civilId: civilId(1),
      phones: [phone(1)],
      email: "owner@demo.test",
      iban: null,
      bankName: "بنك الكويت الوطني",
      portalUserId: users[3]!.id,
    },
    {
      id: demoId("owner"),
      fullName: "منيرة سعد العتيبي",
      civilId: civilId(2),
      phones: [phone(2)],
      email: null,
      iban: null,
      bankName: "بيت التمويل الكويتي",
      portalUserId: null,
    },
  ];
  const [ownerA, ownerB] = owners as [DemoOwner, DemoOwner];

  const properties: DemoProperty[] = [
    {
      id: demoId("property"),
      name: "الجابرية 157",
      nameEn: "Jabriya 157",
      area: "الجابرية",
      block: "1",
      street: "7",
      avenue: null,
      houseOrPlot: "157",
      paciNo: "12045781",
      propertyType: "mixed",
      floors: 7,
      ownerId: ownerA.id,
      coverImage: "/brand/photos/building-2.jpg",
    },
    {
      id: demoId("property"),
      name: "الري قسيمة 1674",
      nameEn: "Al-Rai Plot 1674",
      area: "الري",
      block: "1",
      street: "22",
      avenue: null,
      houseOrPlot: "1674",
      paciNo: "30498812",
      propertyType: "industrial",
      floors: 2,
      ownerId: ownerA.id,
      coverImage: "/brand/photos/building-4.jpg",
    },
    {
      id: demoId("property"),
      name: "صباح السالم قطعة 12 منزل 43",
      nameEn: "Sabah Al-Salem B12 H43",
      area: "صباح السالم",
      block: "12",
      street: "5",
      avenue: "3",
      houseOrPlot: "43",
      paciNo: "18834506",
      propertyType: "residential",
      floors: 3,
      ownerId: ownerB.id,
      coverImage: "/brand/photos/building-1.jpg",
    },
    {
      id: demoId("property"),
      name: "السالمية 88",
      nameEn: "Salmiya 88",
      area: "السالمية",
      block: "10",
      street: "حمد المبارك",
      avenue: null,
      houseOrPlot: "88",
      paciNo: "15520937",
      propertyType: "residential",
      floors: 5,
      ownerId: ownerA.id,
      coverImage: "/brand/photos/building-3.jpg",
    },
  ];
  const [jabriya, alRai, sabah, salmiya] = properties as [DemoProperty, DemoProperty, DemoProperty, DemoProperty];

  const units: DemoUnit[] = [];
  JABRIYA_UNITS.forEach((u, i) =>
    units.push({
      id: demoId("unit"),
      propertyId: jabriya.id,
      label: u.label,
      sortOrder: i + 1,
      type: u.type,
      floor: u.floor,
      areaM2: u.type === "apartment" ? 110 + (i % 4) * 15 : u.type === "room" ? 25 : 60,
      bedrooms: u.type === "apartment" ? 2 + (i % 2) : null,
      bathrooms: u.type === "apartment" ? 2 : null,
      askingRentFils: toFils(u.rent || (u.type === "shop" ? 450 : u.type === "roof" ? 150 : u.type === "apartment" ? 300 : 200)),
      paciNo: null,
    }),
  );
  const jUnit = (label: string) => units.find((u) => u.propertyId === jabriya.id && u.label === label)!;

  const alRaiShops = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
    const u: DemoUnit = {
      id: demoId("unit"),
      propertyId: alRai.id,
      label: String(n),
      sortOrder: n,
      type: "shop",
      floor: 0,
      areaM2: 80,
      bedrooms: null,
      bathrooms: null,
      askingRentFils: toFils(n === 8 ? 650 : 550),
      paciNo: n === 8 ? "30498840" : null,
    };
    units.push(u);
    return u;
  });

  const sabahUnits = [1, 2, 3].map((n) => {
    const u: DemoUnit = {
      id: demoId("unit"),
      propertyId: sabah.id,
      label: String(n),
      sortOrder: n,
      type: "apartment",
      floor: n - 1,
      areaM2: 180,
      bedrooms: 3,
      bathrooms: 3,
      askingRentFils: toFils(400),
      paciNo: null,
    };
    units.push(u);
    return u;
  });

  const salmiyaRents = [750, 750, 780, 700, 820, 760, 735, 800, 745, 745];
  const salmiyaUnits = salmiyaRents.map((rent, i) => {
    const u: DemoUnit = {
      id: demoId("unit"),
      propertyId: salmiya.id,
      label: String(i + 1),
      sortOrder: i + 1,
      type: "apartment",
      floor: Math.floor(i / 2) + 1,
      areaM2: 150,
      bedrooms: 3,
      bathrooms: 2,
      askingRentFils: toFils(rent),
      paciNo: null,
    };
    units.push(u);
    return u;
  });

  // ------------------------------------------------------------ tenants & contracts
  const tenants: DemoTenant[] = [];
  const newTenant = () => {
    const n = tenants.length;
    const t: DemoTenant = {
      id: demoId("tenant"),
      fullName: `${FIRST_NAMES[n % FIRST_NAMES.length]} ${FIRST_NAMES[(n * 7 + 3) % FIRST_NAMES.length]} ${FAMILY_NAMES[(n * 5) % FAMILY_NAMES.length]}`,
      civilId: civilId(100 + n),
      nationality: NATIONALITIES[n % NATIONALITIES.length]!,
      phones: n % 4 === 0 ? [phone(200 + n), phone(300 + n)] : [phone(200 + n)],
    };
    tenants.push(t);
    return t;
  };

  const contracts: DemoContract[] = [];
  const seq = { residential: 0, investment: 0 } as Record<ContractType, number>;
  const newContract = (c: Omit<DemoContract, "id" | "contractNo" | "endDate" | "clauseOverrides"> & { clauseOverrides?: DemoContract["clauseOverrides"] }) => {
    seq[c.type] += 1;
    const year = Number(c.contractDate.slice(0, 4));
    const contract: DemoContract = {
      ...c,
      id: demoId("contract"),
      contractNo: `${c.type === "residential" ? "R" : "I"}-${year}-${String(seq[c.type]).padStart(4, "0")}`,
      endDate: contractEndDate(c.startDate, c.termMonths),
      clauseOverrides: c.clauseOverrides ?? {},
    };
    contracts.push(contract);
    return contract;
  };
  const residential = (tenantId: string, propertyId: string, unitIds: string[], start: ISODate, rent: number, term = 12) =>
    newContract({
      type: "residential",
      status: "active",
      tenantId,
      propertyId,
      unitIds,
      contractDate: start,
      startDate: start,
      firstCollectionDate: start,
      termMonths: term,
      autoRenew: false,
      monthlyRentFils: toFils(rent),
      purpose: "سكن عائلي",
      utilitiesParty: "owner",
      electricityFixedFils: 0,
      freeMonths: 0,
      noticePeriodMonths: 2,
      securityDepositFils: 0,
    });

  // Jabriya: one contract per occupied unit, plus the multi-unit tenant (21, 22–24, room).
  const jabriyaRows: { contract: DemoContract; augustCollected: number }[] = [];
  const multiTenant = newTenant();
  JABRIYA_UNITS.forEach((u, i) => {
    if (u.collected === null || u.label === "واحد وعشرون" || u.label === "غرفة") return;
    const t = newTenant();
    const startMonth = 1 + (i % 12);
    const start = makeDate(i % 3 === 0 ? 2025 : 2026, i % 3 === 0 ? startMonth : 1 + (i % 6), 1);
    const c = residential(t.id, jabriya.id, [jUnit(u.label).id], start, u.rent, 60);
    jabriyaRows.push({ contract: c, augustCollected: u.collected });
  });
  const cA = residential(multiTenant.id, jabriya.id, [jUnit("واحد وعشرون").id], "2025-06-01", 270, 60);
  const cB = residential(multiTenant.id, jabriya.id, ["22", "23", "24"].map((l) => jUnit(l).id), "2025-06-01", 2150, 60);
  cB.purpose = "سكن موظفين";
  const cC = residential(multiTenant.id, jabriya.id, [jUnit("غرفة").id], "2025-06-01", 100, 60);
  cC.purpose = "سكن عزاب";
  jabriyaRows.push({ contract: cA, augustCollected: 270 }, { contract: cB, augustCollected: 2150 }, { contract: cC, augustCollected: 100 });

  // Sabah Al-Salem: residential contract, apartment 3 (§15).
  const sabahTenant = newTenant();
  const sabahContract = newContract({
    type: "residential",
    status: "active",
    tenantId: sabahTenant.id,
    propertyId: sabah.id,
    unitIds: [sabahUnits[2]!.id],
    contractDate: "2026-02-01",
    startDate: "2026-02-01",
    firstCollectionDate: "2026-02-01",
    termMonths: 60,
    autoRenew: false,
    monthlyRentFils: toFils(400),
    purpose: "سكن عائلي",
    utilitiesParty: "owner",
    electricityFixedFils: 0,
    freeMonths: 0,
    noticePeriodMonths: 2,
    securityDepositFils: 0,
  });

  // Al-Rai: shop 5 paying, shop 3 in a legal case with 3 months of arrears, shop 8 investment contract (§15).
  const shop5Tenant = newTenant();
  const shop5 = newContract({
    type: "investment",
    status: "active",
    tenantId: shop5Tenant.id,
    propertyId: alRai.id,
    unitIds: [alRaiShops[4]!.id],
    contractDate: "2025-03-01",
    startDate: "2025-03-01",
    firstCollectionDate: "2025-03-01",
    termMonths: 60,
    autoRenew: true,
    monthlyRentFils: toFils(600),
    purpose: "ورشة",
    utilitiesParty: "tenant",
    electricityFixedFils: 0,
    freeMonths: 0,
    noticePeriodMonths: 1,
    securityDepositFils: toFils(600),
    clauseOverrides: { enabled: { industry_authority: true } },
  });
  const shop3Tenant = newTenant();
  const shop3 = newContract({
    type: "investment",
    status: "active",
    tenantId: shop3Tenant.id,
    propertyId: alRai.id,
    unitIds: [alRaiShops[2]!.id],
    contractDate: "2025-09-01",
    startDate: "2025-09-01",
    firstCollectionDate: "2025-09-01",
    termMonths: 60,
    autoRenew: true,
    monthlyRentFils: toFils(450),
    purpose: "مخزن",
    utilitiesParty: "tenant",
    electricityFixedFils: 0,
    freeMonths: 0,
    noticePeriodMonths: 1,
    securityDepositFils: 0,
    clauseOverrides: { enabled: { industry_authority: true } },
  });
  const investTenant = newTenant();
  newContract({
    type: "investment",
    status: "active",
    tenantId: investTenant.id,
    propertyId: alRai.id,
    unitIds: [alRaiShops[7]!.id],
    contractDate: "2026-10-01",
    startDate: "2026-10-01",
    firstCollectionDate: "2026-12-01",
    termMonths: 60,
    autoRenew: true,
    monthlyRentFils: toFils(650),
    purpose: "مكتب عقاري",
    utilitiesParty: "owner",
    electricityFixedFils: toFils(3.75),
    freeMonths: 2,
    noticePeriodMonths: 1,
    securityDepositFils: 0,
    clauseOverrides: { enabled: { industry_authority: true } },
  });

  // Salmiya: 10 apartments; unit 4's contract expires in 45 days.
  const salmiyaContracts = salmiyaUnits.map((u, i) => {
    const t = newTenant();
    const start = i === 3 ? "2025-11-15" : makeDate(2025, 1 + i, 1);
    return residential(t.id, salmiya.id, [u.id], start, salmiyaRents[i]!, i === 3 ? 12 : 36);
  });

  // ------------------------------------------------------------ charges
  const charges: Charge[] = [];
  for (const c of contracts) {
    for (const s of generateSchedule(
      {
        startDate: c.startDate,
        endDate: c.endDate,
        firstCollectionDate: c.firstCollectionDate,
        monthlyRentFils: c.monthlyRentFils,
        electricityFixedFils: c.electricityFixedFils,
      },
      { until: MATERIALIZE_UNTIL },
    )) {
      charges.push({ id: demoId("charge"), contractId: c.id, ...s, voided: false, description: null });
    }
  }

  // ------------------------------------------------------------ payments
  const payments: DemoPayment[] = [];
  const allocations: Allocation[] = [];
  let systemSeq = 0;
  const methods: PaymentMethod[] = ["cash", "cash", "knet", "bank_transfer", "cash", "cheque", "link"];
  const pay = (c: DemoContract, amount: Fils, date: ISODate) => {
    if (amount <= 0) return;
    const open: OpenCharge[] = charges
      .filter((ch) => ch.contractId === c.id && ch.amountFils > 0)
      .map((ch) => {
        const allocated = allocations.filter((a) => a.chargeId === ch.id).reduce((s, a) => s + a.amountFils, 0);
        return { id: ch.id, period: ch.period, kind: ch.kind, dueDate: ch.dueDate, outstandingFils: ch.amountFils - allocated };
      })
      .filter((o) => o.outstandingFils > 0);
    const id = demoId("payment");
    const result = allocateFIFO(amount, open);
    systemSeq += 1;
    payments.push({
      id,
      contractId: c.id,
      tenantId: c.tenantId,
      amountFils: amount,
      receivedAt: date,
      receiptNo: receiptNo(),
      systemNo: `RC-${date.slice(0, 4)}-${String(systemSeq).padStart(5, "0")}`,
      method: methods[systemSeq % methods.length]!,
      collectedBy: collectorId,
      voided: false,
    });
    for (const a of result.allocations) allocations.push({ paymentId: id, chargeId: a.chargeId, amountFils: a.amountFils });
  };
  const dayIn = (period: Period, k: number) => `${period}-${String(1 + (k % 25)).padStart(2, "0")}`;

  // Everything through July 2026 is fully paid (except the legal case), one payment per month.
  const paidThrough = (c: DemoContract, last: Period, k: number) => {
    const periods = [...new Set(charges.filter((ch) => ch.contractId === c.id && ch.amountFils > 0).map((ch) => ch.period))].filter(
      (p) => p <= last,
    );
    for (const p of periods) {
      const due = charges.filter((ch) => ch.contractId === c.id && ch.period === p).reduce((s, ch) => s + ch.amountFils, 0);
      pay(c, due, dayIn(p, k + Number(p.slice(5))));
    }
  };
  let k = 0;
  for (const c of [...jabriyaRows.map((r) => r.contract), sabahContract, shop5, ...salmiyaContracts]) paidThrough(c, "2026-07", k++);
  paidThrough(shop3, "2026-06", k++);

  // August 2026: Jabriya exactly per the paper statement, dates spread 01/08–25/08.
  jabriyaRows.forEach((r, i) => pay(r.contract, toFils(r.augustCollected), dayIn("2026-08", i)));
  pay(sabahContract, toFils(400), "2026-08-03");
  pay(shop5, toFils(600), "2026-08-05");
  salmiyaContracts.forEach((c, i) => pay(c, c.monthlyRentFils, dayIn("2026-08", i * 2 + 1)));

  // September 2026: ~70 % of tenants paid; the Sabah tenant paid 3 months (2 in advance).
  const septPayers = jabriyaRows.map((r) => r.contract).filter((_, i) => i % 10 < 7 && i !== 8 && i !== 19);
  septPayers.forEach((c, i) => pay(c, c.monthlyRentFils, dayIn("2026-09", i)));
  pay(sabahContract, toFils(1200), "2026-09-03");
  pay(shop5, toFils(600), "2026-09-06");
  salmiyaContracts.filter((_, i) => i % 3 !== 2).forEach((c, i) => pay(c, c.monthlyRentFils, dayIn("2026-09", i * 2 + 2)));

  // ------------------------------------------------------------ expenses
  const categories: DemoCategory[] = [
    ["راتب شهري", "Monthly salary", "payroll"],
    ["مصاريف صيانة", "Maintenance", "operating"],
    ["وقود وسيارات", "Fuel & vehicles", "operating"],
    ["كهرباء وماء", "Electricity & water", "operating"],
    ["نظافة", "Cleaning", "operating"],
    ["رسوم حكومية", "Government fees", "operating"],
    ["قرطاسية وتصوير", "Stationery & copies", "operating"],
    ["عمولات", "Commissions", "operating"],
    ["تأمين", "Insurance", "operating"],
    ["أخرى", "Other", "operating"],
  ].map(([nameAr, nameEn, type]) => ({ id: demoId("category"), nameAr: nameAr!, nameEn: nameEn!, type: type as DemoCategory["type"] }));
  const cat = (name: string) => categories.find((c) => c.nameAr === name)!.id;

  const beneficiaries: DemoBeneficiary[] = [
    { id: demoId("beneficiary"), name: "محمد (حارس)", kind: "staff", monthlySalaryFils: toFils(170) },
    { id: demoId("beneficiary"), name: "العمارتين", kind: "vendor", monthlySalaryFils: null },
    { id: demoId("beneficiary"), name: "السيارة فورد", kind: "asset", monthlySalaryFils: null },
  ];
  const [haris, vendor, car] = beneficiaries as [DemoBeneficiary, DemoBeneficiary, DemoBeneficiary];

  const line = (
    position: number,
    amount: number,
    categoryId: string,
    beneficiaryId: string,
    description: string,
    mode: AllocationMode,
    propertyIds: string[],
  ) => {
    const amountFils = toFils(amount);
    return {
      id: demoId("line"),
      position,
      amountFils,
      categoryId,
      beneficiaryId,
      description,
      mode,
      allocations: allocateExpenseLine(
        amountFils,
        mode,
        propertyIds.map((propertyId) => ({ propertyId })),
      ),
    };
  };
  const vouchers: DemoVoucher[] = [
    {
      id: demoId("voucher"),
      voucherNo: "EX-2026-00001",
      date: "2026-08-26",
      paidFrom: "cash_box",
      recipientName: "محمد (حارس)",
      notes: "مصاريف شهر أغسطس 2026",
      lines: [
        line(1, 170, cat("راتب شهري"), haris.id, "راتب شهر أغسطس 2026", "single", [jabriya.id]),
        line(2, 4.75, cat("مصاريف صيانة"), vendor.id, "تصوير عداد الكهرباء الجابرية والسالمية", "split_even", [jabriya.id, salmiya.id]),
        line(3, 20.25, cat("وقود وسيارات"), car.id, "فاتورة بنزين للسيارة الفورد", "single", [jabriya.id]),
      ],
    },
  ];

  // ------------------------------------------------------------ deposits
  const deposits: DemoDeposit[] = [
    {
      id: demoId("deposit"),
      date: "2026-08-29",
      amountFils: toFils(17280),
      destination: "office_bank",
      ownerId: null,
      bankName: "بنك الكويت الوطني",
      reference: "DEP-0829",
      properties: [
        { propertyId: jabriya.id, amountFils: toFils("8697.375") },
        { propertyId: salmiya.id, amountFils: toFils("7582.625") },
        { propertyId: sabah.id, amountFils: toFils(400) },
        { propertyId: alRai.id, amountFils: toFils(600) },
      ],
    },
  ];

  // ------------------------------------------------------------ legal
  const legalCases: DemoLegalCase[] = [
    {
      id: demoId("legal"),
      contractId: shop3.id,
      tenantId: shop3.tenantId,
      caseNo: "2026/1184 إيجارات",
      court: "محكمة الرقعي — دائرة الإيجارات",
      type: "rent_claim",
      status: "in_progress",
      amountClaimedFils: toFils(1350),
      nextHearingDate: "2026-10-01",
      lawyer: "مكتب المحامي فهد السالم",
    },
  ];

  return {
    org,
    users,
    owners,
    properties,
    units,
    tenants,
    contracts,
    charges,
    payments,
    allocations,
    categories,
    beneficiaries,
    vouchers,
    deposits,
    legalCases,
    materializedUntil: MATERIALIZE_UNTIL,
    today: DEMO_TODAY,
  };
}

/** Converts demo data to the report Dataset shape (used by tests). */
export function demoDataset(d: DemoData = buildDemoData()): Dataset {
  const tenantById = new Map(d.tenants.map((t) => [t.id, t]));
  const ownerById = new Map(d.owners.map((o) => [o.id, o]));
  return {
    properties: d.properties.map((p) => ({
      id: p.id,
      name: p.name,
      area: p.area,
      ownerIds: [p.ownerId],
      ownerNames: [ownerById.get(p.ownerId)!.fullName],
      commission: null,
    })),
    units: d.units.map((u) => ({
      id: u.id,
      propertyId: u.propertyId,
      label: u.label,
      sortOrder: u.sortOrder,
      type: u.type,
      floor: u.floor,
      areaM2: u.areaM2,
      askingRentFils: u.askingRentFils,
      active: true,
      availableFrom: "2025-01-01",
    })),
    contracts: d.contracts.map((c) => ({
      id: c.id,
      contractNo: c.contractNo,
      type: c.type,
      status: c.status,
      tenantId: c.tenantId,
      tenantName: tenantById.get(c.tenantId)!.fullName,
      tenantPhones: tenantById.get(c.tenantId)!.phones,
      propertyId: c.propertyId,
      unitIds: c.unitIds,
      startDate: c.startDate,
      endDate: c.endDate,
      firstCollectionDate: c.firstCollectionDate,
      moveOutDate: null,
      monthlyRentFils: c.monthlyRentFils,
      autoRenew: c.autoRenew,
      freeMonths: c.freeMonths,
    })),
    charges: d.charges,
    payments: d.payments,
    allocations: d.allocations,
    adjustments: [],
    legalCases: d.legalCases.map((l) => ({ id: l.id, contractId: l.contractId, tenantId: l.tenantId, status: l.status, nextHearingDate: l.nextHearingDate, caseNo: l.caseNo })),
    expenseAllocations: d.vouchers.flatMap((v) =>
      v.lines.flatMap((l) =>
        l.allocations.map((a) => ({
          voucherId: v.id,
          voucherNo: v.voucherNo,
          voucherDate: v.date,
          lineId: l.id,
          propertyId: a.propertyId,
          unitId: a.unitId,
          amountFils: a.amountFils,
          categoryId: l.categoryId,
          categoryName: d.categories.find((c) => c.id === l.categoryId)!.nameAr,
          beneficiaryId: l.beneficiaryId,
          beneficiaryName: d.beneficiaries.find((b) => b.id === l.beneficiaryId)!.name,
          description: l.description,
        })),
      ),
    ),
    vouchers: d.vouchers.map((v) => ({
      id: v.id,
      voucherNo: v.voucherNo,
      date: v.date,
      totalFils: v.lines.reduce((s, l) => s + l.amountFils, 0),
      status: "posted" as const,
    })),
    deposits: d.deposits,
    propertyOwners: d.properties.map((p) => ({ propertyId: p.id, ownerId: p.ownerId, sharePct: 100 })),
  };
}

export { periodOf };
