"use client";

import { useEffect, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import { receivableService } from "@/services/receivable";
import AgingSummary from "@/components/accountant/AgingSummary";
import AgingTable from "@/components/accountant/AgingTable";
import PrintAgingButton from "@/components/accountant/PrintAgingButton";

export default function AgingPage() {
  const [aging, setAging] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    receivableService
      .getAging()
      .then((r) => mounted && setAging(r))
      .catch(() => {})
      .finally(() => mounted && setLoading(false));

    receivableService
      .listReceivables({ page: 1, limit: 100 })
      .then((res) => {
        if (!mounted) return;
        setRows(res.data ?? res ?? []);
      })
      .catch(() => {})
      .finally(() => {
        /* no-op */
      });

    return () => {
      mounted = false;
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
    } catch (e) {
      console.error(e);
      alert("Gagal mengekspor laporan");
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
