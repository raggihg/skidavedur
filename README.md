# Skíðaveður Ísafjarðarbæjar v11

Static vefur fyrir Netlify.

## Netlify
- Build command: tómt
- Publish directory: `.`

## Windy
Windy kortið notar Map Forecast / embed. Windy PWS mælingar nota Stations API. Ef PWS mælingar birtast ekki skaltu setja sérstakan lykil í Netlify:

`WINDY_STATIONS_API_KEY=...`

Ef þú ert bara með Map Forecast lykil má hann vera sem `WINDY_API_KEY`, en hann dugar ekki alltaf fyrir PWS/station observations.

## Prófanir
- `/.netlify/functions/weather?kind=latest`
- `/.netlify/functions/windy-stations`
- `/.netlify/functions/warnings`
