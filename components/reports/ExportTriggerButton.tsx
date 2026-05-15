"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { ExportModal } from "./ExportModal";
import type { ReportType } from "@/types/export-log";

interface ExportTriggerButtonProps {
  reportType: ReportType;
  filters: Record<string, unknown>;
  filterSummary: string;
  className?: string;
}

export function ExportTriggerButton({
  reportType,
  filters,
  filterSummary,
  className,
}: ExportTriggerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        }
      >
        <Download className="h-4 w-4" />
        Export
      </button>
      <ExportModal
        open={open}
        onClose={() => setOpen(false)}
        reportType={reportType}
        filters={filters}
        filterSummary={filterSummary}
      />
    </>
  );
}
