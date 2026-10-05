# Road Trip Planner

Plans the best closed route through your stops (a Hamiltonian cycle / travelling salesman tour),
balancing driving time against fuel, tolls and hotels, using real road data from OpenStreetMap.

It started as a master's degree project in R, where I solved the travelling salesman
problem with `ompr` and GLPK for 13 cities in California. This version turns the same idea
into a web app anyone can use for their own trips.

## Features
- City search (OpenStreetMap Nominatim) with the type of each place shown
- Real road distances and drive times (OSRM) and the route drawn on a Leaflet map
- Exact optimal order for up to 14 stops (Held-Karp), fast approximation above that
- Cost = fuel + tolls + the value you put on your time
- Multi-day plan with a daily driving limit, overnight stops and hotel cost
- Currency converter using the official daily ECB reference rates
- Save trips in the browser, export and import them as files

## Run it
1. Install Node.js 18 or newer from https://nodejs.org
2. Create a file `contact.txt` next to `server.js` containing only your email address
   (the free Nominatim service asks for a contact; this file is not uploaded to GitHub).
3. In this folder run `node server.js`
4. Open http://localhost:3000

## How it works
- `server.js` is a small dependency-free proxy for Nominatim, OSRM and the ECB rates.
- `public/index.html` holds the interface and the route solver.
- Leg cost = distance x (fuel cost per km + toll per km) + hours x value of one hour.

## Limits
- Tolls are an estimate you enter; the routing service has no toll prices.
- The free public OSRM and Nominatim servers are for light use only.
- Exchange rates are reference rates for planning, not bank rates.
- Overnight stops on long legs are points on the road, not real towns.

## Screenshots
Example trip through Poland (`example_Poland/`):

- Route: `example_Poland/trasa_Polska.png`
- Cheapest plan (value of 1 hour = 0): `example_Poland/save_money_more_time.png`
- Fastest plan (value of 1 hour = 100): `example_Poland/save_time_more_money.png`
