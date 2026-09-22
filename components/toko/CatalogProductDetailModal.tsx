"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Modal from "@/components/shared/Modal";
import type { CatalogProduct } from "@/services/catalog-products";
import { getProductPrice } from "@/services/toko-cart";

interface CatalogProductDetailModalProps {
	product: CatalogProduct | null;
	quantity: number;
	onQuantityChange: (value: number) => void;
	onAddToCart: (product: CatalogProduct) => void;
	addActionLabel?: string;
	showPurchaseControls?: boolean;
	onClose: () => void;
}

const formatRupiah = (value: number) =>
	new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 0,
	}).format(value);

const getCategoryLabel = (product: CatalogProduct) =>
	product.product.category?.name ||
	product.product.brand?.name ||
	product.division?.name ||
	product.product.division?.name ||
	"Produk";

const getDescription = (product: CatalogProduct) =>
	product.description?.trim() ||
	product.product.productDetail?.description?.trim() ||
	"Belum ada deskripsi produk.";

const getProductImages = (product: CatalogProduct | null) => {
	if (!product) return [];

	return [...(product.imageList || []), ...(product.product.productDetail?.imageList || [])]
		.map((item) => item.trim())
		.filter((item, index, source) => Boolean(item) && source.indexOf(item) === index);
};

export default function CatalogProductDetailModal({
	product,
	quantity,
	onQuantityChange,
	onAddToCart,
	addActionLabel = "Tambah ke Keranjang",
	showPurchaseControls = true,
	onClose,
}: CatalogProductDetailModalProps) {
	const [selectedImage, setSelectedImage] = useState({ productId: "", index: 0 });
	const [lightboxOpen, setLightboxOpen] = useState(false);
	const images = useMemo(() => getProductImages(product), [product]);
	const imageIndex =
		product?.id === selectedImage.productId
			? Math.min(selectedImage.index, Math.max(0, images.length - 1))
			: 0;
	const image = images[imageIndex] ?? "";
	const hasMultipleImages = images.length > 1;

	useEffect(() => {
		if (!lightboxOpen) return;

		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setLightboxOpen(false);
		};

		window.addEventListener("keydown", closeOnEscape);
		return () => window.removeEventListener("keydown", closeOnEscape);
	}, [lightboxOpen]);

	if (!product) return null;

	const price = getProductPrice(product);
	const stock = product.product.stockQuantity ?? 0;
	const maxQuantity = Math.max(1, stock);
	const showPreviousImage = () => {
		if (!hasMultipleImages) return;
		setSelectedImage({
			productId: product.id,
			index: imageIndex === 0 ? images.length - 1 : imageIndex - 1,
		});
	};
	const showNextImage = () => {
		if (!hasMultipleImages) return;
		setSelectedImage({
			productId: product.id,
			index: (imageIndex + 1) % images.length,
		});
	};

	return (
		<>
			<Modal
				isOpen={Boolean(product)}
				onClose={onClose}
				title="Detail Produk"
				maxWidthClassName="max-w-4xl"
			>
				<div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
					<div className="space-y-3">
						<div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
							<button
								type="button"
								onClick={() => {
									if (image) setLightboxOpen(true);
								}}
								disabled={!image}
								className="block w-full disabled:cursor-default"
								aria-label="Lihat gambar penuh"
							>
								{image ? (
									<Image
										src={image}
										alt={product.marketingName}
										width={720}
										height={520}
										className="h-72 w-full object-cover"
										unoptimized
									/>
								) : (
									<div className="flex h-72 items-center justify-center text-sm font-medium text-slate-400">
										Belum ada gambar
									</div>
								)}
							</button>
							{hasMultipleImages ? (
								<>
									<button
										type="button"
										onClick={showPreviousImage}
										className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-white"
										aria-label="Lihat gambar sebelumnya"
									>
										<ChevronLeft className="h-5 w-5" />
									</button>
									<button
										type="button"
										onClick={showNextImage}
										className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-white"
										aria-label="Lihat gambar berikutnya"
									>
										<ChevronRight className="h-5 w-5" />
									</button>
									<div className="absolute bottom-3 right-3 rounded-full bg-indigo-700/75 px-2.5 py-1 text-xs font-semibold text-white">
										{imageIndex + 1}/{images.length}
									</div>
								</>
							) : null}
						</div>
						{hasMultipleImages ? (
							<div className="flex gap-2 overflow-x-auto pb-1">
								{images.map((url, index) => (
									<button
										key={`${url}-${index}`}
										type="button"
										onClick={() => setSelectedImage({ productId: product.id, index })}
										className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-slate-100 transition ${
											index === imageIndex
												? "border-rose-500 ring-2 ring-rose-100"
												: "border-slate-200 hover:border-slate-400"
										}`}
										aria-label={`Lihat gambar ${index + 1}`}
									>
										<Image
											src={url}
											alt={`${product.marketingName} ${index + 1}`}
											width={96}
											height={96}
											className="h-full w-full object-cover"
											unoptimized
										/>
									</button>
								))}
							</div>
						) : null}
					</div>

					<div className="space-y-4">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
								{getCategoryLabel(product)}
							</p>
							<h2 className="mt-1 text-2xl font-semibold leading-tight text-slate-950">
								{product.marketingName}
							</h2>
							<p className="mt-2 text-xl font-bold text-rose-600">
								{price > 0 ? formatRupiah(price) : "Belum ada harga"}
							</p>
						</div>

						<div className="grid grid-cols-2 gap-3 text-sm">
							<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
								<p className="text-xs text-slate-500">Stok tersedia</p>
								<p className="mt-1 font-semibold text-slate-900">{stock}</p>
							</div>
							<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
								<p className="text-xs text-slate-500">Item gudang</p>
								<p className="mt-1 line-clamp-1 font-semibold text-slate-900">
									{product.product.name}
								</p>
							</div>
						</div>

						<div>
							<p className="text-sm font-semibold text-slate-900">Deskripsi Produk</p>
							<p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
								{getDescription(product)}
							</p>
						</div>

						{showPurchaseControls ? (
							<div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row">
								<input
									type="number"
									min={1}
									max={maxQuantity}
									value={quantity}
									onChange={(event) =>
										onQuantityChange(Math.min(maxQuantity, Math.max(1, Number(event.target.value || 1))))
									}
									className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm sm:w-28"
								/>
								<button
									type="button"
									onClick={() => onAddToCart(product)}
									className="h-11 flex-1 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
									disabled={price <= 0 || stock <= 0}
								>
									{addActionLabel}
								</button>
							</div>
						) : (
							<p className="border-t border-slate-200 pt-4 text-sm text-slate-500">
								Atur jumlah pesanan dari tabel Mode List.
							</p>
						)}
					</div>
				</div>
			</Modal>

			{lightboxOpen && image ? (
				<div
					className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-slate-950/95 p-4 backdrop-blur-md sm:p-6"
					onClick={() => setLightboxOpen(false)}
					role="dialog"
					aria-modal="true"
					aria-label={`Pratinjau gambar ${product.marketingName}`}
				>
					<div
						className="pointer-events-none absolute -inset-12 scale-110 bg-cover bg-center opacity-25 blur-3xl"
						style={{ backgroundImage: `url("${image}")` }}
					/>
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.42)_68%,rgba(2,6,23,0.9)_100%)]" />
					<div className="absolute left-4 top-4 z-10 flex min-w-0 max-w-[calc(100%-5.5rem)] items-center gap-3 text-white sm:left-6 sm:top-6">
						<div className="hidden h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-white/10 sm:block">
							<Image
								src={image}
								alt=""
								width={88}
								height={88}
								className="h-full w-full object-cover"
								unoptimized
							/>
						</div>
						<div className="min-w-0">
							<p className="truncate text-xs font-medium text-slate-300">Pratinjau produk</p>
							<p className="truncate text-sm font-semibold sm:text-base">{product.marketingName}</p>
						</div>
					</div>
					<button
						type="button"
						onClick={(event) => {
							event.stopPropagation();
							setLightboxOpen(false);
						}}
						className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-slate-900/60 text-white shadow-lg shadow-slate-950/30 backdrop-blur transition hover:scale-105 hover:bg-white hover:text-slate-950 sm:right-6 sm:top-6"
						aria-label="Tutup gambar penuh"
					>
						<X className="h-5 w-5" />
					</button>
					{hasMultipleImages ? (
						<>
							<button
								type="button"
								onClick={(event) => {
									event.stopPropagation();
									showPreviousImage();
								}}
								className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-slate-900/60 text-white shadow-lg shadow-slate-950/30 backdrop-blur transition hover:scale-105 hover:bg-white hover:text-slate-950 sm:left-6 sm:h-12 sm:w-12"
								aria-label="Lihat gambar sebelumnya"
							>
								<ChevronLeft className="h-6 w-6" />
							</button>
							<button
								type="button"
								onClick={(event) => {
									event.stopPropagation();
									showNextImage();
								}}
								className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-slate-900/60 text-white shadow-lg shadow-slate-950/30 backdrop-blur transition hover:scale-105 hover:bg-white hover:text-slate-950 sm:right-6 sm:h-12 sm:w-12"
								aria-label="Lihat gambar berikutnya"
							>
								<ChevronRight className="h-6 w-6" />
							</button>
							<div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/15 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-slate-950/30 backdrop-blur sm:text-sm">
								Foto {imageIndex + 1} dari {images.length}
							</div>
						</>
					) : null}
					<div
						className="relative z-[1] flex h-full w-full items-center justify-center py-14 sm:py-16"
						onClick={(event) => event.stopPropagation()}
					>
						<Image
							src={image}
							alt={product.marketingName}
							width={1440}
							height={1080}
							className="max-h-full max-w-full rounded-lg object-contain shadow-2xl shadow-black/50"
							unoptimized
						/>
					</div>
				</div>
			) : null}
		</>
	);
}
