// Shared utility functions for error handling and resilience.

/**
 * Retry an operation (sync or async) with exponential backoff.
 * @param operation The function to retry (can return T or Promise<T>)
 * @param maxRetries Maximum number of retry attempts (default 2)
 * @param baseDelayMs Initial delay in ms (doubles each retry)
 * @returns The result of the operation
 * @throws The last error if all retries fail
 */
export async function retry<T>(
	operation: () => T | Promise<T>,
	maxRetries: number = 2,
	baseDelayMs: number = 50,
): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const result = operation();
			// If it's a Promise, await it; otherwise return directly
			if (result instanceof Promise) {
				return await result;
			}
			return result;
		} catch (err) {
			lastError = err;
			if (attempt < maxRetries) {
				const delay = baseDelayMs * Math.pow(2, attempt);
				await new Promise((r) => setTimeout(r, delay));
			}
		}
	}
	throw lastError;
}

/**
 * Read a file synchronously with retry for transient I/O errors.
 * Returns null if the file doesn't exist or all retries fail.
 */
export function readFileWithRetry(filePath: string, maxRetries: number = 2, baseDelayMs: number = 30): string | null {
	const fs = require("node:fs") as typeof import("node:fs");
	let lastError: unknown;
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return fs.readFileSync(filePath, "utf8");
		} catch (err) {
			lastError = err;
			// Don't retry on non-transient errors
			if (!isTransientIoError(err)) {
				return null;
			}
			if (attempt < maxRetries) {
				const delay = baseDelayMs * Math.pow(2, attempt);
				// Sync sleep via Atomics (works in Node.js)
				const sab = new SharedArrayBuffer(4);
				const view = new Int32Array(sab);
				Atomics.wait(view, 0, 0, delay);
			}
		}
	}
	if (isTransientIoError(lastError)) {
		console.error(`[pi-test-oracle] Failed to read ${filePath} after retries: ${(lastError as Error).message}`);
	}
	return null;
}

/**
 * Determine if an error is a transient I/O error worth retrying.
 * Filters out logic errors (TypeError, etc.) that retrying won't fix.
 */
export function isTransientIoError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	const code = (err as NodeJS.ErrnoException).code;
	// Transient: EBUSY, EAGAIN, ETIMEDOUT, ENETUNREACH, ECONNRESET
	// Non-transient: ENOENT (file not found), EACCES (permission), etc.
	return code === "EBUSY" || code === "EAGAIN" || code === "ETIMEDOUT" || code === "ENETUNREACH" || code === "ECONNRESET";
}

/**
 * Read a file with a size limit. Returns null if the file exceeds the limit.
 */
export function readFileWithLimit(filePath: string, maxBytes: number = 1_048_576): string | null {
	const fs = require("node:fs") as typeof import("node:fs");
	try {
		const stat = fs.statSync(filePath);
		if (stat.size > maxBytes) {
			console.warn(`[pi-test-oracle] File ${filePath} exceeds size limit (${stat.size} > ${maxBytes} bytes). Skipping.`);
			return null;
		}
		return fs.readFileSync(filePath, "utf8");
	} catch {
		return null;
	}
}
