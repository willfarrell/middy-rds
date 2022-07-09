import RDS from 'aws-sdk/clients/rds.js'
// import { RDS } from '@aws-sdk/client-rds' // v3

export default async (config) => {
  const params = {
    region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION,
    hostname:
      config.host ??
      config.hostname ??
      process.env.DBHOST ??
      process.env.PGHOST,
    port: Number.parseInt(
      config.port ?? process.env.DBPORT ?? process.env.PGPORT
    ),
    username:
      config.user ?? config.username ?? process.env.DBUSER ?? process.env.PGUSER
  }
  const client = new RDS.Signer(params)

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
