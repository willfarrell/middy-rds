import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ssl from "./ssl.js";

describe("ssl", () => {
	it("should return default config when called with no args", () => {
		const result = ssl();
		assert.deepEqual(result, { sslmode: "require" });
	});

	it("should return default config when called with empty object", () => {
		const result = ssl({});
		assert.deepEqual(result, { sslmode: "require" });
	});

	it("should include rdsConfig when ca is provided", () => {
		const result = ssl({ ca: "cert-content" });
		assert.equal(result.rejectUnauthorized, true);
		assert.equal(typeof result.checkServerIdentity, "function");
		assert.equal(result.ca, "cert-content");
		assert.equal(result.sslmode, "require");
	});

	it("should not include rdsConfig when ca is not provided", () => {
		const result = ssl({ sslmode: "verify-full" });
		assert.equal(result.rejectUnauthorized, undefined);
		assert.equal(result.checkServerIdentity, undefined);
		assert.equal(result.sslmode, "verify-full");
	});

	it("should allow user overrides over rds defaults", () => {
		const result = ssl({ ca: "cert", rejectUnauthorized: false });
		assert.equal(result.rejectUnauthorized, false);
		assert.equal(result.ca, "cert");
	});

	it("should allow checkServerIdentity for rds domains", () => {
		const result = ssl({ ca: "cert" });
		const cert = { subject: { CN: "mydb.abc123.us-east-1.rds.amazonaws.com" } };
		// Should not return an error for RDS domains
		const error = result.checkServerIdentity("different-host", cert);
		assert.equal(error, undefined);
	});

	it("should return error for non-rds domains with identity mismatch", () => {
		const result = ssl({ ca: "cert" });
		const cert = {
			subject: { CN: "other-host.example.com" },
			subjectaltname: "DNS:other-host.example.com",
		};
		const error = result.checkServerIdentity("wrong-host", cert);
		assert.ok(error);
	});
});
