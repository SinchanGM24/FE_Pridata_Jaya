export type UserRole =
	| "owner"
	| "admin"
	| "user"
	| "invoicist"
	| "warehouse_staff"
	| "accountant"
	| "sales"
	| "store_customer";

export type DashboardRole =
	| "superowner"
	| "owner"
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
