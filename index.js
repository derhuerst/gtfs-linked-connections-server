'use strict'

const serveLinkedConnections = require('./lib/serve-linked-connections')

const serveGtfsAsLinkedConnections = (opt = {}) => {
	const findConnections = async (todo) => {
		// todo
		return []
	}

	return serveLinkedConnections({
		...opt,
		findConnections,
	})
}

module.exports = serveGtfsAsLinkedConnections
