"use client";
import { useLocale } from "next-intl";

export function useDir(): "rtl" | "ltr" {
  return useLocale() === "ar" ? "rtl" : "ltr";
}
