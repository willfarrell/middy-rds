import { readFileSync } from 'node:fs'
import { checkServerIdentity } from 'node:tls'

// TODO make async
const ca = readFileSync(process.env.NODE_EXTRA_CA_CERTS, {
  encoding: 'utf8'
}).toString()

export default {
  rejectUnauthorized: true,
  ca,
  checkServerIdentity: (host, cert) => {
    const error = checkServerIdentity(host, cert)
    if (error && !cert.subject.CN.endsWith('.rds.amazonaws.com')) {
      return error
    }
  }
}
