'use strict'

const serveLinkedConnections = require('./lib/serve-linked-connections')

const serveGtfsAsLinkedConnections = (opt = {}) => {
	const formatCoords = (lon, lat) => {
		if ('number' !== typeof lon || 'number' !== typeof lat) return null
		return `POINT (${lon} ${lat})`
	}
	const formatStop = (s) => {
		return {
			'id': s.stop_id, // todo: rename key?
			'rdfs:label': s.stop_name || null,
			'geosparql:asWkt': formatCoords(s.stop_lon, s.stop_lat),
			'gtfs:parentStation': s.station_id ? {
				'id': s.station_id, // todo: rename key?
				'rdfs:label': s.station_name || null,
				'geosparql:asWkt': formatCoords(s.station_lon, s.station_lat),
				'gtfs:code': s.station_code || null,
				'gtfs:wheelchairBoarding': s.station_wheelchair_boarding || null,
			} : null,
			'gtfs:code': s.stop_code || null,
			'gtfs:wheelchairBoarding': s.wheelchair_boarding || null,
			'gtfs:platformCode': s.platform_code || null,
		}
	}

	const formatConnection = (c) => {
		return {
			'lc:departureTime': c.t_departure,
			'lc:departureDelay': null,
			'lc:departureStop': formatStop({
				stop_id: c.from_stop_id,
				stop_name: c.from_stop_name,
				// todo: stop_lon, stop_lat
				// todo: platform_code, stop_code, wheelchair_boarding
				station_id: c.from_station_id,
				station_name: c.from_station_name,
				// todo: station_lon, station_lat
				// todo: station_wheelchair_boarding
			}),
			'lc:arrivalTime': c.t_arrival,
			'lc:arrivalDelay': null,
			'lc:departureStop': formatStop({
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
				'id': c.trip_id, // todo: rename key?
				'gtfs:route': {
					'id': c.route_id, // todo: rename key?
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
