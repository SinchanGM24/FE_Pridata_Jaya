"use client";

import { useCallback, useState } from "react";

/**
 * One Idempotency-Key per submit intent. It survives failed attempts, retries
 * and a closed-then-reopened dialog, so a resubmit after a timeout cannot
 * create a second record; call `reset` only once the submit succeeded.
 */
export function useIdempotencyKey() {
	const [key, setKey] = useState(() => crypto.randomUUID());
	const reset = useCallback(() => setKey(crypto.randomUUID()), []);
	return { key, reset };
}
