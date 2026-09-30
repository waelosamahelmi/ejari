"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, FileText, ImageIcon, Trash2, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertDialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { NoContractsIllustration } from "@/components/illustrations";
import { deleteAttachment, listAttachments, uploadAttachment, type AttachmentView } from "@/server/actions/files";

/** Documents list for any entity: upload (incl. camera capture on mobile), open via signed URL, delete. */
export function Documents({ entityType, entityId, canEdit, canDelete }: { entityType: string; entityId: string; canEdit: boolean; canDelete?: boolean }) {
  const t = useTranslations("documents");
  const tc = useTranslations("common.actions");
  const locale = useLocale();
  const [rows, setRows] = useState<AttachmentView[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => setRows(await listAttachments(entityType, entityId)), [entityType, entityId]);
  useEffect(() => {
    void load();
  }, [load]);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.set("file", f);
      const r = await uploadAttachment(entityType, entityId, fd);
      if (!r.ok) toast.error(t("tooLarge"));
    }
    setBusy(false);
    toast.success(t("uploaded"));
    void load();
  };
  const size = (n: number | null) => (n ? `${(n / 1024 / 1024).toFixed(n > 1024 * 1024 ? 1 : 2)} MB` : "");
  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => input.current?.click()} loading={busy}>
            <Upload />
            {busy ? t("uploading") : t("upload")}
          </Button>
          <Button variant="secondary" className="sm:hidden" onClick={() => camera.current?.click()}>
            <Camera />
            {t("camera")}
          </Button>
          <input ref={input} type="file" hidden multiple accept="image/*,application/pdf" onChange={(e) => void upload(e.target.files)} />
          <input ref={camera} type="file" hidden accept="image/*" capture="environment" onChange={(e) => void upload(e.target.files)} />
        </div>
      )}
      {rows === null ? (
        <Skeleton className="h-16" />
      ) : rows.length === 0 ? (
        <EmptyState compact illustration={<NoContractsIllustration />} title={t("empty")} description={t("emptyText")} />
      ) : (
        <ul className="bg-paper divide-separator divide-y-[0.5px] overflow-hidden rounded-[20px] shadow-[var(--sh-card)]">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span className="bg-inset flex size-10 shrink-0 items-center justify-center rounded-[10px]">{r.mime?.startsWith("image/") ? <ImageIcon className="size-5" /> : <FileText className="size-5" />}</span>
              <a href={r.url ?? undefined} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{r.fileName}</div>
                <div className="text-label-2 num text-[12px]">
                  {new Date(r.createdAt).toLocaleDateString(locale === "ar" ? "ar-KW-u-nu-latn" : "en-GB")} · {size(r.size)}
                </div>
              </a>
              {canDelete && (
                <button type="button" aria-label={tc("delete")} onClick={() => setConfirm(r.id)} className="text-label-3 hover:text-red-text flex size-9 items-center justify-center rounded-full">
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <AlertDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t("deleteConfirm")}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        destructive
        onConfirm={async () => {
          if (!confirm) return;
          await deleteAttachment(confirm);
          setConfirm(null);
          toast.success(t("deleted"));
          void load();
        }}
      />
    </div>
  );
}
