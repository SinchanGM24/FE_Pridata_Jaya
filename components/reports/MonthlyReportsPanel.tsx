"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
	deliveryStatusLabels,
	monthlyReportFormatLabels,
	monthlyReportsService,
	monthlyReportTypeLabels,
	type CreateSchedulePayload,
	type DeliveryStatus,
	type MonthlyReportDeliveryLog,
	type MonthlyReportSchedule,
	type MonthlyReportType,
} from "@/services/monthly-reports";

type Tab = "schedules" | "run" | "logs";

interface ScheduleFormState {
	name: string;
	dayOfMonth: number;
	recipientInput: string;
	reportTypes: MonthlyReportType[];
	isActive: boolean;
}

interface RunFormState {
	year: number;
	month: number;
	recipientInput: string;
}

const monthlyReportTypes: MonthlyReportType[] = [
	"sales",
	"orders",
	"invoices",
	"payments",
	"receivables",
	"stocks",
	"shipments",
];

const defaultTimezone = "Asia/Makassar";
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, index) => currentYear - index);
const months = [
	{ value: 1, label: "Januari" },
	{ value: 2, label: "Februari" },
	{ value: 3, label: "Maret" },
	{ value: 4, label: "April" },
	{ value: 5, label: "Mei" },
	{ value: 6, label: "Juni" },
	{ value: 7, label: "Juli" },
	{ value: 8, label: "Agustus" },
	{ value: 9, label: "September" },
	{ value: 10, label: "Oktober" },
	{ value: 11, label: "November" },
	{ value: 12, label: "Desember" },
];

const defaultScheduleForm = (): ScheduleFormState => ({
	name: "",
	dayOfMonth: 1,
	recipientInput: "",
	reportTypes: ["sales", "orders", "invoices", "payments", "receivables", "stocks", "shipments"],
	isActive: true,
});

const parseRecipients = (input: string): string[] =>
	input
		.split(/[,\n]/)
		.map((email) => email.trim())
		.filter(Boolean);

const buildCron = (dayOfMonth: number) => `0 8 ${dayOfMonth} * *`;

const getDayFromCron = (cronExpression: string): number => {
	const day = Number(cronExpression.trim().split(/\s+/)[2]);
	return Number.isInteger(day) && day >= 1 && day <= 28 ? day : 1;
};

const getMonthPeriod = (year: number, month: number) => {
	const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
	const periodEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - 1);
	return {
		periodStart: periodStart.toISOString(),
		periodEnd: periodEnd.toISOString(),
	};
};

const formatDateTime = (dateString?: string | null): string => {
	if (!dateString) return "-";
	return new Intl.DateTimeFormat("id-ID", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(dateString));
};

const formatPeriod = (log: MonthlyReportDeliveryLog): string => {
	const start = new Date(log.periodStart);
	return new Intl.DateTimeFormat("id-ID", {
		month: "long",
		year: "numeric",
	}).format(start);
};

const getStatusColor = (status: DeliveryStatus): string => {
	switch (status) {
		case "SENT":
			return "bg-emerald-100 text-emerald-700";
		case "PROCESSING":
			return "bg-blue-100 text-blue-700";
		case "PENDING":
			return "bg-slate-100 text-slate-700";
		case "FAILED":
			return "bg-red-100 text-red-700";
		default:
			return "bg-slate-100 text-slate-700";
	}
};

export function MonthlyReportsPanel() {
	const [activeTab, setActiveTab] = useState<Tab>("schedules");
	const [schedules, setSchedules] = useState<MonthlyReportSchedule[]>([]);
	const [logs, setLogs] = useState<MonthlyReportDeliveryLog[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [showScheduleModal, setShowScheduleModal] = useState(false);
	const [editingSchedule, setEditingSchedule] = useState<MonthlyReportSchedule | null>(null);
	const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(defaultScheduleForm);
	const [runForm, setRunForm] = useState<RunFormState>({
		year: currentYear,
		month: new Date().getMonth() + 1,
		recipientInput: "",
	});
	const [running, setRunning] = useState(false);

	const loadSchedules = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await monthlyReportsService.listSchedules();
			setSchedules(result);
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal memuat jadwal."));
		} finally {
			setLoading(false);
		}
	}, []);

	const loadLogs = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await monthlyReportsService.listDeliveryLogs({ limit: 50 });
			setLogs(result.items);
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal memuat delivery logs."));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (activeTab === "schedules") {
			Promise.resolve().then(loadSchedules);
		}
		if (activeTab === "logs") {
			Promise.resolve().then(loadLogs);
		}
	}, [activeTab, loadLogs, loadSchedules]);

	const selectedReportTypes = useMemo(
		() => new Set(scheduleForm.reportTypes),
		[scheduleForm.reportTypes],
	);

	const handleCreateSchedule = () => {
		setEditingSchedule(null);
		setScheduleForm(defaultScheduleForm());
		setSuccess(null);
		setError(null);
		setShowScheduleModal(true);
	};

	const handleEditSchedule = (schedule: MonthlyReportSchedule) => {
		setEditingSchedule(schedule);
		setScheduleForm({
			name: schedule.name,
			dayOfMonth: getDayFromCron(schedule.cronExpression),
			recipientInput: schedule.recipientEmails.join(", "),
			reportTypes: schedule.reportTypes,
			isActive: schedule.isActive,
		});
		setSuccess(null);
		setError(null);
		setShowScheduleModal(true);
	};

	const buildSchedulePayload = (): CreateSchedulePayload => ({
		name: scheduleForm.name.trim(),
		cronExpression: buildCron(scheduleForm.dayOfMonth),
		timezone: defaultTimezone,
		recipientEmails: parseRecipients(scheduleForm.recipientInput),
		reportTypes: scheduleForm.reportTypes,
		format: "pdf",
		isActive: scheduleForm.isActive,
	});

	const handleSaveSchedule = async () => {
		setError(null);
		setSuccess(null);
		try {
			const payload = buildSchedulePayload();
			if (editingSchedule) {
				await monthlyReportsService.updateSchedule(editingSchedule.id, payload);
				setSuccess("Jadwal berhasil diperbarui.");
			} else {
				await monthlyReportsService.createSchedule(payload);
				setSuccess("Jadwal berhasil dibuat.");
			}
			setShowScheduleModal(false);
			await loadSchedules();
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal menyimpan jadwal."));
		}
	};

	const handleToggleActive = async (schedule: MonthlyReportSchedule) => {
		setError(null);
		setSuccess(null);
		try {
			await monthlyReportsService.updateSchedule(schedule.id, {
				isActive: !schedule.isActive,
			});
			await loadSchedules();
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal mengubah status jadwal."));
		}
	};

	const handleRunReport = async () => {
		setRunning(true);
		setError(null);
		setSuccess(null);
		try {
			const period = getMonthPeriod(runForm.year, runForm.month);
			const recipients = parseRecipients(runForm.recipientInput);
			const result = await monthlyReportsService.runReport({
				...period,
				recipientEmails: recipients.length ? recipients : undefined,
			});
			setSuccess(`Report berhasil dijalankan. Job ID: ${result.jobId}.`);
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal menjalankan report."));
		} finally {
			setRunning(false);
		}
	};

	const handleDownload = async (logId: string) => {
		setError(null);
		try {
			const info = await monthlyReportsService.downloadDeliveryLog(logId);
			window.open(info.url, "_blank", "noopener,noreferrer");
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, "Gagal mengunduh file."));
		}
	};

	const toggleReportType = (type: MonthlyReportType) => {
		setScheduleForm((current) => {
			const next = current.reportTypes.includes(type)
				? current.reportTypes.filter((item) => item !== type)
				: [...current.reportTypes, type];
			return { ...current, reportTypes: next.length ? next : current.reportTypes };
		});
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap gap-2">
				{[
					{ key: "schedules" as Tab, label: "Jadwal" },
					{ key: "run" as Tab, label: "Jalankan Report" },
					{ key: "logs" as Tab, label: "Delivery Logs" },
				].map((tab) => (
					<button
						key={tab.key}
						type="button"
						onClick={() => setActiveTab(tab.key)}
						className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
							activeTab === tab.key
								? "bg-slate-900 text-white"
								: "bg-white text-slate-600 hover:bg-slate-100"
						}`}
					>
						{tab.label}
					</button>
				))}
			</div>

			{error ? (
				<div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
			) : null}
			{success ? (
				<div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			) : null}

			{activeTab === "schedules" ? (
				<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<div className="mb-4 flex items-center justify-between gap-3">
						<h2 className="text-lg font-semibold text-slate-900">Jadwal Laporan</h2>
						<button
							type="button"
							onClick={handleCreateSchedule}
							className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
						>
							+ Buat Jadwal
						</button>
					</div>

					{loading ? (
						<div className="py-8 text-center text-sm text-slate-500">Memuat...</div>
					) : schedules.length === 0 ? (
						<div className="py-8 text-center text-sm text-slate-500">
							Belum ada jadwal laporan.
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-slate-200 text-sm">
								<thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
									<tr>
										<th className="px-4 py-3">Nama</th>
										<th className="px-4 py-3">Tipe</th>
										<th className="px-4 py-3">Jadwal</th>
										<th className="px-4 py-3">Format</th>
										<th className="px-4 py-3">Status</th>
										<th className="px-4 py-3">Aksi</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{schedules.map((schedule) => (
										<tr key={schedule.id}>
											<td className="px-4 py-3 font-medium text-slate-900">{schedule.name}</td>
											<td className="px-4 py-3">
												{schedule.reportTypes
													.map((type) => monthlyReportTypeLabels[type])
													.join(", ")}
											</td>
											<td className="px-4 py-3">
												Tiap tanggal {getDayFromCron(schedule.cronExpression)}, 08:00{" "}
												{schedule.timezone}
											</td>
											<td className="px-4 py-3">{monthlyReportFormatLabels[schedule.format]}</td>
											<td className="px-4 py-3">
												<span
													className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
														schedule.isActive
															? "bg-emerald-100 text-emerald-700"
															: "bg-slate-100 text-slate-600"
													}`}
												>
													{schedule.isActive ? "Aktif" : "Nonaktif"}
												</span>
											</td>
											<td className="px-4 py-3">
												<div className="flex gap-2">
													<button
														type="button"
														onClick={() => handleEditSchedule(schedule)}
														className="text-xs font-medium text-slate-600 hover:text-slate-900"
													>
														Edit
													</button>
													<button
														type="button"
														onClick={() => handleToggleActive(schedule)}
														className="text-xs font-medium text-slate-600 hover:text-slate-900"
													>
														{schedule.isActive ? "Nonaktifkan" : "Aktifkan"}
													</button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>
			) : null}

			{activeTab === "run" ? (
				<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="mb-4 text-lg font-semibold text-slate-900">Jalankan Laporan Manual</h2>
					<div className="grid max-w-xl gap-4">
						<div className="grid grid-cols-2 gap-4">
							<label className="space-y-1 text-sm text-slate-700">
								<span className="font-medium">Tahun</span>
								<select
									value={runForm.year}
									onChange={(event) =>
										setRunForm((current) => ({ ...current, year: Number(event.target.value) }))
									}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								>
									{years.map((year) => (
										<option key={year} value={year}>
											{year}
										</option>
									))}
								</select>
							</label>
							<label className="space-y-1 text-sm text-slate-700">
								<span className="font-medium">Bulan</span>
								<select
									value={runForm.month}
									onChange={(event) =>
										setRunForm((current) => ({ ...current, month: Number(event.target.value) }))
									}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								>
									{months.map((month) => (
										<option key={month.value} value={month.value}>
											{month.label}
										</option>
									))}
								</select>
							</label>
						</div>
						<label className="space-y-1 text-sm text-slate-700">
							<span className="font-medium">Penerima opsional</span>
							<textarea
								value={runForm.recipientInput}
								onChange={(event) =>
									setRunForm((current) => ({ ...current, recipientInput: event.target.value }))
								}
								className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								rows={2}
								placeholder="email1@example.com, email2@example.com"
							/>
						</label>
						<button
							type="button"
							onClick={handleRunReport}
							disabled={running}
							className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
						>
							{running ? "Menjalankan..." : "Jalankan Laporan PDF"}
						</button>
					</div>
				</section>
			) : null}

			{activeTab === "logs" ? (
				<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="mb-4 text-lg font-semibold text-slate-900">Delivery Logs</h2>
					{loading ? (
						<div className="py-8 text-center text-sm text-slate-500">Memuat...</div>
					) : logs.length === 0 ? (
						<div className="py-8 text-center text-sm text-slate-500">
							Belum ada delivery log.
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-slate-200 text-sm">
								<thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
									<tr>
										<th className="px-4 py-3">Bulan</th>
										<th className="px-4 py-3">Status</th>
										<th className="px-4 py-3">Mulai</th>
										<th className="px-4 py-3">Selesai</th>
										<th className="px-4 py-3">Aksi</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{logs.map((log) => (
										<tr key={log.id}>
											<td className="px-4 py-3 font-medium text-slate-900">
												{formatPeriod(log)}
											</td>
											<td className="px-4 py-3">
												<span
													className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(
														log.status,
													)}`}
												>
													{deliveryStatusLabels[log.status]}
												</span>
											</td>
											<td className="px-4 py-3">{formatDateTime(log.createdAt)}</td>
											<td className="px-4 py-3">
												{formatDateTime(log.sentAt ?? log.failedAt)}
											</td>
											<td className="px-4 py-3">
												{log.status === "SENT" ? (
													<button
														type="button"
														onClick={() => handleDownload(log.id)}
														className="text-xs font-medium text-blue-600 hover:text-blue-800"
													>
														Download
													</button>
												) : null}
												{log.status === "FAILED" && log.errorMessage ? (
													<span className="text-xs text-red-600">{log.errorMessage}</span>
												) : null}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>
			) : null}

			{showScheduleModal ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
					<div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
						<h3 className="mb-4 text-lg font-semibold text-slate-900">
							{editingSchedule ? "Edit Jadwal" : "Buat Jadwal Baru"}
						</h3>
						<div className="grid gap-4">
							<label className="space-y-1 text-sm text-slate-700">
								<span className="font-medium">Nama Jadwal</span>
								<input
									type="text"
									value={scheduleForm.name}
									onChange={(event) =>
										setScheduleForm((current) => ({ ...current, name: event.target.value }))
									}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
									placeholder="Contoh: Laporan Operasional Bulanan"
								/>
							</label>
							<label className="space-y-1 text-sm text-slate-700">
								<span className="font-medium">Tanggal Kirim Bulanan</span>
								<input
									type="number"
									min={1}
									max={28}
									value={scheduleForm.dayOfMonth}
									onChange={(event) =>
										setScheduleForm((current) => ({
											...current,
											dayOfMonth: Math.min(28, Math.max(1, Number(event.target.value))),
										}))
									}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								/>
							</label>
							<div className="space-y-2">
								<p className="text-sm font-medium text-slate-700">Tipe Laporan</p>
								<div className="grid gap-2 md:grid-cols-2">
									{monthlyReportTypes.map((type) => (
										<label key={type} className="flex items-center gap-2 text-sm text-slate-700">
											<input
												type="checkbox"
												checked={selectedReportTypes.has(type)}
												onChange={() => toggleReportType(type)}
												className="h-4 w-4 rounded border-slate-300"
											/>
											{monthlyReportTypeLabels[type]}
										</label>
									))}
								</div>
							</div>
							<label className="space-y-1 text-sm text-slate-700">
								<span className="font-medium">Penerima</span>
								<textarea
									value={scheduleForm.recipientInput}
									onChange={(event) =>
										setScheduleForm((current) => ({
											...current,
											recipientInput: event.target.value,
										}))
									}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
									rows={2}
									placeholder="email1@example.com, email2@example.com"
								/>
							</label>
							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									id="monthly-is-active"
									checked={scheduleForm.isActive}
									onChange={(event) =>
										setScheduleForm((current) => ({
											...current,
											isActive: event.target.checked,
										}))
									}
									className="h-4 w-4 rounded border-slate-300"
								/>
								<label htmlFor="monthly-is-active" className="text-sm text-slate-700">
									Jadwal aktif
								</label>
							</div>
							<p className="text-xs text-slate-500">
								Format: PDF. Jadwal: {buildCron(scheduleForm.dayOfMonth)} ({defaultTimezone}).
							</p>
						</div>
						<div className="mt-6 flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setShowScheduleModal(false)}
								className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
							>
								Batal
							</button>
							<button
								type="button"
								onClick={handleSaveSchedule}
								className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
							>
								Simpan
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
