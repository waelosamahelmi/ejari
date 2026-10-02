"use client";
import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      el.isContentEditable)
  );
}

/** Global shortcuts: ⌘K palette, ? help, g d / g c navigation, n p / n c / n v creation. */
export function useGlobalShortcuts(openPalette: () => void) {
  const router = useRouter();
  const [help, setHelp] = useState(false);
  useEffect(() => {
    let prefix: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette();
        return;
      }
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        openPalette();
        return;
      }
      const k = e.key.toLowerCase();
      if (prefix) {
        const combo = prefix + k;
        prefix = null;
        clearTimeout(timer);
        const map: Record<string, string> = {
          gd: "/dashboard",
          gc: "/collections",
          gp: "/properties",
          gr: "/reports",
          np: "/collections?pay=1",
          nc: "/contracts/new",
          nv: "/expenses/new",
        };
        if (map[combo]) {
          e.preventDefault();
          router.push(map[combo]);
        }
        return;
      }
      if (k === "g" || k === "n") {
        prefix = k;
        timer = setTimeout(() => (prefix = null), 900);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPalette, router]);
  return { help, setHelp };
}
