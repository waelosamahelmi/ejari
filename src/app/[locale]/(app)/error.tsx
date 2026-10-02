"use client";
import { ErrorView } from "@/components/domain/error-view";

export default function SegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorView kind="error" error={error} reset={reset} />;
}
