// Copyright 2026 will Farrell, and middy-rds contributors.
// SPDX-License-Identifier: MIT
import { readFileSync } from "node:fs";
export default () => {
	return readFileSync(process.env.NODE_EXTRA_CA_CERTS, {
		encoding: "utf8",
	}).toString();
};
