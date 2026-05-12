"use client";

import React from "react";
import type { ReceivableAging, ReceivableRow } from "@/services/receivable";

function buildTableHtml(aging: ReceivableAging | null, rows: ReceivableRow[]) {
  const header = `
    <div style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; padding:20px;">
      <h2 style="margin:0 0 8px 0">Aging Receivables</h2>
      <p style="margin:0 0 12px 0">Generated from system</p>
  `;

  const bucketsHtml = aging
    ? `
      <div style="display:flex;gap:12px;margin-bottom:12px;">
        <div style="padding:8px;border:1px solid #eee;border-radius:6px;">Current<br/><strong>${aging.current.count}</strong><div style="font-size:12px">Rp ${aging.current.amount.toLocaleString()}</div></div>
        <div style="padding:8px;border:1px solid #eee;border-radius:6px;">1-30<br/><strong>${aging.days1To30.count}</strong><div style="font-size:12px">Rp ${aging.days1To30.amount.toLocaleString()}</div></div>
        <div style="padding:8px;border:1px solid #eee;border-radius:6px;">31-60<br/><strong>${aging.days31To60.count}</strong><div style="font-size:12px">Rp ${aging.days31To60.amount.toLocaleString()}</div></div>
        <div style="padding:8px;border:1px solid #eee;border-radius:6px;">61-90<br/><strong>${aging.days61To90.count}</strong><div style="font-size:12px">Rp ${aging.days61To90.amount.toLocaleString()}</div></div>
        <div style="padding:8px;border:1px solid #eee;border-radius:6px;">&gt;90<br/><strong>${aging.daysOver90.count}</strong><div style="font-size:12px">Rp ${aging.daysOver90.amount.toLocaleString()}</div></div>
      </div>
    `
    : "";

  const rowsHtml = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:6px;border:1px solid #ddd">${r.invoiceNumber}</td>
        <td style="padding:6px;border:1px solid #ddd">${r.customerName}</td>
        <td style="padding:6px;border:1px solid #ddd">${r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '-'}</td>
        <td style="padding:6px;border:1px solid #ddd">${r.remainingAmount.toLocaleString()}</td>
      </tr>
    `,
    )
    .join('\n');

  const table = `
    <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:12px">
      <thead>
        <tr>
          <th style="padding:6px;border:1px solid #ddd">Invoice</th>
          <th style="padding:6px;border:1px solid #ddd">Customer</th>
          <th style="padding:6px;border:1px solid #ddd">Due Date</th>
          <th style="padding:6px;border:1px solid #ddd">Remaining</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  return `${header}${bucketsHtml}${table}</div>`;
}

export default function PrintAgingButton({ aging, rows }: { aging: ReceivableAging | null; rows: ReceivableRow[] }) {
  const handlePrint = () => {
    const html = buildTableHtml(aging, rows);
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset=\"utf-8\"><title>Aging Receivables</title></head><body>${html}</body></html>`);
    w.document.close();
    // Give the window a moment to render
    setTimeout(() => {
      w.focus();
      w.print();
    }, 300);
  };

  return (
    <button onClick={handlePrint} className="rounded-md border px-3 py-2 text-xs">
      Cetak Aging
    </button>
  );
}
