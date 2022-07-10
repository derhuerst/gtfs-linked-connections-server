# gtfs-linked-connections-server

**A [Linked Connections](https://linkedconnections.org) server using [PostgreSQL](https://www.postgresql.org) to serve [GTFS](https://gtfs.org/reference/static).**

[![npm version](https://img.shields.io/npm/v/gtfs-linked-connections-server.svg)](https://www.npmjs.com/package/gtfs-linked-connections-server)
![ISC-licensed](https://img.shields.io/github/license/derhuerst/gtfs-linked-connections-server.svg)
![minimum Node.js version](https://img.shields.io/node/v/gtfs-linked-connections-server.svg)
[![support me via GitHub Sponsors](https://img.shields.io/badge/support%20me-donate-fa7664.svg)](https://github.com/sponsors/derhuerst)
[![chat with me on Twitter](https://img.shields.io/badge/chat%20with%20me-on%20Twitter-1da1f2.svg)](https://twitter.com/derhuerst)

*Note:* This projects follows the [Linked Connections 2.0 draft](https://docs.google.com/document/d/1d-1zT-6kkRNEn781VlvojH6ea-EHtwB1-BXT9uOyfTk/edit?ts=5e7fce43) as of `2020-03-18`.


## Installation

```shell
npm install gtfs-linked-connections-server
```


## Usage

Follow [`gtfs-via-postgres`' instructions on importing data](https://github.com/derhuerst/gtfs-via-postgres/blob/master/readme.md), then serve it as Linked Connections via HTTP.

```shell
psql -c 'create database gtfs'
export PGDATABASE=gtfs

# import GTFS into PostgreSQL
npm install -D gtfs-via-postgres
npm exec -- gtfs-to-sql --require-dependencies -- gtfs/*.txt | psql -b

# create HTTP server that serves Linked Connections
npm install gtfs-linked-connections-server
cat >index.js <<- EOM
const {createServer} = require('http')
const {promisify} = require('util')
const serveGtfsLinkedConnections = require('gtfs-linked-connections-server')

const app = await serveGtfsLinkedConnections()

const server = createServer(app)
server.listen(3000)
EOM

node index.js
```


## Contributing

If you have a question or need support using `gtfs-linked-connections-server`, please double-check your code and setup first. If you think you have found a bug or want to propose a feature, use [the issues page](https://github.com/derhuerst/gtfs-linked-connections-server/issues).
