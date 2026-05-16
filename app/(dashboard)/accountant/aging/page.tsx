"use client";

import { useEffect, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { getApiErrorMessage } from "@/lib/api-errors";
import { receivableService, type ReceivableAging, type ReceivableRow } from "@/services/receivable";
import AgingSummary from "@/components/accountant/AgingSummary";
import AgingTable from "@/components/accountant/AgingTable";
import PrintAgingButton from "@/components/accountant/PrintAgingButton";

export default function AgingPage() {
  const [aging, setAging] = useState<ReceivableAging | null>(null);
  const [rows, setRows] = useState<ReceivableRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [agingResult, receivablesResult] = await Promise.all([
          receivableService.getAging(),
          receivableService.listReceivables({ page: 1, limit: 100 }),
        ]);
        if (cancelled) return;
        setAging(agingResult);
        setRows(receivablesResult.data ?? []);
      } catch (loadError: unknown) {
        if (cancelled) return;
        setError(getApiErrorMessage(loadError, "Gagal memuat aging piutang."));
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleExport = async (format: "pdf" | "csv") => {
    try {
      const blob = await receivableService.exportReceivables(format, { page: 1, limit: 100 });
      const ext = format === "pdf" ? "pdf" : "csv";
      const filename = `receivables-aging.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Gagal mengekspor laporan.");
      setError(message);
      alert(message);
    }
  };

  return (
    <FeaturePage
      title="Aging Piutang"
      description="Ringkasan aging piutang seluruh invoice. Gunakan export untuk keperluan laporan keuangan."
      actions={[
        { label: "Export PDF", onClick: () => handleExport("pdf") },
        { label: "Export CSV", onClick: () => handleExport("csv") },
      ]}
    >
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AgingTable rows={rows} />
        </div>
        <div>
          <AgingSummary aging={aging} />
          <div className="mt-4">
            <PrintAgingButton aging={aging} rows={rows} />
          </div>
        </div>
      </div>
    </FeaturePage>
  );
}
