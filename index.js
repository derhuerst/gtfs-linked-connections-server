'use strict'

const {Client: PgClient} = require('pg')
const {stringify: encodeQuery} = require('querystring')
const omit = require('lodash/omit')
const serveLinkedConnections = require('./lib/serve-linked-connections')
const {
	formatConnectionId: defaultFormatConnectionId,
	parseConnectionId: defaultParseConnectionId,
} = require('./lib/connection-ids')

const err400 = (msg, data = {}) => {
	const err = new Error(msg)
	err.statusCode = 400
	Object.assign(err, data)
	return err
}

// todo: Non-normative note: when translating data from GTFS feeds, URIs for gtfs:block, stops, routes and trips should be carefully designed to be persistent across updates of the GTFS feed.

// todo: expose GTFS feed_info.txt as `dcat` metadata

// todo: https://en.wikipedia.org/wiki/Skip_graph

// This follows http://vocab.gtfs.org/gtfs.ttl as of 2021-04-06
// see also https://web.archive.org/web/20201010044144/http://vocab.gtfs.org/gtfs.ttl
// todo: adapt to the current Linked GTFS spec on GitHub
// https://github.com/OpenTransport/linked-gtfs/blob/fc12d51feed4a29cb83384b360de5df8c5c5a7db/spec.md

const defaultStopId = (s) => {
	return s.stop_id
}

const defaultTripId = (t) => {
	return t.trip_id
}

const defaultRouteId = (r) => {
	return r.route_id
}

const serveGtfsAsLinkedConnections = async (opt = {}) => {
	const {
		getDbClient,
		stopId,
		connectionId: formatConnectionId,
		parseConnectionId,
		tripId,
		routeId,
	} = {
		getDbClient: async () => {
			const db = new PgClient()
			await db.connect()
			return db
		},
		// todo: hooks to transform a formatted stop/station/route/trip/connection
		stopId: defaultStopId,
		// todo [breaking]: rename to formatConnectionId
		connectionId: defaultFormatConnectionId,
		parseConnectionId: defaultParseConnectionId,
		tripId: defaultTripId,
		routeId: defaultRouteId,
		...opt,
	}

	const db = await getDbClient()

	const formatCoords = (lon, lat) => {
		if ('number' !== typeof lon || 'number' !== typeof lat) return null
		return `POINT (${lon} ${lat})`
	}
	const formatStop = (s) => {
		return {
			'@id': `/stops/${encodeURIComponent(stopId(s))}`,
			'@type': 'gtfs:Stop',
			'rdfs:label': s.stop_name || null,
			'geosparql:asWkt': formatCoords(s.stop_lon, s.stop_lat),
			'parentStation': s.station_id ? {
				'@id': `/stops/${encodeURIComponent(s.station_id)}`, // todo: use stopId()
				'@type': 'gtfs:Station',
				'rdfs:label': s.station_name || null,
				'geosparql:asWkt': formatCoords(s.station_lon, s.station_lat),
				'code': s.station_code || null,
				'wheelchairBoarding': s.station_wheelchair_boarding || null,
			} : null,
			'code': s.stop_code || null,
			'wheelchairBoarding': s.wheelchair_boarding || null,
			'platformCode': s.platform_code || null,
			// todo: timeZone
		}
	}

	const formatConnection = (c) => {
		return {
			'@id': `/connections/${encodeURIComponent(formatConnectionId(c))}`,
			'@type': 'lc:Connection',
			'departureTime': c.t_departure,
			'departureDelay': null,
			'departureStop': formatStop({
				stop_id: c.from_stop_id,
				stop_name: c.from_stop_name,
				// todo: stop_lon, stop_lat
				// todo: platform_code, stop_code, wheelchair_boarding
				station_id: c.from_station_id,
				station_name: c.from_station_name,
				// todo: station_lon, station_lat
				// todo: station_wheelchair_boarding
			}),
			'arrivalTime': c.t_arrival,
			'arrivalDelay': null,
			'arrivalStop': formatStop({
				stop_id: c.to_stop_id,
				stop_name: c.to_stop_name,
				// todo: stop_lon, stop_lat
				// todo: platform_code, stop_code, wheelchair_boarding
				station_id: c.to_station_id,
				station_name: c.to_station_name,
				// todo: station_lon, station_lat
				// todo: station_wheelchair_boarding
			}),
			'gtfs:trip': {
				// todo: pass full trip into tripId()
				'@id': `/trips/${encodeURIComponent(tripId({trip_id: c.trip_id}))}`,
				'@type': 'gtfs:Trip',
				'gtfs:route': {
					// todo: pass full route into routeId()
					'@id': `/routes/${encodeURIComponent(routeId({route_id: c.route_id}))}`,
					// todo: route_short_name as gtfs:shortName
					// todo: route_long_name as gtfs:longName
					// todo: route_route_type as gtfs:routeType
					// todo: route.agency_id as gtfs:agency
				},
				// todo: trip.short_name as gtfs:shortName
				// todo: trip.wheelchair_accessible
				// todo: trip.headsign as gtfs:headsign
				// todo: gtfs:block
				// todo: trip.direction as gtfs:direction
				// todo: gtfs:shape
				// todo: trip.bikes_allowed as gtfs:bikesAllowed
			},
			'gtfs:pickupType': c.from_pickup_type,
			'gtfs:dropOffType': c.to_drop_off_type,
		}
	}

	const findConnections = async (query) => {
		const {
			// todo: rename to minDepartureTime, add maxDepartureTime
			'lc:departureTime': departureTime,
			// todo: rename to maxArrivalTime, add minArrivalTime
			'lc:arrivalTime': arrivalTime,
		} = query

		const values = []
		let filters = 'True'
		let orderBy = 't_departure'
		if (departureTime) {
			values.push(new Date(departureTime).toISOString())
			filters += ` AND t_departure >= $${values.length}`

			const dayBefore = new Date(new Date(departureTime) - 24 * 60 * 60 * 1000).toISOString()
			// todo: handle timezones properly
			// todo: make this offset configurable
			values.push(dayBefore.slice(0, 4 + 1 + 2 + 1 + 2)) // local date, without time
			filters += ` AND "date" >= $${values.length}`
		} else if (arrivalTime) {
			const iso = new Date(arrivalTime).toISOString()
			values.push(iso)
			filters += ` AND t_arrival <= $${values.length}`

			// todo: handle timezones properly
			// todo: make this offset configurable
			values.push(iso.slice(0, 4 + 1 + 2 + 1 + 2)) // local date, without time
			filters += ` AND "date" <= $${values.length}`

			orderBy = 't_arrival'
		}
		// todo: fail if both departureTime & arrivalTime
		// todo: support more filters

		const res = await db.query({
			// todo: add `name` to enable prepared statements
			text: `
				SELECT * -- todo: specific fields
				FROM connections
				WHERE ${filters}
				ORDER BY ${orderBy}
				LIMIT 10 -- todo: make customisable
			`,
			values,
		})
		const lastRow = res.rows[res.rows.length - 1]
		// todo: what if there are 0 rows?

		return {
			connections: res.rows.map(formatConnection),
			// todo: sth like version or Last-Modified
			relations: [{
				// todo: more than `LIMIT` connections with one t_dep? add offset?
				'@type': 'tree:GreaterThanOrEqualToRelation',
				'tree:node': '?' + encodeQuery({
					...omit(query, ['lc:arrivalTime']),
					'lc:departureTime': lastRow.t_departure.toISOString(),
				}),
				'tree:path': 'lc:departureTime',
				'tree:value': {
					"@type": "http://www.w3.org/2001/XMLSchema#dateTime",
					"@value": lastRow.t_departure.toISOString(),
				}
			}, {
				// todo: more than `LIMIT` connections with one t_arr? add offset?
				'@type': 'tree:SmallerThanOrEqualToRelation',
				'tree:node': '?' + encodeQuery({
					...omit(query, ['lc:departureTime']),
					'lc:arrivalTime': lastRow.t_arrival.toISOString(),
				}),
				'tree:path': 'lc:arrivalTime',
				'tree:value': {
					"@type": "http://www.w3.org/2001/XMLSchema#dateTime",
					"@value": lastRow.t_arrival.toISOString(),
				}
			}],
		}
	}

	const getConnection = async (id) => {
		const {
			trip_id,
			from_stop_id,
			t_departure,
			t_arrival,
			to_stop_id,
		} = parseConnectionId(id)
		if (!trip_id) throw err400('invalid connection ID: missing trip_id')
		if (!from_stop_id) throw err400('invalid connection ID: missing from_stop_id')
		if (!t_departure) throw err400('invalid connection ID: missing/invalid t_departure')
		if (!t_arrival) throw err400('invalid connection ID: missing/invalid t_arrival')
		if (!to_stop_id) throw err400('invalid connection ID: missing to_stop_id')

		const res = await db.query({
			// todo: add `name` to enable prepared statements
			text: `
				SELECT * -- todo: specific fields
				FROM connections
				WHERE trip_id = $1
				AND from_stop_id = $2 AND to_stop_id = $3
				AND t_departure = $4 AND t_arrival = $5
				LIMIT 2
			`,
			values: [
				trip_id,
				from_stop_id, to_stop_id,
				t_departure, t_arrival,
			],
		})
		if (res.rows.length === 0) {
			const err = new Error('no such connection')
			err.statusCode = 404
			throw err
		}
		if (res.rows.length > 1) {
			const err = new Error('connection signature matches >1 connection')
			err.statusCode = 500
			throw err
		}
		const [c] = res.rows

		return formatConnection(c)
	}

	return serveLinkedConnections({
		...opt,
		findConnections,
		getConnection,
	})
}

module.exports = serveGtfsAsLinkedConnections
