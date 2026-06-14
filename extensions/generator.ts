// TestGenerator: Parses function signatures and generates minimal failing tests.

import type { ParsedSignature, GeneratedTest } from "./types";

export class TestGenerator {
	/**
	 * Parse a TypeScript/JavaScript function signature.
	 * Handles:
	 *   - function foo(a: string, b: number): boolean
	 *   - async function foo(a: string): Promise<boolean>
	 *   - const foo = (a: string, b: number) => boolean
	 *   - export function foo(...)
	 */
	public parseSignature(signature: string): ParsedSignature | null {
		const isAsync = /async\s+/.test(signature);
		const isExported = /export\s+/.test(signature);

		// Match the parameter list inside parentheses
		const paramMatch = signature.match(/\(([^)]*)\)/);
		if (!paramMatch) return null;

		const paramString = paramMatch[1].trim();
		const params = this.parseParams(paramString);

		// Extract function name (the identifier before the parenthesis)
		const nameMatch = signature.match(
			/(?:function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[=(]/,
		);
		const arrowNameMatch = signature.match(
			/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[:=]\s*(?:async\s+)?\(/,
		);
		const methodNameMatch = signature.match(
			/(?:^|\s)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/,
		);

		let name = "unknown";
		if (nameMatch) name = nameMatch[1];
		else if (arrowNameMatch) name = arrowNameMatch[1];
		else if (methodNameMatch) name = methodNameMatch[1];

		// Extract return type (everything after the closing paren up to { or =>)
		const afterParams = signature
			.substring(signature.indexOf(")", paramMatch.index!) + 1)
			.trim();
		const returnTypeMatch = afterParams.match(
			/^[:\s]*(?:Promise<(.+)>|([a-zA-Z_$<>|\s[\],]+))/,
		);
		const returnType = returnTypeMatch
			? (returnTypeMatch[1] || returnTypeMatch[2] || "unknown").trim()
			: "unknown";

		return { name, params, returnType, isAsync, isExported };
	}

	/**
	 * Parse a parameter string like "a: string, b: number = 5, c?: boolean"
	 */
	private parseParams(
		paramString: string,
	): Array<{ name: string; type: string }> {
		if (!paramString) return [];

		// Split by comma (not inside angle brackets)
		const parts = this.splitByComma(paramString);
		return parts
			.map((p) => p.trim())
			.filter((p) => p.length > 0)
			.map((p) => {
				// Match: name?: type, name: type, name = default
				const match = p.match(
					/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(\?)?\s*:\s*(.+?)(?:\s*=\s*.+)?$/,
				);
				if (!match) return { name: p, type: "unknown" };
				const name = match[1];
				const optional = match[2] === "?";
				let type = match[3].trim();
				if (optional) type = `${type} | undefined`;
				return { name, type };
			});
	}

	/**
	 * Split a string by commas, respecting angle brackets (generics).
	 */
	private splitByComma(str: string): string[] {
		const result: string[] = [];
		let depth = 0;
		let current = "";
		for (const ch of str) {
			if (ch === "<") depth++;
			else if (ch === ">") depth--;
			else if (ch === "," && depth === 0) {
				result.push(current);
				current = "";
				continue;
			}
			current += ch;
		}
		if (current.trim()) result.push(current);
		return result;
	}

	/**
	 * Generate test inputs for a given type.
	 */
	public generateInputs(type: string): string[] {
		const t = type.toLowerCase().trim();

		// Handle union types (e.g., "string | null")
		if (t.includes("|")) {
			const parts = t.split("|").map((p) => p.trim());
			const inputs: string[] = [];
			for (const part of parts) {
				inputs.push(...this.generateInputs(part));
			}
			return [...new Set(inputs)];
		}

		// Primitives
		if (t === "string")
			return [
				'""',
				'" "',
				'"a"',
				'"x".repeat(100)',
				'"unicode-\u00e9-\u4e2d\u6587"',
			];
		if (t === "number")
			return [
				"0",
				"-1",
				"1",
				"Number.MAX_SAFE_INTEGER",
				"Number.MIN_SAFE_INTEGER",
				"0.5",
			];
		if (t === "boolean") return ["true", "false"];
		if (t === "null") return ["null"];
		if (t === "undefined") return ["undefined"];

		// Array
		if (t.endsWith("[]") || t.includes("array<")) {
			const inner = t.replace("[]", "").replace(/array<(.+)>/i, "$1");
			return [
				"[]",
				`[null]`,
				`Array(10).fill(${this.generateInputs(inner)[0] || "0"})`,
			];
		}

		// Object
		if (t === "object" || t.startsWith("{"))
			return ["{}", "Object.create(null)"];

		// Promise (assume async)
		if (t === "promise" || t.startsWith("promise<"))
			return ["Promise.resolve()"];

		// Fallback
		return ["null", "undefined", "0", '""'];
	}

	/**
	 * Generate a complete Jest test file for a function signature.
	 */
	public generateTest(
		signature: string,
		importPath: string,
		options: { symbolName?: string; testFilePath?: string } = {},
	): GeneratedTest | null {
		const parsed = this.parseSignature(signature);
		if (!parsed) return null;

		const symbolName = options.symbolName || parsed.name;
		const testFilePath = options.testFilePath || `tests/${symbolName}.test.ts`;

		// Build test cases
		const testCases: Array<{ desc: string; input: string }> = [];

		// Add a "basic" test case
		if (parsed.params.length > 0) {
			const firstInputs = this.generateInputs(parsed.params[0].type);
			testCases.push({
				desc: "handles basic input",
				input: firstInputs[0] || "null",
			});
		} else {
			testCases.push({ desc: "executes without error", input: "" });
		}

		// Add edge case tests based on each parameter
		parsed.params.forEach((param, idx) => {
			const inputs = this.generateInputs(param.type);
			// Take up to 3 representative inputs
			const samples = [inputs[0], inputs[1], inputs[inputs.length - 1]].filter(
				Boolean,
			);
			samples.forEach((input) => {
				const args = parsed.params
					.map((p, i) =>
						i === idx ? input : this.generateInputs(p.type)[0] || "null",
					)
					.join(", ");
				testCases.push({
					desc: `handles ${param.name} = ${input}`,
					input: args,
				});
			});
		});

		// Build the test file content
		const isAsync = parsed.isAsync;
		const awaitKeyword = isAsync ? "await " : "";
		const testBlocks = testCases
			.map(
				(tc) => `	test("${tc.desc}", () => {
		// TODO: Update this assertion once the implementation is correct
		const result = ${awaitKeyword}${symbolName}(${tc.input});
		expect(result).toBeDefined();
	});`,
			)
			.join("\n\n");

		const content = `// Auto-generated by pi-test-oracle
// This is a MINIMAL FAILING TEST (RED) for: ${symbolName}
// Signature: ${signature}

import { ${symbolName} } from "${importPath}";

describe("${symbolName}", () => {
${testBlocks}
});
`;

		return {
			filePath: testFilePath,
			content,
			importPath,
			symbol: symbolName,
		};
	}
}
