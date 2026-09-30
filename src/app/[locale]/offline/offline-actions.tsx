"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function OfflineActions({
  retry,
  openCollections,
  locale,
}: {
  retry: string;
  openCollections: string;
  locale: string;
}) {
  // Leave the fallback automatically once the connection is back.
  useEffect(() => {
    const on = () => window.location.reload();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, []);
  return (
    <div className="mt-6 flex flex-col gap-3">
      <Button size="lg" block onClick={() => window.location.reload()}>
        {retry}
      </Button>
      <Button
        size="lg"
        block
        variant="secondary"
        onClick={() => (window.location.href = `/${locale}/collections`)}
      >
        {openCollections}
      </Button>
    </div>
  );
}
