"use client";

import React from "react";
import Link from "next/link";
import type { ReceivableRow } from "@/services/receivable";

function daysOverdue(due?: string | null) {
  if (!due) return "-";
  try {
    const now = new Date();
    const dd = new Date(due);
    const diff = Math.floor((now.getTime() - dd.getTime()) / 86400000);
    return diff > 0 ? diff : 0;
  } catch (e) {
    return "-";
  }
}

export default function AgingTable({ rows }: { rows: ReceivableRow[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-800">Detail receivables</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full table-auto text-left">
          <thead>
            <tr className="text-xs text-slate-500">
              <th className="px-2 py-2">Invoice</th>
              <th className="px-2 py-2">Customer</th>
              <th className="px-2 py-2">Due Date</th>
              <th className="px-2 py-2">Days</th>
              <th className="px-2 py-2">Amount</th>
              <th className="px-2 py-2">Remaining</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-xs text-slate-500">
                  Tidak ada data.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 text-sm">
                <td className="px-2 py-3">{r.invoiceNumber}</td>
                <td className="px-2 py-3">
                  <Link href={`/receivables/${r.id}`} className="text-indigo-600">{r.customerName}</Link>
                </td>
                <td className="px-2 py-3">{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '-'}</td>
                <td className="px-2 py-3">{daysOverdue(r.dueDate)}</td>
                <td className="px-2 py-3">Rp {r.amount.toLocaleString()}</td>
                <td className="px-2 py-3">Rp {r.remainingAmount.toLocaleString()}</td>
                <td className="px-2 py-3">{r.status}</td>
                <td className="px-2 py-3">
                  <div className="flex gap-2">
                    <Link href={`/receivables/${r.id}`} className="text-xs rounded-md border px-2 py-1">Detail</Link>
                    <Link href={`/fakturis/create?customerId=${r.storeId || ''}`} className="text-xs rounded-md bg-indigo-600 px-2 py-1 text-white">Buat Invoice</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
