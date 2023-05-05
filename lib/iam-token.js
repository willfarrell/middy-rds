import { Signer } from '@aws-sdk/rds-signer'

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
  const client = new Signer(params)

  return client.getAuthToken().then((token) => {
    // Catch Missing token, this usually means their is something wrong with the credentials
    if (!token.includes('X-Amz-Security-Token=')) {
      throw new Error('X-Amz-Security-Token Missing', {
        cause: { package: 'middy-rds', data: params }
      })
    }
    return token
  })
}
