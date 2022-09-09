'use strict'

const {strictEqual} = require('assert')
const express = require('express')
const accepts = require('accepts')
const cors = require('cors')
const compression = require('compression')
const {inspect} = require('util')
const parseISO8601String = require('date-fns/parseISO')
const pick = require('lodash/pick')

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

const err = (statusCode, msg, fields = {}) => {
	const err = new Error(msg)
	err.statusCode = statusCode
	Object.assign(err, fields)
	return err
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

const ctx = {
	xsd: 'http://www.w3.org/2001/XMLSchema#',
	lc: 'http://example.org/lc/2.0/schema', // todo: find correct URL for LC 2.0
	tree: 'https://w3id.org/tree#',
	rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
	geosparql: 'http://www.opengis.net/ont/geosparql#',
	hydra: 'http://www.w3.org/ns/hydra/core#',
}

const serveLinkedConnections = (cfg) => {
	const {
		findStops,
		findConnections,
		getConnection,
		logger,
		handle404,
	} = {
		logger: console,
		handle404: true,
		...cfg,
	}
	strictEqual(typeof findStops, 'function', 'findStops must be a function')
	strictEqual(typeof findConnections, 'function', 'findConnections must be a function')

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
		(req, res, next) => {
			const query = pick(req.query, [
				'before',
				'after',
			])
			// todo: allow geospatial filtering
			// todo: allow keyset pagination
			// todo: special case: 0 query params

			findStops(query)
			.then(({stops, relations}) => {
				res.json({
					'@context': ctx,
					'@id': '/stops',
					'@type': 'tree:Collection',
					// todo: rdfs:label via cfg.collectionsLabel?
					'tree:view': {
						// todo: @id
						'@type': 'tree:Node',
						// todo: add hydra metadata
						'tree:relation': relations,
						// todo:
						// - tree:relation
						// - tree:remainingItems
						// - tree:search
					},
					'tree:member': stops,
					// todo: tree:shape?
				})
				next()
			})
			.catch(next)
		},
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
			if ('lc:departureTime' in req.query) {
				const dep = parseISO8601String(req.query['lc:departureTime'])
				if (Number.isNaN(+dep)) {
					return next(err(400, 'invalid departureTime parameter, must be ISO 8601'))
				}
				// todo [breaking]: use parsed Date
				query['lc:departureTime'] = req.query['lc:departureTime']
			}
			if ('lc:arrivalTime' in req.query) {
				const arr = parseISO8601String(req.query['lc:arrivalTime'])
				if (Number.isNaN(+arr)) {
					return next(err(400, 'invalid arrivalTime parameter, must be ISO 8601'))
				}
				// todo [breaking]: use parsed Date
				query['lc:arrivalTime'] = req.query['lc:arrivalTime']
			}

			// todo: special case: 0 query params

			findConnections(query)
			.then(({connections, relations}) => {
				res.json({
					'@context': ctx,
					'@id': '/connections',
					'@type': 'tree:Collection',
					// todo: rdfs:label via cfg.collectionsLabel?
					'tree:view': {
						// todo: @id
						'@type': 'tree:Node',
						// todo: add hydra metadata
						'tree:relation': relations,
						// todo:
						// - tree:relation
						// - tree:remainingItems
						// - tree:search
					},
					'tree:member': connections,
					// todo: tree:shape?
				})
				next()
			})
			.catch(next)
		},
	)
	api.get(
		'/connections/:id',
		processAcceptHeader,
		(req, res, next) => {
			// req.params.id is *not* URL-encoded
			const {id} = req.params

			getConnection(id)
			.then((connection) => {
				res.json({
					...connection,
					'@context': ctx,
				})
				next()
			})
			.catch(next)
		},
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
			next(err(404, 'not found', {url: req.url}))
		})
	}
	api.use(respondWithErrors)

	return api
}

module.exports = serveLinkedConnections
