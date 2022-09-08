const pbf = require('protobufjs/light')
const {ok, strictEqual,deepStrictEqual} = require('assert')

// package gtfs_linked_connections_server;
// syntax = "proto3";
// message ConnectionId {
// 	string trip_id = 1;
// 	string from_stop_id = 2;
// 	// these overflow at 2106-02-07T06:28:15Z
// 	uint32 t_departure = 3;
// 	uint32 t_arrival = 4;
// 	string to_stop_id = 5;
// }
const schemaRoot = {
	"nested": {
		"gtfs_linked_connections_server": {
			"nested": {
				"ConnectionId": {
					"fields": {
						"trip_id": {
							"type": "string",
							"id": 1
						},
						"from_stop_id": {
							"type": "string",
							"id": 2
						},
						"t_departure": {
							"type": "uint32",
							"id": 3
						},
						"t_arrival": {
							"type": "uint32",
							"id": 4
						},
						"to_stop_id": {
							"type": "string",
							"id": 5
						}
					}
				}
			}
		}
	}
}

const root = pbf.Root.fromJSON(schemaRoot)
const ConnectionId = root.lookup('ConnectionId')

const formatConnectionId = (connection) => {
	ok(connection.trip_id, 'connection.trip_id must not be null/empty')
	ok(connection.from_stop_id, 'connection.from_stop_id must not be null/empty')
	ok(connection.to_stop_id, 'connection.to_stop_id must not be null/empty')
	const con = {
		trip_id: connection.trip_id,
		from_stop_id: connection.from_stop_id,
		t_departure: new Date(connection.t_departure) / 1000 | 0,
		t_arrival: new Date(connection.t_arrival) / 1000 | 0,
		to_stop_id: connection.to_stop_id,
	}
	ok(!Number.isNaN(con.t_departure), 'connection.t_departure must be an ISO 8601 string')
	ok(!Number.isNaN(con.t_arrival), 'connection.t_arrival must be an ISO 8601 string')
	ConnectionId.verify(con)
	return ConnectionId.encode(con).finish().toString('base64')
}

const parseConnectionId = (id) => {
	const {
		trip_id,
		from_stop_id,
		t_departure,
		t_arrival,
		to_stop_id,
	} = ConnectionId.decode(Buffer.from(id, 'base64')).toJSON()
	return {
		trip_id,
		from_stop_id,
		t_departure: new Date(t_departure * 1000).toISOString(),
		t_arrival: new Date(t_arrival * 1000).toISOString(),
		to_stop_id,
	}
}

const c1 = {
	trip_id: 'foo',
	from_stop_id: 'bar',
	to_stop_id: 'baz',
	t_departure: '2022-09-09T09:09:09.000Z',
	t_arrival: '2022-10-10T10:10:10.000Z',
}
strictEqual(formatConnectionId(c1), 'CgNmb28SA2Jhchi1heyYBiCC34+aBioDYmF6')
deepStrictEqual(parseConnectionId(formatConnectionId(c1)), c1)

module.exports = {
	formatConnectionId,
	parseConnectionId,
}
