"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Modal from "@/components/shared/Modal";
import QuantityStepper from "@/components/shared/QuantityStepper";
import { formatRupiah } from "@/lib/format";
import type { CatalogProduct } from "@/services/catalog-products";
import { getProductPrice } from "@/services/toko-cart";

interface CatalogProductDetailModalProps {
	product: CatalogProduct | null;
	quantity: number;
	onQuantityChange: (value: number) => void;
	onAddToCart: (product: CatalogProduct) => void;
	onClose: () => void;
}

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
				footer={
					<div className="flex items-center gap-3">
						<QuantityStepper
							value={quantity}
							max={maxQuantity}
							onChange={(next) => onQuantityChange(next)}
						/>
						<Button
							variant="commerce"
							onClick={() => onAddToCart(product)}
							disabled={price <= 0 || stock <= 0}
							className="flex-1"
						>
							{stock <= 0 ? "Stok habis" : price <= 0 ? "Belum ada harga" : "Tambah ke Keranjang"}
						</Button>
					</div>
				}
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
									<div className="absolute bottom-3 right-3 rounded-full bg-slate-900/75 px-2.5 py-1 text-xs font-semibold text-white">
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
							<p className="type-label text-slate-500">
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
								<p className="mt-1">
									<Badge tone={stock > 0 ? "success" : "danger"}>
										{stock > 0 ? `${stock} unit` : "Stok habis"}
									</Badge>
								</p>
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

					</div>
				</div>
			</Modal>

			{lightboxOpen && image ? (
				<div
					className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4"
					onClick={() => setLightboxOpen(false)}
				>
					<button
						type="button"
						onClick={() => setLightboxOpen(false)}
						className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition hover:bg-white/20"
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
								className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition hover:bg-white/20"
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
								className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition hover:bg-white/20"
								aria-label="Lihat gambar berikutnya"
							>
								<ChevronRight className="h-6 w-6" />
							</button>
							<div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/20">
								{imageIndex + 1}/{images.length}
							</div>
						</>
					) : null}
					<div
						className="flex h-full w-full items-center justify-center"
						onClick={(event) => event.stopPropagation()}
					>
						<Image
							src={image}
							alt={product.marketingName}
							width={1440}
							height={1080}
							className="max-h-full max-w-full object-contain"
							unoptimized
						/>
					</div>
				</div>
			) : null}
		</>
	);
}
