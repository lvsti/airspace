require('dotenv').config()
const fetch = require('node-fetch')
const fs = require('fs')

function urlForFlightsNearAirport(airport) {
    return new URL("https://data-live.flightradar24.com/zones/fcgi/feed.js?faa=1&satellite=1&mlat=1&flarm=1&adsb=1&air=1&estimated=1&maxage=14400&ems=1&airport=" + airport)
}

function urlForFlightDetails(flightID) {
    return new URL("https://data-live.flightradar24.com/clickhandler/?version=1.5&flight=" + flightID)
}

const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:67.0) Gecko/20100101 Firefox/67.0"

const getNearbyFlights = async (airport) => {
    const response = await fetch(urlForFlightsNearAirport(airport).toString(), { headers: {"User-Agent": userAgent}})
    const body = await response.json()

    delete body.full_count
    delete body.version

    return body
}

const getFlightDetails = async (flightID) => {
    const response = await fetch(urlForFlightDetails(flightID).toString(), { headers: {"User-Agent": userAgent}})
    const body = await response.json()

    return body
}

function haversine_distance(src, dst) {
    const radians = (deg) => {
        return deg * Math.PI / 180.0
    }

    const dlat = radians(dst.lat - src.lat)
    const dlon = radians(dst.lng - src.lng)
    const a = Math.sin(dlat/2) * Math.sin(dlat/2) + Math.cos(radians(src.lat))
        * Math.cos(radians(dst.lat)) * Math.sin(dlon/2) * Math.sin(dlon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return 6371 * c
}

const dumpFlights = async (airport) => {
    const flights = await getNearbyFlights(airport)

    var dir = __dirname + '/airports'
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }

    dir += '/' + airport
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }

    for (const flightID of Object.keys(flights)) {
        const flight = await getFlightDetails(flightID)
        if (flight.airport.destination == null) {
            continue
        }

        var airport_pos = {}
        if (flight.airport.destination.code.iata == airport) {
            airport_pos = {
                lat: flight.airport.destination.position.latitude,
                lng: flight.airport.destination.position.longitude
            }
        }
        else {
            airport_pos = {
                lat: flight.airport.origin.position.latitude,
                lng: flight.airport.origin.position.longitude
            }
        }

        const src = flight.airport.origin.code.iata
        const dst = flight.airport.destination.code.iata

        const trail = flight.trail
        var csv = ''

        for (const p of trail) {
            if (p.alt > process.env.MAX_ALTITUDE_FT || haversine_distance(p, airport_pos) > process.env.MAX_DISTANCE_KM) {
                continue
            }
            csv += [p.ts, p.lat, p.lng, p.alt, p.spd, p.hd].join(',') + "\n"
        }
        if (csv.length > 0) {
            fs.writeFile(dir + '/' + src + '-' + dst + '-' + flightID + '.csv', csv, {}, () => {})
        }
    }
}

const main = async () => {
    await dumpFlights(process.env.AIRPORT)
}

main()