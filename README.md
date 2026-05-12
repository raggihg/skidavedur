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


## v12
- Windy Stations API lykill lesinn úr Netlify breytunni `vedur_api`.
- Veðurspá næsta sólarhrings er sýnd á heilum tímum.
- Veðurtákn bætt við spá: sól, ský, rigning, snjókoma o.fl.
- Þróun síðustu 24 klst. áfram sýnd sem sérstakt graf og undirbúin fyrir frekari þróun.
