import test from "node:test";
import fc from "fast-check";
import ssl from "./lib/ssl.js";

test("fuzz: ssl config with random options should not throw", () => {
	fc.assert(
		fc.property(
			fc.record({
				ca: fc.option(fc.string()),
				rejectUnauthorized: fc.option(fc.boolean()),
				sslmode: fc.option(
					fc.constantFrom(
						"require",
						"verify-ca",
						"verify-full",
						"prefer",
						"disable",
					),
				),
			}),
			(config) => {
				const result = ssl(config);
				if (typeof result !== "object") throw new Error("Expected object");
			},
		),
		{ numRuns: 1000 },
	);
});

test("fuzz: ssl with no args should not throw", () => {
	fc.assert(
		fc.property(fc.constant(undefined), () => {
			const result = ssl();
			if (typeof result !== "object") throw new Error("Expected object");
		}),
		{ numRuns: 10 },
	);
});
