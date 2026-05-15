"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useRealtime } from "@/providers/RealtimeProvider";
import { resolveNotificationRoute } from "@/lib/notifications/route-resolver";
import type { Notification } from "@/types/notification";

/**
 * NotificationToastHost — listens to SSE and renders a 4s toast on every
 * `notification.created` event.
 *
 * Lives outside the bell component so toast triggers even when the
 * dropdown is closed and even if the user is on a page where the bell
 * is hidden by role.
 *
 * Click action label "Buka" routes to the entity (same resolver as the
 * dropdown click handler).
 */
const TOAST_DURATION_MS = 4_000;

export function NotificationToastHost() {
	const { subscribe } = useRealtime();
	const router = useRouter();

	useEffect(() => {
		const unsub = subscribe((event) => {
			if (
				event.event !== "notification.created" &&
				event.event !== "message"
			) {
				return;
			}

			// SSE payload may be the notification itself, or a wrapper
			// `{ notification: ... }`. Accept both.
			const data = event.data as Partial<Notification> & {
				notification?: Partial<Notification>;
			};
			const n: Partial<Notification> = data.notification ?? data;

			if (!n?.title) return;

			toast(n.title, {
				description: n.message ?? undefined,
				duration: TOAST_DURATION_MS,
				action: {
					label: "Buka",
					onClick: () => {
						const url = resolveNotificationRoute(
							(n.entityType ?? null) as Notification["entityType"],
							(n.entityId ?? null) as string | null
						);
						if (url) router.push(url);
					},
				},
			});
		});
		return unsub;
	}, [subscribe, router]);

	return null;
}
