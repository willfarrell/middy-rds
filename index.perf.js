import test from "node:test";
import { Bench } from "tinybench";
import ssl from "./lib/ssl.js";

test("perf: ssl configuration benchmarks", async () => {
	const suite = new Bench({ name: "middy-rds" });

	suite
		.add("ssl() default config", () => {
			ssl();
		})
		.add("ssl() with CA", () => {
			ssl({ ca: "cert-data" });
		})
		.add("ssl() with full config", () => {
			ssl({
				ca: "cert-data",
				rejectUnauthorized: true,
				sslmode: "verify-full",
			});
		});

	await suite.run();
	console.table(suite.table());
});
