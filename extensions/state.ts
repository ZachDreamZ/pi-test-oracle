// TddStateStore: Persists the state of each test to ~/.pi/test-oracle/state.json.
// Includes retry logic for transient I/O errors and atomic save with cleanup.

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { TddState, TestRecord, TddStateFile } from "./types";
import { readFileWithRetry, isTransientIoError } from "./util";

const STATE_DIR = path.join(os.homedir(), ".pi", "test-oracle");
const STATE_PATH = path.join(STATE_DIR, "state.json");
const MAX_OUTPUT_LEN = 500;

export class TddStateStore {
	private state: TddStateFile;

	constructor() {
		this.state = this.load();
	}

	public load(): TddStateFile {
		if (!fs.existsSync(STATE_PATH)) {
			return { version: 1, tests: {} };
		}

		const content = readFileWithRetry(STATE_PATH, 2, 30);
		if (content === null) {
			let code = "UNKNOWN";
			try {
				fs.accessSync(STATE_PATH);
				code = "ACCESSIBLE";
			} catch (err) {
				code = (err as NodeJS.ErrnoException).code || "UNKNOWN";
			}
			if (isTransientIoError({ code } as unknown as Error)) {
				console.error(`[pi-test-oracle] Transient I/O error loading state (${code})`);
			}
			return { version: 1, tests: {} };
		}

		try {
			const parsed = JSON.parse(content) as TddStateFile;
			if (parsed.version === 1 && parsed.tests) {
				return parsed;
			}
		} catch (err) {
			console.error(`[pi-test-oracle] Failed to parse state, starting fresh: ${(err as Error).message}`);
		}
		return { version: 1, tests: {} };
	}

	public save(): void {
		const tmpPath = `${STATE_PATH}.tmp`;
		try {
			if (!fs.existsSync(STATE_DIR)) {
				fs.mkdirSync(STATE_DIR, { recursive: true });
			}
			fs.writeFileSync(tmpPath, JSON.stringify(this.state, null, 2), "utf8");
			fs.renameSync(tmpPath, STATE_PATH);
		} catch (err) {
			try {
				if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
			} catch {
				// Ignore cleanup errors
			}
			console.error(`[pi-test-oracle] Failed to save state: ${(err as Error).message}`);
		}
	}

	public recordTest(path: string, symbol: string): TestRecord {
		const record: TestRecord = {
			path,
			symbol,
			state: "RED",
			createdAt: Date.now(),
			lastRunAt: null,
			lastRunOutput: "",
			history: [{ state: "RED", at: Date.now() }],
		};
		this.state.tests[path] = record;
		this.save();
		return record;
	}

	public updateState(path: string, newState: TddState, output: string = ""): void {
		const record = this.state.tests[path];
		if (!record) {
			console.warn(`[pi-test-oracle] No record found for ${path}`);
			return;
		}
		record.state = newState;
		record.lastRunAt = Date.now();
		record.lastRunOutput = output.slice(0, MAX_OUTPUT_LEN);
		record.history.push({ state: newState, at: Date.now() });
		this.save();
	}

	public getAll(): TestRecord[] {
		return Object.values(this.state.tests);
	}

	public getByState(state: TddState): TestRecord[] {
		return this.getAll().filter((t) => t.state === state);
	}

	public get(path: string): TestRecord | undefined {
		return this.state.tests[path];
	}
}
