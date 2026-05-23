"use client";

import { useCallback, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import Modal from "@/components/shared/Modal";
import { cropImageFile } from "@/lib/crop-image";

interface AvatarCropModalProps {
	isOpen: boolean;
	file: File | null;
	onClose: () => void;
	onCropped: (file: File) => void;
}

export default function AvatarCropModal({
	isOpen,
	file,
	onClose,
	onCropped,
}: AvatarCropModalProps) {
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
	const [processing, setProcessing] = useState(false);
	const [error, setError] = useState("");
	const imageUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

	const mimeType = useMemo(() => {
		if (!file) return "image/jpeg";
		return file.type === "image/png" || file.type === "image/jpeg" ? file.type : "image/jpeg";
	}, [file]);

	const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
		setCroppedAreaPixels(croppedPixels);
	}, []);

	const handleUsePhoto = async () => {
		if (!file || !imageUrl || !croppedAreaPixels) {
			setError("Gambar belum siap untuk diproses.");
			return;
		}

		setProcessing(true);
		setError("");
		try {
			const croppedFile = await cropImageFile(
				imageUrl,
				croppedAreaPixels,
				{
					outputSize: 512,
					mimeType,
					quality: 0.92,
					fileName: file.name,
				},
			);
			onCropped(croppedFile);
		} catch {
			setError("Gagal memproses crop. Coba pilih foto lain.");
		} finally {
			setProcessing(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Sesuaikan Foto Profil">
			<div className="space-y-4">
				{error ? (
					<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{error}
					</div>
				) : null}

				<div className="relative h-72 w-full overflow-hidden rounded-2xl bg-slate-100">
					{imageUrl ? (
						<Cropper
							image={imageUrl}
							crop={crop}
							zoom={zoom}
							aspect={1}
							cropShape="round"
							showGrid={false}
							onCropChange={setCrop}
							onZoomChange={setZoom}
							onCropComplete={onCropComplete}
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center text-sm text-slate-600">
							Memuat gambar...
						</div>
					)}
				</div>

				<div className="space-y-2">
					<label className="text-xs font-semibold text-slate-600">Zoom</label>
					<input
						type="range"
						min={1}
						max={3}
						step={0.05}
						value={zoom}
						onChange={(event) => setZoom(Number(event.target.value))}
						className="w-full"
					/>
					<p className="text-xs text-slate-500">Geser gambar agar pas di lingkaran.</p>
				</div>

				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						disabled={processing}
						className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
					>
						Batal
					</button>
					<button
						type="button"
						onClick={handleUsePhoto}
						disabled={processing || !croppedAreaPixels}
						className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
					>
						{processing ? "Memproses..." : "Gunakan Foto"}
					</button>
				</div>
			</div>
		</Modal>
	);
}
