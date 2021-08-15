const { canPrefetch, getInternal, processCache, clearCache/*, createError*/ } = require('@middy/util')
const RDS = require('aws-sdk/clients/rds') // v2
// const { RDS } = require('@aws-sdk/client-rds') // v3

const ssl = require('./ssl')

const defaults = {
  client: undefined,
  config: {},
  internalData: undefined,
  contextKey: 'db',
  disablePrefetch: false,
  cacheKey: 'rds',
  cachePasswordKey: 'rds',
  cacheExpiry: -1
}

const defaultConnection = { ssl }

const rdsMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }
  if (!options.client) throw new Error('client option missing')

  const fetch = async (request) => {
    const values = await getInternal(options.internalData, request)

    options.config = { ...defaultConnection, ...options.config, ...values }
    if (!options.config.password) {
      options.config.password = await iamToken(options.config)
    }
    if (!options.config.port) {
      options.config.port = process.env.PGPORT ?? 5432
    }

    const pool = new options.client(options.config)

    // cache the connection, not the credentials as they change over time
    return pool
      .connect()
      .catch(e => {
        // Connection failed for some reason
        // log and clear cache, force re-connect
        clearCache([options.cachePasswordKey])
        clearCache([options.cacheKey])
        prefetch = undefined
        throw new Error(e.message) //createError(500, e.message)
      })
      .finally(() => {
        options.config.password = undefined
      })
  }

  let prefetch
  if (canPrefetch(options)) {
    prefetch = processCache(options, fetch)
  }

  const rdsMiddlewareBefore = async (request) => {
    console.log(prefetch, options)
    const { value } = prefetch ?? processCache(options, fetch, request)
    Object.assign(request.context, { [options.contextKey]: await value }) // await due to fetch being a promise
  }
  const rdsMiddlewareAfter = async (request) => {
    if (options.cacheExpiry === 0) {
      await request.context[options.contextKey].end()
    }
  }
  const rdsMiddlewareOnError = rdsMiddlewareAfter

  return {
    before: rdsMiddlewareBefore,
    after: rdsMiddlewareAfter,
    onError: rdsMiddlewareOnError
  }
}

const iamToken = async (config) => {
  const client = new RDS.Signer({
    region: process.env.AWS_REGION,
    hostname: config.host ?? process.env.PGHOST,
    port: config.port ?? process.env.PGPORT ?? 5432,
    username: config.user ?? process.env.PGUSER,
  })

  // AWS doesn't support getAuthToken.promise() in aws-sdk v2 :( See https://github.com/aws/aws-sdk-js/issues/3595
  return new Promise((resolve, reject) => {
    client.getAuthToken({}, (err, token) => {
      if (err) {
        reject(err)
      }
      // Catch Missing token, this usually means their is something wrong with the credentials
      if (!token.includes('X-Amz-Security-Token=')) {
        reject(new Error('X-Amz-Security-Token Missing'))
      }
      resolve(token)
    })
  })
}

module.exports = rdsMiddleware