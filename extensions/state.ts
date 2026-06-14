// TddStateStore: Persists the state of each test to ~/.pi/test-oracle/state.json.

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { TddState, TestRecord, TddStateFile } from "./types";

const STATE_DIR = path.join(os.homedir(), ".pi", "test-oracle");
const STATE_PATH = path.join(STATE_DIR, "state.json");

export class TddStateStore {
	private state: TddStateFile;

	constructor() {
		this.state = this.load();
	}

	/**
	 * Load state from disk. If the file is missing or corrupted, start fresh.
	 */
	public load(): TddStateFile {
		try {
			if (fs.existsSync(STATE_PATH)) {
				const content = fs.readFileSync(STATE_PATH, "utf8");
				const parsed = JSON.parse(content) as TddStateFile;
				if (parsed.version === 1 && parsed.tests) {
					return parsed;
				}
			}
		} catch (err) {
			console.error(`[pi-test-oracle] Failed to load state, starting fresh: ${(err as Error).message}`);
		}
		return { version: 1, tests: {} };
	}

	/**
	 * Persist state to disk atomically (write to .tmp, rename).
	 */
	public save(): void {
		try {
			if (!fs.existsSync(STATE_DIR)) {
				fs.mkdirSync(STATE_DIR, { recursive: true });
			}
			const tmpPath = `${STATE_PATH}.tmp`;
			fs.writeFileSync(tmpPath, JSON.stringify(this.state, null, 2), "utf8");
			fs.renameSync(tmpPath, STATE_PATH);
		} catch (err) {
			console.error(`[pi-test-oracle] Failed to save state: ${(err as Error).message}`);
		}
	}

	/**
	 * Record a newly generated test in RED state.
	 */
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

	/**
	 * Update the state of a test (e.g., after running it).
	 */
	public updateState(path: string, newState: TddState, output: string = ""): void {
		const record = this.state.tests[path];
		if (!record) {
			console.warn(`[pi-test-oracle] No record found for ${path}`);
			return;
		}
		record.state = newState;
		record.lastRunAt = Date.now();
		record.lastRunOutput = output.slice(0, 500);
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
