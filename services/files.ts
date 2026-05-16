import apiClient from "@/lib/api-client";

interface ApiResponse<T> {
	success: boolean;
	message: string;
	data: T;
}

export interface UploadProductImageResult {
	url: string;
	bucket: string;
	objectKey: string;
	contentType: string;
	sizeBytes: number;
	storageProvider: "seaweedfs" | "local";
	checksum?: string;
}

export const filesService = {
	async uploadProductImage(file: File): Promise<UploadProductImageResult> {
		const formData = new FormData();
		formData.append("image", file);

		const response = await apiClient.post<ApiResponse<UploadProductImageResult>>(
			"/files/product-images",
			formData,
		);
		return response.data.data;
	},
};
