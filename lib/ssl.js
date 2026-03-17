// Copyright 2026 will Farrell, and middy-rds contributors.
// SPDX-License-Identifier: MIT
import { checkServerIdentity } from "node:tls";

const defaultConfig = {
	sslmode: "require",
};

const rdsConfig = {
	rejectUnauthorized: true,
	checkServerIdentity: (host, cert) => {
		const error = checkServerIdentity(host, cert);
		if (error && !cert.subject.CN.endsWith(".rds.amazonaws.com")) {
			return error;
		}
	},
};

const ssl = (sslConfig = {}) => {
	const conditionalConfig = sslConfig.ca && rdsConfig;
	return {
		...defaultConfig,
		...conditionalConfig,
		...sslConfig,
	};
};

export default ssl;
