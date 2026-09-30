import { describe, expect, it } from "vitest";
import {
  civilIdCheckDigit, completeCivilId, formatPhone, isValidEmail, isValidIban, isValidKuwaitPhone, isValidPaci, maskCivilId,
  normalizePhone, validateCivilId, whatsappLink,
} from "@/domain/validation";

describe("civil ID", () => {
  const valid = completeCivilId("28501011235")!;
  it("builds and validates checksum", () => {
    expect(valid).toHaveLength(12);
    const r = validateCivilId(valid);
    expect(r.formatValid).toBe(true);
    expect(r.checksumValid).toBe(true);
    expect(r.birthDate).toBe("1985-01-01");
  });
  it("detects wrong checksum as warning", () => {
    const bad = valid.slice(0, 11) + String((Number(valid[11]) + 1) % 10);
    expect(validateCivilId(bad)).toMatchObject({ formatValid: true, checksumValid: false });
  });
  it("format errors", () => {
    expect(validateCivilId("123").formatValid).toBe(false);
    expect(validateCivilId("٢٨٥٠١٠١١٢٣٤٥").normalized).toBe("285010112345");
  });
  it("check digit known value and impossible remainders", () => {
    // sum = 102, 102 mod 11 = 3, check = 8
    expect(civilIdCheckDigit("28501011235")).toBe(8);
    let sawNull = false;
    for (let i = 0; i < 200 && !sawNull; i++) {
      if (civilIdCheckDigit(`2850101${String(i).padStart(4, "0")}`) === null) sawNull = true;
    }
    expect(sawNull).toBe(true);
    expect(() => civilIdCheckDigit("12")).toThrow();
  });
  it("century 3 and implausible dates", () => {
    const id = completeCivilId("30501011234") ?? completeCivilId("30501011235")!;
    expect(validateCivilId(id).birthDate?.startsWith("2005")).toBe(true);
    const odd = validateCivilId("199999999999");
    expect(odd.birthDate).toBeNull();
    const badDay = validateCivilId("285023011234");
    expect(badDay.birthDate).toBeNull();
  });
  it("mask", () => {
    expect(maskCivilId("253012340043")).toBe("2530••••0043");
    expect(maskCivilId("")).toBe("");
    expect(maskCivilId("123")).toBe("••••");
    expect(maskCivilId(null)).toBe("");
  });
});

describe("PACI & phone", () => {
  it("PACI 8 digits", () => {
    expect(isValidPaci("12045781")).toBe(true);
    expect(isValidPaci("1204578")).toBe(false);
  });
  it("phones", () => {
    expect(isValidKuwaitPhone("55123456")).toBe(true);
    expect(isValidKuwaitPhone("+965 9912 3456")).toBe(true);
    expect(isValidKuwaitPhone("0096522123456")).toBe(true);
    expect(isValidKuwaitPhone("35123456")).toBe(false);
    expect(isValidKuwaitPhone("5512345")).toBe(false);
    expect(normalizePhone("٥٥١٢٣٤٥٦")).toBe("55123456");
    expect(formatPhone("55123456")).toBe("5512 3456");
    expect(formatPhone("123")).toBe("123");
    expect(whatsappLink("55123456", "مرحبا")).toBe("https://wa.me/96555123456?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7");
  });
  it("email & IBAN", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidIban("KW81CBKU0000000000001234560101")).toBe(true);
    expect(isValidIban("KW82CBKU0000000000001234560101")).toBe(false);
    expect(isValidIban("DE89370400440532013000")).toBe(false);
  });
});
