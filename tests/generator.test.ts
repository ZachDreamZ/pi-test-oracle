import { TestGenerator } from "../dist/generator";

describe("TestGenerator", () => {
	const gen = new TestGenerator();

	describe("parseSignature", () => {
		test("parses a simple function", () => {
			const result = gen.parseSignature(
				"function validateToken(token: string): boolean",
			);
			expect(result).not.toBeNull();
			expect(result?.name).toBe("validateToken");
			expect(result?.params).toHaveLength(1);
			expect(result?.params[0].name).toBe("token");
			expect(result?.params[0].type).toBe("string");
			expect(result?.returnType).toBe("boolean");
			expect(result?.isAsync).toBe(false);
		});

		test("parses async function with multiple params", () => {
			const result = gen.parseSignature(
				"async function fetchUser(id: string, includeArchived: boolean): Promise<User | null>",
			);
			expect(result?.name).toBe("fetchUser");
			expect(result?.params).toHaveLength(2);
			expect(result?.isAsync).toBe(true);
			expect(result?.returnType).toBe("User | null");
		});

		test("parses arrow function", () => {
			const result = gen.parseSignature(
				"const add = (a: number, b: number) => number",
			);
			expect(result?.name).toBe("add");
			expect(result?.params).toHaveLength(2);
		});

		test("parses exported function", () => {
			const result = gen.parseSignature("export function hello(): void");
			expect(result?.isExported).toBe(true);
			expect(result?.returnType).toBe("void");
		});

		test("handles optional parameters", () => {
			const result = gen.parseSignature(
				"function foo(a: string, b?: number): void",
			);
			expect(result?.params[1].type).toContain("undefined");
		});

		test("returns null for invalid input", () => {
			const result = gen.parseSignature("not a function");
			expect(result).toBeNull();
		});
	});

	describe("generateInputs", () => {
		test("generates string inputs", () => {
			const inputs = gen.generateInputs("string");
			expect(inputs).toContain('""');
			expect(inputs.some((i) => i.includes("repeat"))).toBe(true);
		});

		test("generates number inputs", () => {
			const inputs = gen.generateInputs("number");
			expect(inputs).toContain("0");
			expect(inputs.some((i) => i.includes("MAX_SAFE_INTEGER"))).toBe(true);
		});

		test("generates array inputs", () => {
			const inputs = gen.generateInputs("string[]");
			expect(inputs).toContain("[]");
		});

		test("handles union types", () => {
			const inputs = gen.generateInputs("string | null");
			expect(inputs).toContain("null");
			expect(inputs).toContain('""');
		});

		test("handles intersection types", () => {
			const inputs = gen.generateInputs(
				"Record<string, string> & { id: string }",
			);
			expect(inputs).toContain("null");
			expect(inputs).toContain('""');
		});

		test("handles map and set generics", () => {
			const mapInputs = gen.generateInputs("Map<string, number>");
			expect(mapInputs).toContain("new Map()");
			expect(mapInputs.some((i) => i.includes("new Map([ ["))).toBe(true);

			const setInputs = gen.generateInputs("Set<string>");
			expect(setInputs).toContain("new Set()");
			expect(setInputs.some((i) => i.includes("new Set(["))).toBe(true);
		});
	});

	describe("generateTest", () => {
		test("generates a valid test file", () => {
			const result = gen.generateTest(
				"function add(a: number, b: number): number",
				"../src/math",
			);
			expect(result).not.toBeNull();
			expect(result?.content).toContain("describe(");
			expect(result?.content).toContain("import { add }");
			expect(result?.content).toContain("expect(");
		});

		test("uses async/await when needed", () => {
			const result = gen.generateTest(
				"async function fetch(url: string): Promise<string>",
				"../src/http",
			);
			expect(result?.content).toContain("await fetch(");
		});

		test("respects custom symbol name", () => {
			const result = gen.generateTest(
				"function internal(x: number): number",
				"../src/utils",
				{ symbolName: "publicApi" },
			);
			expect(result?.content).toContain("publicApi");
			expect(result?.symbol).toBe("publicApi");
		});
	});
});
