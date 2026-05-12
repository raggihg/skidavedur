# Skíðaveður Ísafjarðarbæjar v13

Static vefur fyrir Netlify.

## Netlify
- Build command: tómt
- Publish directory: `.`

## Windy
Windy PWS mælingar lesa API lykil úr Netlify environment variable:

`vedur_api`

## Prófanir
- `/.netlify/functions/weather?kind=latest`
- `/.netlify/functions/windy-stations`
- `/.netlify/functions/windy-stations?debug=1`
- `/.netlify/functions/warnings`

## v13
- Lagar Windy PWS parsing svo röng/metadata field skili ekki 0 í allt.
- Prófar fleiri möguleg Windy Stations API v2 endpoint fyrir latest observations.
- Bætir við debug endpointi til að sjá hvaða field-nöfn Windy skilar án þess að birta API lykil.
