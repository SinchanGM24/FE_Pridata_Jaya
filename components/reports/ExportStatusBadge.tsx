import type { ExportStatus } from "@/types/export-log";

const CONFIG: Record<ExportStatus, { label: string; className: string }> = {
  PENDING: { label: "Antrian", className: "bg-slate-100 text-slate-700" },
  PROCESSING: { label: "Proses", className: "bg-blue-100 text-blue-700" },
  SUCCESS: { label: "Selesai", className: "bg-green-100 text-green-700" },
  FAILED: { label: "Gagal", className: "bg-red-100 text-red-700" },
};

interface ExportStatusBadgeProps {
  status: ExportStatus;
  errorMessage?: string | null;
}

export function ExportStatusBadge({
  status,
  errorMessage,
}: ExportStatusBadgeProps) {
  const config = CONFIG[status];
  return (
    <span
      className={`inline-block rounded px-2 py-1 text-xs font-medium ${config.className}`}
      title={errorMessage ?? undefined}
    >
      {config.label}
    </span>
  );
}
