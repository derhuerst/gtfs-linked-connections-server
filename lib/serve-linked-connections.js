'use strict'

const {strictEqual} = require('assert')
const express = require('express')
const accepts = require('accepts')
const cors = require('cors')
const compression = require('compression')
const {inspect} = require('util')

const supportedMimeTypes = [
	'application/ld+json',
	// todo: support more: https://github.com/linkedconnections/linked-connections-server/blob/aad9de79d2d2b61fe5ca2c24da31961a4d8e9b42/lib/routes/page-finder.js#L250-L279
]
const processAcceptHeader = (req, res, next) => {
	const mimeType = req.accepts(supportedMimeTypes)
	if (mimeType === false) {
		const err = new Error('not acceptable')
		err.statusCode = 406
		next(err)
	} else {
		res.type(mimeType)
		next()
	}
}

const notSupportedYet = (req, res, next) => {
	const err = new Error('not supported yet')
	err.statusCode = 501
	next(err)
}

const respondWithErrors = (err, req, res, next) => {
	const {logger} = req.app.locals

	logger.error(err)
	if (res.headersSent) return next(err)
	res.status(err.statusCode || 500)
	res.json({
		// todo: better format?
		ok: false,
		message: err.message,
		stack: err.stack,
		raw: inspect(err)
	})
	next()
}

const serveLinkedConnections = (cfg) => {
	const {
		findConnections,
		logger,
		handle404,
	} = {
		logger: console,
		handle404: true,
		...cfg,
	}
	strictEqual(typeof findConnections, 'function', 'findConnections must be a function')

	// todo: support path prefix?

	const api = express()
	api.set('etag', 'strong')
	api.locals.logger = logger
	api.use(cors()) // todo: allow/expose more headers?
	api.use(compression())
	// todo: set Vary header

	api.get(
		'/catalog',
		processAcceptHeader,
		notSupportedYet, // todo
	)

	api.get(
		'/stops',
		processAcceptHeader,
		notSupportedYet, // todo
	)
	api.get(
		'/stops/:id',
		processAcceptHeader,
		notSupportedYet, // todo
	)

	api.get(
		'/connections',
		processAcceptHeader,
		(req, res, next) => {
			const query = {}
			if ('departureTime' in req.query) {
				if (Number.isNaN(Date.parse(req.query.departureTime))) {
					const err = new Error('invalid departureTime parameter')
					err.statusCode = 400
					return next(err)
				}
				query['lc:departureTime'] = req.query.departureTime
			}
			if ('arrivalTime' in req.query) {
				if (Number.isNaN(Date.parse(req.query.arrivalTime))) {
					const err = new Error('invalid arrivalTime parameter')
					err.statusCode = 400
					return next(err)
				}
				query['lc:arrivalTime'] = req.query.arrivalTime
			}

			findConnections(query)
			.then(({connections, relations}) => {
				// todo: `tree:path`, `tree:shape`, `tree:view`/`dcterms:isPartOf`, etc
				// todo: relations: `tree:remainingItems` (optional)
				// todo: build tree, send to client
			})
			.catch(next)
		},
	)
	api.get(
		'/connections/:id',
		processAcceptHeader,
		notSupportedYet, // todo
	)

	api.get(
		'/routes',
		processAcceptHeader,
		notSupportedYet, // todo
	)
	api.get(
		'/routes/:id',
		processAcceptHeader,
		notSupportedYet, // todo
	)

	if (handle404) {
		// handle routing fall-through as 404 error
		api.use((req, res, next) => {
			const err = new Error('not found')
			err.statusCode = 404
			next(err)
		})
	}
	api.use(respondWithErrors)

	return api
}

module.exports = serveLinkedConnections
