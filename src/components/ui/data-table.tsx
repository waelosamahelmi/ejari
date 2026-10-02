"use client";
import { useMemo, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  type Row,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, Columns3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "./menu";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    align?: "start" | "end" | "center";
    numeric?: boolean;
    className?: string;
    headerClassName?: string;
    footer?: ReactNode;
    hideOnMobile?: boolean;
  }
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  getRowId?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  /** Sticky totals footer (renders meta.footer per column). */
  showFooter?: boolean;
  selectable?: boolean;
  bulkBar?: (rows: T[], clear: () => void) => ReactNode;
  density?: "comfortable" | "compact";
  initialSorting?: SortingState;
  columnToggle?: boolean;
  /** Card renderer used below the `md` breakpoint (tables become cards on mobile). */
  renderCard?: (row: T) => ReactNode;
  empty?: ReactNode;
  className?: string;
  maxHeight?: string;
  rowClassName?: (row: T) => string | undefined;
  caption?: string;
  groupBy?: (row: T) => string;
  groupLabel?: (key: string, rows: T[]) => ReactNode;
}

const VIRTUALIZE_AFTER = 200;

export function DataTable<T>({
  data,
  columns,
  getRowId,
  onRowClick,
  showFooter,
  selectable,
  bulkBar,
  density = "comfortable",
  initialSorting = [],
  columnToggle,
  renderCard,
  empty,
  className,
  maxHeight = "calc(100dvh - 240px)",
  rowClassName,
  caption,
  groupBy,
  groupLabel,
}: DataTableProps<T>) {
  const t = useTranslations("ui");
  const tc = useTranslations("common.actions");
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const [selection, setSelection] = useState<RowSelectionState>({});
  const cols = useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!selectable) return columns;
    return [
      {
        id: "_select",
        size: 44,
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label={t("selected", { count: table.getSelectedRowModel().rows.length })}
            className="size-[18px] accent-[var(--brand-ink)]"
            checked={table.getIsAllRowsSelected()}
            ref={(el) => {
              if (el) el.indeterminate = table.getIsSomeRowsSelected();
            }}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={tc("select")}
            className="size-[18px] accent-[var(--brand-ink)]"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onClick={(e) => e.stopPropagation()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      },
      ...columns,
    ];
  }, [columns, selectable, t, tc]);

  const table = useReactTable({
    data,
    columns: cols,
    state: { sorting, columnVisibility: visibility, rowSelection: selection },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    onRowSelectionChange: setSelection,
    getRowId,
    enableRowSelection: selectable,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowH = density === "compact" ? 44 : 56;
  const virtual = rows.length > VIRTUALIZE_AFTER && !groupBy;
  const virtualizer = useVirtualizer({
    count: virtual ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowH,
    overscan: 12,
  });
  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);

  const onKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, row: Row<T>) => {
    if (e.key === "Enter" && onRowClick) onRowClick(row.original);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (
        e.key === "ArrowDown"
          ? e.currentTarget.nextElementSibling
          : e.currentTarget.previousElementSibling
      ) as HTMLElement | null;
      next?.focus();
    }
  };

  const alignClass = (a?: "start" | "end" | "center", numeric?: boolean) =>
    a === "end" || numeric ? "text-end" : a === "center" ? "text-center" : "text-start";

  const renderRow = (row: Row<T>, style?: React.CSSProperties) => (
    <tr
      key={row.id}
      tabIndex={onRowClick ? 0 : -1}
      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
      onKeyDown={(e) => onKeyDown(e, row)}
      data-selected={row.getIsSelected() || undefined}
      style={style}
      className={cn(
        "border-separator group border-b-[0.5px] outline-none last:border-b-0 focus-visible:bg-[color-mix(in_srgb,var(--brand-gulf)_8%,transparent)]",
        onRowClick && "hover:bg-paper-2 cursor-pointer",
        "data-[selected]:bg-[color-mix(in_srgb,var(--brand-gulf)_7%,transparent)]",
        rowClassName?.(row.original),
      )}
    >
      {row.getVisibleCells().map((cell) => {
        const meta = cell.column.columnDef.meta;
        return (
          <td
            key={cell.id}
            className={cn(
              "align-middle first:ps-5 last:pe-5",
              density === "compact" ? "h-11 px-2 text-[14px]" : "h-14 px-3 text-[15px]",
              alignClass(meta?.align, meta?.numeric),
              meta?.numeric && "num",
              meta?.className,
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        );
      })}
    </tr>
  );

  const groups = useMemo(() => {
    if (!groupBy) return null;
    const m = new Map<string, Row<T>[]>();
    for (const r of rows) {
      const k = groupBy(r.original);
      const arr = m.get(k);
      if (arr) arr.push(r);
      else m.set(k, [r]);
    }
    return [...m.entries()];
  }, [rows, groupBy]);

  if (data.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={cn("relative", className)}>
      {columnToggle && (
        <div className="mb-2 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger className="text-label-2 hover:text-label flex h-9 items-center gap-2 rounded-full px-3 text-[14px]">
              <Columns3 className="size-4" />
              {t("columns")}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={c.getIsVisible()}
                    onCheckedChange={(v) => c.toggleVisibility(!!v)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {typeof c.columnDef.header === "string" ? c.columnDef.header : c.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {renderCard && (
        <div className="space-y-2.5 md:hidden">
          {rows.map((r) => (
            <div key={r.id}>{renderCard(r.original)}</div>
          ))}
        </div>
      )}

      <div
        ref={scrollRef}
        className={cn(
          "bg-paper overflow-auto rounded-[20px] shadow-[var(--sh-card)]",
          renderCard && "hidden md:block",
        )}
        style={{ maxHeight }}
      >
        <table className="w-full border-collapse">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="material-bar sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-separator border-b-[0.5px]">
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta;
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      style={{
                        width:
                          h.column.columnDef.size !== 150 ? h.column.columnDef.size : undefined,
                      }}
                      className={cn(
                        "text-label-2 h-11 text-[13px] font-medium first:ps-5 last:pe-5",
                        density === "compact" ? "px-2 leading-4" : "px-3 whitespace-nowrap",
                        alignClass(meta?.align, meta?.numeric),
                        meta?.headerClassName,
                      )}
                    >
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className={cn(
                            "hover:text-label inline-flex items-center gap-1",
                            (meta?.numeric || meta?.align === "end") && "flex-row-reverse",
                          )}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3.5" />
                          ) : null}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="text-label-2 h-24 text-center text-[15px]">
                  {t("noRows")}
                </td>
              </tr>
            )}
            {virtual ? (
              <>
                <tr style={{ height: virtualizer.getVirtualItems()[0]?.start ?? 0 }} aria-hidden />
                {virtualizer.getVirtualItems().map((vi) => renderRow(rows[vi.index]!))}
                <tr
                  style={{
                    height:
                      virtualizer.getTotalSize() - (virtualizer.getVirtualItems().at(-1)?.end ?? 0),
                  }}
                  aria-hidden
                />
              </>
            ) : groups ? (
              groups.map(([key, gRows]) => (
                <GroupRows
                  key={key}
                  span={cols.length}
                  label={
                    groupLabel
                      ? groupLabel(
                          key,
                          gRows.map((r) => r.original),
                        )
                      : key
                  }
                >
                  {gRows.map((r) => renderRow(r))}
                </GroupRows>
              ))
            ) : (
              rows.map((r) => renderRow(r))
            )}
          </tbody>
          {showFooter && (
            <tfoot className="material-bar sticky bottom-0 z-10">
              <tr className="border-separator border-t-[0.5px]">
                {table.getVisibleLeafColumns().map((c) => {
                  const meta = c.columnDef.meta;
                  return (
                    <td
                      key={c.id}
                      className={cn(
                        "h-12 px-3 text-[15px] font-semibold first:ps-5 last:pe-5",
                        alignClass(meta?.align, meta?.numeric),
                        meta?.numeric && "num",
                      )}
                    >
                      {meta?.footer}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {selectable && bulkBar && selectedRows.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(96px+var(--safe-bottom))] z-40 flex justify-center px-4 lg:bottom-6">
          <div className="bg-ink text-on-ink flex items-center gap-3 rounded-full py-2 ps-5 pe-2 shadow-[var(--sh-float)]">
            <span className="text-[14px] font-medium">
              {t("selected", { count: selectedRows.length })}
            </span>
            {bulkBar(selectedRows, () => setSelection({}))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupRows({
  label,
  span,
  children,
}: {
  label: ReactNode;
  span: number;
  children: ReactNode;
}) {
  return (
    <>
      <tr className="bg-paper-2">
        <th
          colSpan={span}
          scope="rowgroup"
          className="text-label-2 h-9 px-5 text-start text-[13px] font-semibold"
        >
          {label}
        </th>
      </tr>
      {children}
    </>
  );
}
