import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

let tokenValue =
	"host.rds.amazonaws.com:5432/?Action=connect&DBUser=admin&X-Amz-Security-Token=token123";

mock.module("@aws-sdk/rds-signer", {
	namedExports: {
		Signer: class MockSigner {
			constructor(params) {
				this.params = params;
			}

			getAuthToken() {
				return Promise.resolve(tokenValue);
			}
		},
	},
});

const { default: iamToken } = await import("../lib/iam-token.js");

describe("iam-token", () => {
	it("should generate token with config params", async () => {
		tokenValue =
			"mydb.rds.amazonaws.com:5432/?Action=connect&DBUser=admin&X-Amz-Security-Token=token123";
		const token = await iamToken({
			host: "mydb.rds.amazonaws.com",
			user: "admin",
			port: 5432,
		});

		assert.ok(token.includes("X-Amz-Security-Token="));
		assert.ok(token.includes("mydb.rds.amazonaws.com"));
	});

	it("should throw if token is missing X-Amz-Security-Token", async () => {
		tokenValue = "invalid-token-without-security";

		await assert.rejects(() => iamToken({ host: "h", user: "u", port: 5432 }), {
			message: "X-Amz-Security-Token Missing",
		});
	});

	it("should fallback to hostname config key", async () => {
		tokenValue =
			"host2.rds.amazonaws.com:5432/?Action=connect&X-Amz-Security-Token=abc";
		const token = await iamToken({
			hostname: "host2.rds.amazonaws.com",
			username: "admin",
			port: 5432,
		});

		assert.ok(token.includes("X-Amz-Security-Token="));
	});
});
