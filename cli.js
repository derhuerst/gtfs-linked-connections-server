#!/usr/bin/env node
'use strict'

const mri = require('mri')
const pkg = require('./package.json')

const argv = mri(process.argv.slice(2), {
	boolean: [
		'help', 'h',
		'version', 'v',
	]
})

if (argv.help || argv.h) {
	process.stdout.write(`
Usage:
    serve-gtfs-as-lc [options] [--] <todo>
Options:
    --port                    -p  Port to listen on. Defaults to $PORT or 3000.
Examples:
    serve-gtfs-as-lc --port 8080
\n`)
	process.exit(0)
}

if (argv.version || argv.v) {
	process.stdout.write(`${pkg.name} v${pkg.version}\n`)
	process.exit(0)
}

const {createServer} = require('http')
const {promisify} = require('util')
const gtfsLinkedConnectionsServer = require('.')

const port = parseInt(argv.port || argv.p || process.env.PORT || '3000')

;(async () => {
	// todo: customisable {stop,connection,trip,route}Id()
	const app = await gtfsLinkedConnectionsServer()
	const server = createServer(app)

	const pListen = promisify(server.listen.bind(server))
	await pListen(port)
	console.info(`Linked Connections server listening on port ${port}`)
})()
.catch((err) => {
	console.error(err)
	process.exit(1)
})
