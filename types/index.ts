export type UserRole =
	| "superowner"
	| "owner"
	| "admin"
	| "user"
	| "fakturis"
	| "invoicist"
	| "gudang"
	| "warehouse_staff"
	| "akuntan"
	| "accountant"
	| "sales"
	| "toko"
	| "store_customer";

export type DashboardRole =
	| "superowner"
	| "owner"
	| "admin"
	| "fakturis"
	| "gudang"
	| "akuntan"
	| "sales"
	| "toko";

export interface User {
	id: string;
	email: string;
	name: string;
	role: UserRole;
	image?: string;
	emailVerified: boolean;
	activeOrganizationId?: string | null;
	organizationRole?: UserRole | null;
	banned?: boolean;
	banReason?: string | null;
	storeName?: string | null;
	storeVerificationStatus?: string | null;
	profile?: UserProfile | null;
}

export interface UserProfile {
	id?: string;
	userId?: string;
	identityNumber?: string | null;
	birthDate?: string | null;
	gender?: string | null;
	phoneNumber?: string | null;
	address?: string | null;
	city?: string | null;
	province?: string | null;
	postalCode?: string | null;
	joinDate?: string | null;
	createdAt?: string;
	updatedAt?: string;
}

export interface Session {
	user: User;
	token?: string;
	id?: string;
	expiresAt?: string;
	activeOrganizationId?: string | null;
}

export interface AuthResponse {
	user: User;
	session: Session;
}

export interface ApiResponse<T> {
	success: boolean;
	message: string;
	data: T;
	meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
	data: T[];
	page: number;
	limit: number;
	totalItems: number;
	totalPages: number;
}
