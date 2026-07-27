"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { auditService, type AuditRow } from "@/services/audit";

const MAX_ENTRIES = 100;
const RECONNECT_DELAY_MS = 3000;

const formatDateTime = (value?: string | null) => {
	if (!value) return "-";
	try {
		return new Date(value).toLocaleString("id-ID");
	} catch {
		return String(value);
	}
};

const actionBadge: Record<string, string> = {
	CREATE: "bg-emerald-100 text-emerald-800",
	UPDATE: "bg-blue-100 text-blue-800",
	DELETE: "bg-rose-100 text-rose-800",
	READ: "bg-slate-100 text-slate-700",
	LOGIN: "bg-violet-100 text-violet-800",
	LOGOUT: "bg-amber-100 text-amber-800",
};

export interface AuditLogStreamProps {
	/** Maximum entries to display. Default 100. */
	maxEntries?: number;
	/** Extra CSS class on the outer container. */
	className?: string;
}

export function AuditLogStream({
	maxEntries = MAX_ENTRIES,
	className,
}: AuditLogStreamProps) {
	const [entries, setEntries] = useState<AuditRow[]>([]);
	const [connected, setConnected] = useState(false);
	const [error, setError] = useState("");
	const sourceRef = useRef<EventSource | null>(null);
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const mountedRef = useRef(true);

	const cleanup = useCallback(() => {
		if (sourceRef.current) {
			sourceRef.current.close();
			sourceRef.current = null;
		}
		if (reconnectTimerRef.current) {
			clearTimeout(reconnectTimerRef.current);
			reconnectTimerRef.current = null;
		}
	}, []);

	const connect = useCallback(() => {
		if (!mountedRef.current) return;
		cleanup();

		setError("");
		const url = auditService.streamUrl;
		const es = new EventSource(url, { withCredentials: true });
		sourceRef.current = es;

		es.onopen = () => {
			if (!mountedRef.current) return;
			setConnected(true);
			setError("");
		};

		es.onmessage = (event: MessageEvent) => {
			if (!mountedRef.current) return;
			try {
				const data: AuditRow = JSON.parse(event.data);
				setEntries((prev) => {
					const next = [data, ...prev];
					return next.length > maxEntries ? next.slice(0, maxEntries) : next;
				});
			} catch {
				// malformed event — ignore
			}
		};

		es.onerror = () => {
			if (!mountedRef.current) return;
			setConnected(false);
			es.close();
			sourceRef.current = null;
			// auto-reconnect
			reconnectTimerRef.current = setTimeout(() => {
				connect();
			}, RECONNECT_DELAY_MS);
		};
	}, [cleanup, maxEntries]);

	useEffect(() => {
		mountedRef.current = true;
		connect();

		return () => {
			mountedRef.current = false;
			cleanup();
		};
	}, [connect, cleanup]);

	return (
		<div className={className}>
			{/* Status bar */}
			<div className="mb-3 flex items-center gap-2">
				<span
					className={`inline-block h-2.5 w-2.5 rounded-full ${
						connected ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
					}`}
					aria-label={connected ? "Live — connected" : "Disconnected"}
				/>
				<span className="text-sm font-medium text-slate-700">
					{connected ? "Live" : error ? "Reconnecting…" : "Connecting…"}
				</span>
				{error ? (
					<span className="text-xs text-red-500">{error}</span>
				) : null}
			</div>

			{/* Entries */}
			<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				{entries.length === 0 ? (
					<div className="px-4 py-8 text-center text-sm text-slate-500">
						{connected
							? "Menunggu event baru…"
							: "Menghubungkan ke stream…"}
					</div>
				) : (
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
							<tr>
								<th className="px-4 py-3">Waktu</th>
								<th className="px-4 py-3">Actor</th>
								<th className="px-4 py-3">Action</th>
								<th className="px-4 py-3">Entity</th>
								<th className="px-4 py-3">Description</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{entries.map((entry, idx) => (
								<tr
									key={`${entry.id}-${idx}`}
									className="hover:bg-slate-50/50"
								>
									<td className="whitespace-nowrap px-4 py-3 text-slate-700">
										{formatDateTime(entry.createdAt)}
									</td>
									<td className="px-4 py-3 font-medium text-slate-900">
										{entry.actorEmail ?? "-"}
									</td>
									<td className="px-4 py-3">
										<span
											className={`rounded-full px-2 py-1 text-xs font-medium ${
												actionBadge[entry.action] ??
												"bg-slate-100 text-slate-700"
											}`}
										>
											{entry.action}
										</span>
									</td>
									<td className="px-4 py-3 text-slate-700">
										{entry.resourceType ?? "-"}
										{entry.resourceId ? (
											<span className="ml-1 font-mono text-xs text-slate-500">
												({entry.resourceId.length > 8 ? `${entry.resourceId.slice(0, 8)}…` : entry.resourceId})
											</span>
										) : null}
									</td>
									<td className="max-w-xs px-4 py-3 text-slate-700">
										<div className="line-clamp-2">{entry.message ?? "-"}</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}

export default AuditLogStream;
