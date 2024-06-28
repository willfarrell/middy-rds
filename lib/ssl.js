import { checkServerIdentity } from 'node:tls'

export default {
  rejectUnauthorized: true,
  ca: undefined,
  checkServerIdentity: (host, cert) => {
    const error = checkServerIdentity(host, cert)
    if (error && !cert.subject.CN.endsWith('.rds.amazonaws.com')) {
      return error
    }
  }
}
