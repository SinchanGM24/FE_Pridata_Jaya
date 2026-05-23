export interface CropArea {
	x: number;
	y: number;
	width: number;
	height: number;
}

export const cropImageFile = async (
	imageUrl: string,
	area: CropArea,
	options?: {
		outputSize?: number;
		mimeType?: string;
		quality?: number;
		fileName?: string;
	},
): Promise<File> => {
	const image = await loadImage(imageUrl);
	const outputSize = options?.outputSize ?? 512;
	const mimeType = options?.mimeType ?? "image/jpeg";
	const quality = options?.quality ?? 0.92;

	const canvas = document.createElement("canvas");
	canvas.width = outputSize;
	canvas.height = outputSize;

	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Canvas context is not available");
	}

	context.drawImage(
		image,
		area.x,
		area.y,
		area.width,
		area.height,
		0,
		0,
		outputSize,
		outputSize,
	);

	const blob = await new Promise<Blob | null>((resolve) => {
		canvas.toBlob((result) => resolve(result), mimeType, quality);
	});

	if (!blob) {
		throw new Error("Failed to create cropped image blob");
	}

	const extension = mimeType === "image/png" ? "png" : "jpg";
	const baseName = (options?.fileName || "avatar").replace(/\.[^.]+$/, "");
	return new File([blob], `${baseName}.${extension}`, { type: mimeType });
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
	new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error("Failed to load image"));
		image.src = src;
	});
