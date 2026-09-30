"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { NoResultsIllustration } from "@/components/illustrations";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented";
import { SearchField } from "@/components/ui/search-field";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { offlineDb, type SharedFile } from "@/lib/offline/db";
import { searchEverything, type SearchHit } from "@/server/actions/search";
import { uploadAttachment } from "@/server/actions/files";
import { cn } from "@/lib/utils";

type Target = "payment" | "voucher" | "contract" | "unit";
const KIND: Record<Target, SearchHit["kind"]> = {
  payment: "receipt",
  voucher: "voucher",
  contract: "contract",
  unit: "unit",
};
const BUCKET = {
  payment: "receipts",
  voucher: "vouchers",
  contract: "contracts",
  unit: "documents",
} as const;

/** Files shared into the installed app (share_target) → "Attach to…" (§19.1). */
export function ShareInbox({ unsupported }: { unsupported: boolean }) {
  const t = useTranslations("pwa.share");
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState<Target>("payment");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await (await offlineDb()).getAll("shared");
      all.sort((a, b) => b.receivedAt - a.receivedAt);
      setFiles(all);
      setSelected(all.map((f) => f.id));
    } catch {
      setFiles([]);
    }
  }, []);
  useEffect(() => void load(), [load]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of files)
      if (f.type.startsWith("image/")) next[f.id] = URL.createObjectURL(f.blob);
    setUrls(next);
    return () => Object.values(next).forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  useEffect(() => {
    if (q.trim().length < 1) return setHits([]);
    const id = window.setTimeout(() => {
      searchEverything(q)
        .then((r) => setHits(r.filter((h) => h.kind === KIND[target]).slice(0, 12)))
        .catch(() => setHits([]));
    }, 200);
    return () => window.clearTimeout(id);
  }, [q, target]);

  const remove = async (id: string) => {
    await (await offlineDb()).delete("shared", id);
    await load();
  };

  const attach = async (hit: SearchHit) => {
    setBusy(hit.id);
    try {
      for (const f of files.filter((x) => selected.includes(x.id))) {
        const fd = new FormData();
        fd.set("file", new File([f.blob], f.name, { type: f.type }));
        const r = await uploadAttachment(target, hit.id, fd, BUCKET[target]);
        if (!r.ok) throw new Error(r.error);
        await (await offlineDb()).delete("shared", f.id);
      }
      toast.success(t("attached"));
      await load();
    } catch {
      toast.error(t("unsupported"));
    } finally {
      setBusy(null);
    }
  };

  const chosen = useMemo(() => files.filter((f) => selected.includes(f.id)), [files, selected]);

  return (
    <>
      <LargeTitleHeader title={t("title")} subtitle={files.length ? t("subtitle") : undefined} />
      {files.length === 0 ? (
        <EmptyState
          illustration={<NoResultsIllustration />}
          title={unsupported ? t("unsupported") : t("empty")}
          description={unsupported ? undefined : t("emptyText")}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {files.map((f) => {
              const on = selected.includes(f.id);
              return (
                <Card
                  key={f.id}
                  className={cn(
                    "relative overflow-hidden p-0 transition-shadow",
                    on && "ring-ink ring-2",
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={on}
                    className="block w-full text-start"
                    onClick={() =>
                      setSelected((s) => (on ? s.filter((x) => x !== f.id) : [...s, f.id]))
                    }
                  >
                    <div className="bg-inset flex aspect-[4/5] items-center justify-center">
                      {urls[f.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                        <img src={urls[f.id]} alt={f.name} className="size-full object-cover" />
                      ) : (
                        <FileText className="text-label-2 size-10" aria-hidden />
                      )}
                    </div>
                    <div className="truncate p-3 text-[13px]">{f.name}</div>
                  </button>
                  <button
                    type="button"
                    aria-label={t("remove")}
                    onClick={() => remove(f.id)}
                    className="glass absolute end-2 top-2 flex size-9 items-center justify-center rounded-full text-white"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </Card>
              );
            })}
          </div>
          <section className="space-y-3">
            <h2 className="text-[20px] font-semibold">{t("attachTo")}</h2>
            <SegmentedControl
              options={(["payment", "voucher", "contract", "unit"] as const).map((x) => ({
                value: x,
                label: t(`targets.${x}`),
              }))}
              value={target}
              onChange={(v) => setTarget(v as Target)}
            />
            <SearchField
              value={q}
              onValueChange={setQ}
              placeholder={t("search")}
              aria-label={t("search")}
            />
            {hits.length > 0 && (
              <GroupedSection>
                {hits.map((h) => (
                  <ListRow
                    key={h.id}
                    title={<bdi>{h.title}</bdi>}
                    subtitle={h.subtitle}
                    trailing={
                      <Button
                        size="sm"
                        disabled={chosen.length === 0}
                        loading={busy === h.id}
                        onClick={() => attach(h)}
                      >
                        {t("attach")}
                      </Button>
                    }
                  />
                ))}
              </GroupedSection>
            )}
          </section>
        </div>
      )}
    </>
  );
}
