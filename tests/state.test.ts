import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "path";

// We need to control the state file location. The cleanest way is to set HOME env var
// which os.homedir() respects on Unix, but on Windows it uses USERPROFILE. We'll
// instead write to a temp dir and override by directly testing the in-memory store.

import { TddStateStore } from "../dist/state";

describe("TddStateStore", () => {
	let store: TddStateStore;

	beforeEach(() => {
		// Each test gets a fresh instance. Note: the constructor reads from disk,
		// so any state left from previous test runs would persist. We work around
		// this by using a fresh instance and only testing in-memory mutations.
		store = new TddStateStore();
		// Clear any state loaded from disk
		for (const key of Object.keys((store as any).state.tests)) {
			delete (store as any).state.tests[key];
		}
	});

	test("starts with empty state (after clearing)", () => {
		expect(store.getAll()).toHaveLength(0);
	});

	test("records a new test in RED state", () => {
		const record = store.recordTest("tests/auth.test.ts", "validateToken");
		expect(record.state).toBe("RED");
		expect(record.symbol).toBe("validateToken");
		expect(record.createdAt).toBeGreaterThan(0);
		expect(store.getAll()).toHaveLength(1);
	});

	test("updates state and appends history", () => {
		store.recordTest("tests/auth.test.ts", "validateToken");
		store.updateState("tests/auth.test.ts", "GREEN", "PASS");
		const record = store.get("tests/auth.test.ts");
		expect(record?.state).toBe("GREEN");
		expect(record?.history).toHaveLength(2);
		expect(record?.lastRunOutput).toBe("PASS");
	});

	test("filters by state", () => {
		store.recordTest("tests/a.test.ts", "a");
		store.recordTest("tests/b.test.ts", "b");
		store.updateState("tests/a.test.ts", "GREEN");
		expect(store.getByState("RED")).toHaveLength(1);
		expect(store.getByState("GREEN")).toHaveLength(1);
	});

	test("get() returns undefined for unknown test", () => {
		expect(store.get("nonexistent.test.ts")).toBeUndefined();
	});
});
