"use client";
import { useCallback, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Runs a server action inside a transition; shows a translated error toast on failure. */
export function useAction() {
  const tErr = useTranslations("errors");
  const [pending, start] = useTransition();
  const exec = useCallback(
    <T,>(fn: () => Promise<Result<T>>, opts: { success?: string; onSuccess?: (data: T) => void; onError?: (r: Extract<Result<T>, { ok: false }>) => void } = {}) =>
      new Promise<Result<T>>((resolve) => {
        start(async () => {
          let r: Result<T>;
          try {
            r = await fn();
          } catch {
            r = { ok: false, error: navigator.onLine ? "generic" : "network" };
          }
          if (r.ok) {
            if (opts.success) toast.success(opts.success);
            opts.onSuccess?.(r.data);
          } else {
            const key = r.error as Parameters<typeof tErr>[0];
            toast.error(tErr.has(key) ? tErr(key) : tErr("generic"));
            opts.onError?.(r);
          }
          resolve(r);
        });
      }),
    [tErr],
  );
  return { pending, exec };
}

/** Translates zod issue messages ("required", "invalidPhone"…) to errors.field.*. */
export function useFieldError() {
  const t = useTranslations("errors.field");
  return (msg: string | undefined | null) => {
    if (!msg) return undefined;
    const key = msg as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : msg;
  };
}
