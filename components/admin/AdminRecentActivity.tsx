"use client";

import { useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/api-errors";
import { auditService, type AuditRow } from "@/services/audit";

export default function AdminRecentActivity() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await auditService.listLatest(6);
          if (cancelled) return;
          setItems(result ?? []);
        } catch (loadError: unknown) {
          if (cancelled) return;
          setError(getApiErrorMessage(loadError, "Gagal memuat aktivitas terbaru."));
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-800">Recent activity</p>
      <div className="mt-3 space-y-2 text-sm text-slate-700">
        {loading && <div className="text-xs text-slate-500">Loading...</div>}
        {!loading && error ? <div className="text-xs text-rose-600">{error}</div> : null}
        {!loading && items.length === 0 && <div className="text-xs text-slate-500">No recent activity</div>}
        {!loading && items.map((it) => (
          <div key={it.id} className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500">{new Date(it.createdAt).toLocaleString()}</div>
              <div className="mt-1 text-sm text-slate-700">{it.message ?? it.action}</div>
              <div className="text-xs text-slate-400">{it.actorEmail ?? it.actorUserId ?? 'system'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
