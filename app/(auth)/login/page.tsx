"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, AlertCircle } from "lucide-react";
import { authService } from "@/services/auth";
import { BrandIdentity } from "@/components/layout/BrandIdentity";

const getErrorMessage = (error: unknown) => {
	if (!error || typeof error !== "object") {
		return "Login gagal. Silakan coba lagi.";
	}

	const responseMessage = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
	if (typeof responseMessage === "string" && responseMessage.trim()) {
		return responseMessage;
	}

	const message = (error as { message?: string }).message;
	return typeof message === "string" && message.trim()
		? message
		: "Login gagal. Silakan coba lagi.";
};

export default function LoginPage() {
	const router = useRouter();
	const [form, setForm] = useState({
		username: "",
		password: "",
	});
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setIsLoading(true);

		try {
			const response = await authService.login(form);
			router.push(authService.getHomeRoute(response.user));
		} catch (err: unknown) {
			setError(getErrorMessage(err));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
			<div className="w-full max-w-md">
				<div className="bg-white rounded-2xl shadow-xl p-8">
					<div className="mb-7 flex justify-center">
						<BrandIdentity variant="sidebar" />
					</div>

					{error && (
						<div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
							<AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
							<p className="text-sm text-red-700">{error}</p>
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-5">
						<div>
							<label
								htmlFor="username"
								className="block text-sm font-medium text-gray-700 mb-2"
							>
								Email / Username
							</label>
							<div className="relative">
								<Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
								<input
									id="username"
									type="text"
									value={form.username}
									onChange={(e) =>
										setForm((prev) => ({ ...prev, username: e.target.value }))
									}
									placeholder="Masukkan email akun"
									required
									className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								/>
							</div>
						</div>

						<div>
							<label
								htmlFor="password"
								className="block text-sm font-medium text-gray-700 mb-2"
							>
								Password
							</label>
							<div className="relative">
								<Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
								<input
									id="password"
									type="password"
									value={form.password}
									onChange={(e) =>
										setForm((prev) => ({ ...prev, password: e.target.value }))
									}
									placeholder="********"
									required
									className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								/>
							</div>
						</div>

						<button
							type="submit"
							disabled={isLoading}
							className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition-colors"
						>
							{isLoading ? "Memproses..." : "Masuk"}
						</button>
					</form>
				</div>

				<p className="text-center text-sm text-gray-600 mt-6">
					© 2026 CV. Pridata Jaya. All rights reserved.
				</p>
			</div>
		</div>
	);
}
