import apiClient from "@/lib/api-client";
import type { UserRole } from "@/types";

export interface OrganizationMember {
	id: string;
	userId: string;
	email: string;
	name: string;
	role: UserRole;
	createdAt: string;
}

export interface InviteMemberPayload {
	email: string;
	role: UserRole;
}

export interface UpdateMemberRolePayload {
	role: UserRole;
}

interface ApiSuccessResponse<T> {
	message?: string;
	data: T;
}

interface MemberListResponse {
	items: OrganizationMember[];
	members?: OrganizationMember[];
}

const normalizeMembers = (
	payload: OrganizationMember[] | MemberListResponse | null | undefined,
): OrganizationMember[] => {
	if (Array.isArray(payload)) return payload;
	return payload?.items ?? payload?.members ?? [];
};

export const membersService = {
	async list(): Promise<{ items: OrganizationMember[] }> {
		const response = await apiClient.get<ApiSuccessResponse<OrganizationMember[] | MemberListResponse>>("/members");
		return { items: normalizeMembers(response.data.data) };
	},

	async invite(payload: InviteMemberPayload): Promise<void> {
		await apiClient.post("/members/invite", payload);
	},

	async updateRole(memberId: string, role: UserRole): Promise<OrganizationMember> {
		const payload: UpdateMemberRolePayload = { role };
		const response = await apiClient.patch<ApiSuccessResponse<OrganizationMember>>(
			`/members/${memberId}/role`,
			payload,
		);
		return response.data.data;
	},

	async remove(memberId: string): Promise<void> {
		await apiClient.delete(`/members/${memberId}`);
	},
};
