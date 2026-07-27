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
	storageProvider: "seaweedfs" | "local" | "minio";
	checksum?: string;
}

export interface PresignedUploadParams {
	purpose: "payment-proof" | "business-license" | "product-image" | "profile-image";
	filename: string;
	contentType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
}

export interface PresignedUploadResult {
	uploadUrl: string;
	objectKey: string;
	publicUrl: string;
	expiresInSeconds: number;
}

export const filesService = {
	async createPresignedUpload(params: PresignedUploadParams): Promise<PresignedUploadResult> {
		const response = await apiClient.post<ApiResponse<PresignedUploadResult>>(
			"/files/presigned-upload",
			params,
		);
		return response.data.data;
	},

	async uploadProductImage(file: File): Promise<UploadProductImageResult> {
		const formData = new FormData();
		formData.append("image", file);

		const response = await apiClient.post<ApiResponse<UploadProductImageResult>>(
			"/files/product-images",
			formData,
		);
		return response.data.data;
	},

	async uploadProfileImage(file: File): Promise<UploadProductImageResult> {
		const formData = new FormData();
		formData.append("image", file);

		const response = await apiClient.post<ApiResponse<UploadProductImageResult>>(
			"/files/profile-images",
			formData,
		);
		return response.data.data;
	},

	async uploadPaymentProof(file: File): Promise<UploadProductImageResult> {
		const formData = new FormData();
		formData.append("proof", file);

		const response = await apiClient.post<ApiResponse<UploadProductImageResult>>(
			"/files/payment-proofs",
			formData,
		);
		return response.data.data;
	},
};
