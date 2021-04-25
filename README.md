# Middy RDS manager

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/docs/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>Simple database manager for the middy framework</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40willfarrell%2Fmiddy-rds">
    <img src="https://badge.fury.io/js/%40willfarrell%2Fmiddy-rds.svg" alt="npm version" style="max-width:100%;">
  </a>
  <a href="https://snyk.io/test/github/willfarrell/middy-rds">
    <img src="https://snyk.io/test/github/willfarrell/middy-rds/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/test/github/willfarrell/middy-rds" style="max-width:100%;">
  </a>
  <a href="https://standardjs.com/">
    <img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="Standard Code Style"  style="max-width:100%;">
  </a>
  <a href="https://gitter.im/middyjs/Lobby">
    <img src="https://badges.gitter.im/gitterHQ/gitter.svg" alt="Chat on Gitter"  style="max-width:100%;">
  </a>
</p>
</div>

RDS provides seamless connection with database of your choice.

After initialization your database connection is accessible under:
```javascript
middy((event, context) => {
  const { db } = context;
});
```

Mind that if you use knex you will also need driver of your choice ([check docs](http://knexjs.org/#Installation-node)), for PostgreSQL that would be:
```
yarn add pg
// or
npm install pg
```


## Install

To install this middleware you can use NPM:

```bash
npm install --save middy-rds
```

Requires: @middy/core:>=2.0.0

## Options
- `client` (function) (required): client that you want to use when connecting to database of your choice. Designed to be used by knex.js. However, as long as your client is run as client(config), you can use other tools.
- `config` (object) (required): configuration object passed as is to client (knex.js recommended), for more details check [knex documentation](http://knexjs.org/#Installation-client)
- `internalData` (object) (optional): Pull values from middy internal storage into `config.connection` object.
- `cacheKey` (string) (default `rds`): Cache key for the fetched data responses. Must be unique across all middleware.
- `cachePasswordKey` (string) (default `rds`):Cache key for the fetched data response related to the password. Must match the `cacheKey` for the middleware that stores it.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached for. `-1`: cache forever, `0`: never cache, `n`: cache for n ms.


**Note:**
- `config.connection` defaults to:

```javascript
{
  ssl: {
    rejectUnauthorized: true,
    ca, // rds-ca-2019-root.pem
    checkServerIdentity: (host, cert) => {
      const error = tls.checkServerIdentity(host, cert)
      if (error && !cert.subject.CN.endsWith('.rds.amazonaws.com')) {
         return error
      }
    }
  }
}
```

If your lambda is timing out, likely your database connections are keeping the event loop open. Check out [do-not-wait-for-empty-event-loop](https://github.com/middyjs/middy/tree/master/packages/do-not-wait-for-empty-event-loop) middleware to resolve this.

## Sample usage

Minimal configuration

```javascript
const handler = middy(async (event, context) => {
    const { db } = context;
    const records = await db.select('*').from('my_table');
    console.log(records);
  })
  .use(rdsSigner({
    fetchData: {
      rdsToken: {
        region: 'ca-central-1',
        hostname: '*.ca-central-1.rds.amazonaws.com',
        username: 'iam_role',
        database: 'postgres',
        port: 5432
      }
    },
    cacheKey: 'rds-signer'
  }))
  .use(rds({
    internalData: {
      password: 'rdsToken'
    },
    cacheKey: 'rds',
    cachePasswordKey: 'rds-signer',
    client: knex,
    config: {
      client: 'pg',
      connection: {
        host: '*.ca-central-1.rds.amazonaws.com',
        user: 'iam_role',
        database: 'postgres',
        port: 5432
      }
    }
  }))
```


## Middy documentation and examples

For more documentation and examples, refers to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org).


## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).


## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2021 Luciano Mammino, will Farrell and the [Middy team](https://github.com/middyjs/middy/graphs/contributors).

<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy?ref=badge_large">
  <img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy.svg?type=large" alt="FOSSA Status"  style="max-width:100%;">
</a>
