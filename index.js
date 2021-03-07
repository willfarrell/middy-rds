const tls = require('tls')
const { promisify } = require('util')
const { getInternal, processCache, clearCache } = require('@middy/util')

// RDS Public Cert
// https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html
// rds-ca-2019-root.pem
const ca = `-----BEGIN CERTIFICATE-----
MIIEBjCCAu6gAwIBAgIJAMc0ZzaSUK51MA0GCSqGSIb3DQEBCwUAMIGPMQswCQYD
VQQGEwJVUzEQMA4GA1UEBwwHU2VhdHRsZTETMBEGA1UECAwKV2FzaGluZ3RvbjEi
MCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1h
em9uIFJEUzEgMB4GA1UEAwwXQW1hem9uIFJEUyBSb290IDIwMTkgQ0EwHhcNMTkw
ODIyMTcwODUwWhcNMjQwODIyMTcwODUwWjCBjzELMAkGA1UEBhMCVVMxEDAOBgNV
BAcMB1NlYXR0bGUxEzARBgNVBAgMCldhc2hpbmd0b24xIjAgBgNVBAoMGUFtYXpv
biBXZWIgU2VydmljZXMsIEluYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxIDAeBgNV
BAMMF0FtYXpvbiBSRFMgUm9vdCAyMDE5IENBMIIBIjANBgkqhkiG9w0BAQEFAAOC
AQ8AMIIBCgKCAQEArXnF/E6/Qh+ku3hQTSKPMhQQlCpoWvnIthzX6MK3p5a0eXKZ
oWIjYcNNG6UwJjp4fUXl6glp53Jobn+tWNX88dNH2n8DVbppSwScVE2LpuL+94vY
0EYE/XxN7svKea8YvlrqkUBKyxLxTjh+U/KrGOaHxz9v0l6ZNlDbuaZw3qIWdD/I
6aNbGeRUVtpM6P+bWIoxVl/caQylQS6CEYUk+CpVyJSkopwJlzXT07tMoDL5WgX9
O08KVgDNz9qP/IGtAcRduRcNioH3E9v981QO1zt/Gpb2f8NqAjUUCUZzOnij6mx9
McZ+9cWX88CRzR0vQODWuZscgI08NvM69Fn2SQIDAQABo2MwYTAOBgNVHQ8BAf8E
BAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUc19g2LzLA5j0Kxc0LjZa
pmD/vB8wHwYDVR0jBBgwFoAUc19g2LzLA5j0Kxc0LjZapmD/vB8wDQYJKoZIhvcN
AQELBQADggEBAHAG7WTmyjzPRIM85rVj+fWHsLIvqpw6DObIjMWokpliCeMINZFV
ynfgBKsf1ExwbvJNzYFXW6dihnguDG9VMPpi2up/ctQTN8tm9nDKOy08uNZoofMc
NUZxKCEkVKZv+IL4oHoeayt8egtv3ujJM6V14AstMQ6SwvwvA93EP/Ug2e4WAXHu
cbI1NAbUgVDqp+DRdfvZkgYKryjTWd/0+1fS8X1bBZVWzl7eirNVnHbSH2ZDpNuY
0SBd8dj5F6ld3t58ydZbrTHze7JJOd8ijySAp4/kiu9UfZWuTPABzDa/DSdz9Dk/
zPW4CXXvhLmE02TA9/HeCw3KEHIwicNuEfw=
-----END CERTIFICATE-----`

const defaults = {
  client: undefined,
  config: {},
  internalData: {},
  cacheKey: 'rds',
  cacheExpiry: -1
}

const defaultConnection = {
  ssl: {
    rejectUnauthorized: true,
    ca,
    checkServerIdentity: (host, cert) => {
      const error = tls.checkServerIdentity(host, cert)
      if (
        error &&
        !cert.subject.CN.endsWith('.rds.amazonaws.com')
      ) {
        return error
      }
    }
  }
}

const rdsMiddleware = (opts = {}) => {
  const options = Object.assign({}, defaults, opts)
  if (!options.client) throw new Error('client option missing')

  const fetch = async (handler) => {
    const values = await getInternal(options.internalData, handler)
    options.config.connection = Object.assign({}, defaultConnection, options.config.connection, values)
    const db = options.client(options.config)
    db.raw('SELECT 1') // don't await, used to force open connection
      .catch(e => {
        // Connection failed for some reason
        // log and clear cache, force re-connect
        console.error('middy-rds SELECT 1', e.message)
        clearCache(Object.keys(options.internalData))
        clearCache([options.cacheKey])
      })

    // cache the connection, not the credentials as they may change over time
    return db
  }

  const rdsMiddlewareBefore = async (handler) => {
    const {value}  = processCache(options, fetch, handler)

    Object.assign(handler.context, { db: await value }) // await due to fetch being a promise
  }
  const rdsMiddlewareAfter = async (handler) => {
    if (options.cacheExpiry === 0) {
      await promisify(handler.context.db.destroy)()
    }
  }
  const rdsMiddlewareOnError = rdsMiddlewareAfter

  return {
    before: rdsMiddlewareBefore,
    after: rdsMiddlewareAfter,
    onError: rdsMiddlewareOnError
  }
}

module.exports = rdsMiddleware