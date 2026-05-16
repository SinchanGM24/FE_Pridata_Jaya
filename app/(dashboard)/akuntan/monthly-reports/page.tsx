"use client";

import { useCallback, useEffect, useState } from "react";
import { FeaturePage } from "@/components/shared/FeaturePage";
import {
	monthlyReportsService,
	type MonthlyReportSchedule,
	type MonthlyReportDeliveryLog,
	type CreateSchedulePayload,
	type MonthlyReportType,
	type MonthlyReportFormat,
	monthlyReportTypeLabels,
	monthlyReportFormatLabels,
	deliveryStatusLabels,
} from "@/services/monthly-reports";

type Tab = "schedules" | "run" | "logs";

const reportTypes: MonthlyReportType[] = ["sales", "orders", "invoices", "payments", "receivables", "stocks", "shipments"];
const formats: MonthlyReportFormat[] = ["pdf", "csv", "xlsx"];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
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

function formatDateTime(dateString: string | null): string {
	if (!dateString) return "-";
	return new Intl.DateTimeFormat("id-ID", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(dateString));
}

function getStatusColor(status: string): string {
	switch (status) {
		case "SUCCESS":
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
}

export default function MonthlyReportsPage() {
	const [activeTab, setActiveTab] = useState<Tab>("schedules");
	const [schedules, setSchedules] = useState<MonthlyReportSchedule[]>([]);
	const [logs, setLogs] = useState<MonthlyReportDeliveryLog[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// Schedule form state
	const [showScheduleModal, setShowScheduleModal] = useState(false);
	const [editingSchedule, setEditingSchedule] = useState<MonthlyReportSchedule | null>(null);
	const [scheduleForm, setScheduleForm] = useState<CreateSchedulePayload>({
		name: "",
		reportType: "sales",
		dayOfMonth: 1,
		format: "pdf",
		recipients: [],
		isActive: true,
	});
	const [recipientInput, setRecipientInput] = useState("");

	// Run report form state
	const [runForm, setRunForm] = useState({
		reportType: "sales" as MonthlyReportType,
		year: currentYear,
		month: new Date().getMonth() + 1,
		format: "pdf" as MonthlyReportFormat,
	});
	const [running, setRunning] = useState(false);

	const loadSchedules = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await monthlyReportsService.listSchedules();
			setSchedules(result.items ?? []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Gagal memuat jadwal");
		} finally {
			setLoading(false);
		}
	}, []);

	const loadLogs = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await monthlyReportsService.listDeliveryLogs({ limit: 50 });
			setLogs(result.items ?? []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Gagal memuat log");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (activeTab === "schedules") {
			Promise.resolve().then(loadSchedules);
		} else if (activeTab === "logs") {
			Promise.resolve().then(loadLogs);
		}
	}, [activeTab, loadSchedules, loadLogs]);

	const handleCreateSchedule = () => {
		setEditingSchedule(null);
		setScheduleForm({
			name: "",
			reportType: "sales",
			dayOfMonth: 1,
			format: "pdf",
			recipients: [],
			isActive: true,
		});
		setRecipientInput("");
		setShowScheduleModal(true);
	};

	const handleEditSchedule = (schedule: MonthlyReportSchedule) => {
		setEditingSchedule(schedule);
		setScheduleForm({
			name: schedule.name,
			reportType: schedule.reportType,
			dayOfMonth: schedule.dayOfMonth,
			format: schedule.format,
			recipients: schedule.recipients,
			isActive: schedule.isActive,
		});
		setRecipientInput(schedule.recipients.join(", "));
		setShowScheduleModal(true);
	};

	const handleSaveSchedule = async () => {
		setError(null);
		setSuccess(null);
		try {
			if (editingSchedule) {
				await monthlyReportsService.updateSchedule(editingSchedule.id, scheduleForm);
				setSuccess("Jadwal berhasil diperbarui");
			} else {
				await monthlyReportsService.createSchedule(scheduleForm);
				setSuccess("Jadwal berhasil dibuat");
			}
			setShowScheduleModal(false);
			await loadSchedules();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Gagal menyimpan jadwal");
		}
	};

	const handleToggleActive = async (schedule: MonthlyReportSchedule) => {
		try {
			await monthlyReportsService.updateSchedule(schedule.id, { isActive: !schedule.isActive });
			await loadSchedules();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Gagal mengubah status");
		}
	};

	const handleRunReport = async () => {
		setRunning(true);
		setError(null);
		setSuccess(null);
		try {
			const result = await monthlyReportsService.runReport(runForm);
			setSuccess(`Report berhasil dijalankan. Job ID: ${result.jobId}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Gagal menjalankan report");
		} finally {
			setRunning(false);
		}
	};

	const handleDownload = async (logId: string) => {
		try {
			const url = await monthlyReportsService.downloadDeliveryLog(logId);
			const link = document.createElement("a");
			link.href = url;
			link.download = `monthly-report-${logId}`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Gagal mengunduh file");
		}
	};

	const parseRecipients = (input: string): string[] => {
		return input
			.split(/[,\n]/)
			.map((email) => email.trim())
			.filter((email) => email.includes("@"));
	};

	return (
		<FeaturePage title="Laporan Bulanan" description="Kelola jadwal laporan bulanan dan delivery logs.">
			{/* Tabs */}
			<div className="mb-6 flex gap-2">
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

			{/* Error/Success Messages */}
			{error && (
				<div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
			)}
			{success && (
				<div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{success}
				</div>
			)}

			{/* Schedules Tab */}
			{activeTab === "schedules" && (
				<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<div className="mb-4 flex items-center justify-between">
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
										<th className="px-4 py-3">Hari</th>
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
												{monthlyReportTypeLabels[schedule.reportType]}
											</td>
											<td className="px-4 py-3">Tiap tanggal {schedule.dayOfMonth}</td>
											<td className="px-4 py-3">
												{monthlyReportFormatLabels[schedule.format]}
											</td>
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
			)}

			{/* Run Report Tab */}
			{activeTab === "run" && (
				<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="mb-4 text-lg font-semibold text-slate-900">Jalankan Laporan Manual</h2>

					<div className="grid max-w-md gap-4">
						<div>
							<label className="mb-1 block text-sm font-medium text-slate-700">
								Tipe Laporan
							</label>
							<select
								value={runForm.reportType}
								onChange={(e) =>
									setRunForm((f) => ({ ...f, reportType: e.target.value as MonthlyReportType }))
								}
								className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							>
								{reportTypes.map((type) => (
									<option key={type} value={type}>
										{monthlyReportTypeLabels[type]}
									</option>
								))}
							</select>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="mb-1 block text-sm font-medium text-slate-700">Tahun</label>
								<select
									value={runForm.year}
									onChange={(e) => setRunForm((f) => ({ ...f, year: Number(e.target.value) }))}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								>
									{years.map((year) => (
										<option key={year} value={year}>
											{year}
										</option>
									))}
								</select>
							</div>
							<div>
								<label className="mb-1 block text-sm font-medium text-slate-700">Bulan</label>
								<select
									value={runForm.month}
									onChange={(e) => setRunForm((f) => ({ ...f, month: Number(e.target.value) }))}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								>
									{months.map((m) => (
										<option key={m.value} value={m.value}>
											{m.label}
										</option>
									))}
								</select>
							</div>
						</div>

						<div>
							<label className="mb-1 block text-sm font-medium text-slate-700">Format</label>
							<select
								value={runForm.format}
								onChange={(e) =>
									setRunForm((f) => ({ ...f, format: e.target.value as MonthlyReportFormat }))
								}
								className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							>
								{formats.map((format) => (
									<option key={format} value={format}>
										{monthlyReportFormatLabels[format]}
									</option>
								))}
							</select>
						</div>

						<button
							type="button"
							onClick={handleRunReport}
							disabled={running}
							className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
						>
							{running ? "Menjalankan..." : "Jalankan Laporan"}
						</button>
					</div>
				</section>
			)}

			{/* Delivery Logs Tab */}
			{activeTab === "logs" && (
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
												{log.reportMonth}
											</td>
											<td className="px-4 py-3">
												<span
													className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(
														log.status
													)}`}
												>
													{deliveryStatusLabels[log.status]}
												</span>
											</td>
											<td className="px-4 py-3">{formatDateTime(log.startedAt)}</td>
											<td className="px-4 py-3">{formatDateTime(log.completedAt)}</td>
											<td className="px-4 py-3">
												{log.status === "SUCCESS" && (
													<button
														type="button"
														onClick={() => handleDownload(log.id)}
														className="text-xs font-medium text-blue-600 hover:text-blue-800"
													>
														Download
													</button>
												)}
												{log.status === "FAILED" && log.errorMessage && (
													<span className="text-xs text-red-600">{log.errorMessage}</span>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>
			)}

			{/* Schedule Modal */}
			{showScheduleModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
					<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
						<h3 className="mb-4 text-lg font-semibold text-slate-900">
							{editingSchedule ? "Edit Jadwal" : "Buat Jadwal Baru"}
						</h3>

						<div className="grid gap-4">
							<div>
								<label className="mb-1 block text-sm font-medium text-slate-700">
									Nama Jadwal
								</label>
								<input
									type="text"
									value={scheduleForm.name}
									onChange={(e) =>
										setScheduleForm((f) => ({ ...f, name: e.target.value }))
									}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
									placeholder="Contoh: Laporan Penjualan Bulanan"
								/>
							</div>

							<div>
								<label className="mb-1 block text-sm font-medium text-slate-700">
									Tipe Laporan
								</label>
								<select
									value={scheduleForm.reportType}
									onChange={(e) =>
										setScheduleForm((f) => ({
											...f,
											reportType: e.target.value as MonthlyReportType,
										}))
									}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								>
									{reportTypes.map((type) => (
										<option key={type} value={type}>
											{monthlyReportTypeLabels[type]}
										</option>
									))}
								</select>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="mb-1 block text-sm font-medium text-slate-700">
										Hari ke-
									</label>
									<input
										type="number"
										min={1}
										max={28}
										value={scheduleForm.dayOfMonth}
										onChange={(e) =>
											setScheduleForm((f) => ({
												...f,
												dayOfMonth: Math.min(28, Math.max(1, Number(e.target.value))),
											}))
										}
										className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
									/>
								</div>
								<div>
									<label className="mb-1 block text-sm font-medium text-slate-700">
										Format
									</label>
									<select
										value={scheduleForm.format}
										onChange={(e) =>
											setScheduleForm((f) => ({
												...f,
												format: e.target.value as MonthlyReportFormat,
											}))
										}
										className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
									>
										{formats.map((format) => (
											<option key={format} value={format}>
												{monthlyReportFormatLabels[format]}
											</option>
										))}
									</select>
								</div>
							</div>

							<div>
								<label className="mb-1 block text-sm font-medium text-slate-700">
									Penerima (email, pisahkan dengan koma)
								</label>
								<textarea
									value={recipientInput}
									onChange={(e) => {
										setRecipientInput(e.target.value);
										setScheduleForm((f) => ({
											...f,
											recipients: parseRecipients(e.target.value),
										}));
									}}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
									rows={2}
									placeholder="email1@example.com, email2@example.com"
								/>
							</div>

							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									id="isActive"
									checked={scheduleForm.isActive}
									onChange={(e) =>
										setScheduleForm((f) => ({ ...f, isActive: e.target.checked }))
									}
									className="h-4 w-4 rounded border-slate-300"
								/>
								<label htmlFor="isActive" className="text-sm text-slate-700">
									Jadwal aktif
								</label>
							</div>
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
			)}
		</FeaturePage>
	);
}
