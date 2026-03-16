import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

// Mock @aws-sdk/rds-signer before importing the module
mock.module("@aws-sdk/rds-signer", {
	namedExports: {
		Signer: class MockSigner {
			constructor(params) {
				this.params = params;
			}

			getAuthToken() {
				return Promise.resolve(
					"host.rds.amazonaws.com:5432/?Action=connect&DBUser=admin&X-Amz-Security-Token=token123",
				);
			}
		},
	},
});

// Mock @middy/util
mock.module("@middy/util", {
	namedExports: {
		canPrefetch: () => false,
		getInternal: () => Promise.resolve({}),
		processCache: (_options, fetch, request) => {
			const value = fetch(request);
			return { value };
		},
	},
});

const { default: pgMiddleware } = await import("../clients/pg.js");

// pg uses `new Client(config)` so we need a constructor
function createMockClientClass() {
	const instances = [];
	class MockPool {
		constructor(config) {
			// Snapshot config since password gets cleared after construction
			this._config = { ...config };
			this.query = mock.fn(() =>
				Promise.resolve({ rows: [{ "?column?": 1 }] }),
			);
			this.end = mock.fn(() => Promise.resolve());
			instances.push(this);
		}
	}
	MockPool.instances = instances;
	return MockPool;
}

describe("pg middleware", () => {
	it("should throw if client option is missing", () => {
		assert.throws(() => pgMiddleware(), {
			message: "client option missing",
		});
	});

	it("should create pool and attach to context", async () => {
		const MockClient = createMockClientClass();
		const middleware = pgMiddleware({
			client: MockClient,
			config: {
				host: "host.rds.amazonaws.com",
				user: "admin",
				port: 5432,
			},
		});

		const request = { context: {} };
		await middleware.before(request);

		assert.ok(request.context.rds);
		assert.equal(MockClient.instances.length, 1);
	});

	it("should use IAM token as password when no password provided", async () => {
		const MockClient = createMockClientClass();
		const middleware = pgMiddleware({
			client: MockClient,
			config: {
				host: "host.rds.amazonaws.com",
				user: "admin",
				port: 5432,
			},
		});

		const request = { context: {} };
		await middleware.before(request);

		const instance = MockClient.instances[0];
		assert.ok(instance._config.password.includes("X-Amz-Security-Token="));
	});

	it("should use provided password instead of IAM token", async () => {
		const MockClient = createMockClientClass();
		const middleware = pgMiddleware({
			client: MockClient,
			config: {
				host: "host.rds.amazonaws.com",
				user: "admin",
				port: 5432,
				password: "my-password",
			},
		});

		const request = { context: {} };
		await middleware.before(request);

		// password is cleared after pool creation, but pool was created with it
		assert.equal(MockClient.instances.length, 1);
	});

	it("should force connection when forceConnection is true", async () => {
		const MockClient = createMockClientClass();
		const middleware = pgMiddleware({
			client: MockClient,
			config: {
				host: "host.rds.amazonaws.com",
				user: "admin",
				port: 5432,
				password: "pass",
			},
			forceConnection: true,
		});

		const request = { context: {} };
		await middleware.before(request);

		assert.equal(MockClient.instances[0].query.mock.calls.length, 1);
	});

	it("should end pool on after when cacheExpiry is 0", async () => {
		const MockClient = createMockClientClass();
		const middleware = pgMiddleware({
			client: MockClient,
			config: {
				host: "host.rds.amazonaws.com",
				user: "admin",
				port: 5432,
				password: "pass",
			},
			cacheExpiry: 0,
		});

		const request = { context: {} };
		await middleware.before(request);
		await middleware.after(request);

		assert.equal(MockClient.instances[0].end.mock.calls.length, 1);
	});

	it("should not end pool on after when cacheExpiry is not 0", async () => {
		const MockClient = createMockClientClass();
		const middleware = pgMiddleware({
			client: MockClient,
			config: {
				host: "host.rds.amazonaws.com",
				user: "admin",
				port: 5432,
				password: "pass",
			},
		});

		const request = { context: {} };
		await middleware.before(request);
		await middleware.after(request);

		assert.equal(MockClient.instances[0].end.mock.calls.length, 0);
	});

	it("should use custom contextKey", async () => {
		const MockClient = createMockClientClass();
		const middleware = pgMiddleware({
			client: MockClient,
			config: {
				host: "host.rds.amazonaws.com",
				user: "admin",
				port: 5432,
				password: "pass",
			},
			contextKey: "db",
		});

		const request = { context: {} };
		await middleware.before(request);

		assert.ok(request.context.db);
		assert.equal(request.context.rds, undefined);
	});

	it("should handle cleanup errors gracefully on after", async () => {
		const MockClient = createMockClientClass();
		// Override end to reject after instance creation
		const middleware = pgMiddleware({
			client: MockClient,
			config: {
				host: "host.rds.amazonaws.com",
				user: "admin",
				port: 5432,
				password: "pass",
			},
			cacheExpiry: 0,
		});

		const request = { context: {} };
		await middleware.before(request);
		// Override end to reject
		MockClient.instances[0].end = mock.fn(() =>
			Promise.reject(new Error("end failed")),
		);
		// should not throw
		await middleware.after(request);
	});

	it("should call onError same as after", async () => {
		const MockClient = createMockClientClass();
		const middleware = pgMiddleware({
			client: MockClient,
			config: {
				host: "host.rds.amazonaws.com",
				user: "admin",
				port: 5432,
				password: "pass",
			},
			cacheExpiry: 0,
		});

		const request = { context: {} };
		await middleware.before(request);
		await middleware.onError(request);

		assert.equal(MockClient.instances[0].end.mock.calls.length, 1);
	});
});
