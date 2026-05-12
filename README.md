# Skíðaveður Ísafjarðarbæjar v10 hotfix

Hotfix fyrir mælingar:
- Veðurstofu-mælingar eru sóttar fyrst með `hour/latest`, svo prófar kerfið 10 mín. endpoint sem fallback.
- Windy PWS bilun stoppar ekki lengur Veðurstofu-töfluna.
- Staða sést efst: `Veðurstofan OK/bíður` og `Windy PWS OK/bíður`.

Prófun eftir deploy:
- `/.netlify/functions/weather?kind=latest`
- `/.netlify/functions/windy-stations`

Ath: Windy Map Forecast API lykillinn virkar fyrir kort/forecast layers, en PWS/station gögn geta þurft aðra Stations/PWS þjónustu. Þess vegna er Windy gert mjúklega þannig að það brýtur ekki mælaborðið.
