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

export interface OrganizationInvitation {
	id: string;
	email: string;
	role: UserRole;
	status: string;
	createdAt: string;
	expiresAt: string;
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
}

interface InvitationListResponse {
	items: OrganizationInvitation[];
}

export const membersService = {
	async list(): Promise<{ items: OrganizationMember[] }> {
		const response = await apiClient.get<ApiSuccessResponse<MemberListResponse>>("/members");
		return response.data.data;
	},

	async listInvitations(): Promise<{ items: OrganizationInvitation[] }> {
		const response = await apiClient.get<ApiSuccessResponse<InvitationListResponse>>("/members/invitations");
		return response.data.data;
	},

	async invite(payload: InviteMemberPayload): Promise<OrganizationInvitation> {
		const response = await apiClient.post<ApiSuccessResponse<OrganizationInvitation>>("/members/invite", payload);
		return response.data.data;
	},

	async cancelInvitation(invitationId: string): Promise<void> {
		await apiClient.delete("/members/invitations", {
			params: { id: invitationId },
		});
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
