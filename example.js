'use strict'

const {createServer} = require('http')
const {promisify} = require('util')
const gtfsLinkedConnectionsServer = require('.')

const PORT = parseInt(process.env.PORT || '3000')

;(async () => {
	const app = await gtfsLinkedConnectionsServer()

	const server = createServer(app)
	const pListen = promisify(server.listen.bind(server))

	await pListen(PORT)
	console.info(`Linked Connections server listening on port ${PORT}`)
})()
.catch((err) => {
	console.error(err)
	process.exit(1)
})
