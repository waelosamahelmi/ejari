import { ErrorView } from "@/components/domain/error-view";

export default function SegmentNotFound() {
  return <ErrorView kind="notFound" fullPage />;
}
