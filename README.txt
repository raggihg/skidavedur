Skíðaveður Ísafjörður v6 - hotfix

Settu allar skrárnar í root á GitHub repo-inu og deploy-aðu á Netlify.

Netlify stillingar:
- Build command: tómt
- Publish directory: .

Nýtt í v6:
- Veðurstöðvar sóttar í gegnum Netlify Function: /.netlify/functions/weather?kind=latest
- Þetta minnkar líkur á CORS-vandamálum og gerir kóðann minna viðkvæman fyrir station query breytum.
- Function sækir nýjustu AWS mælingar frá api.vedur.is og síar niður í 2641, 2644 og 2636.
- Klukkustundaspá og viðvaranir fara líka í gegnum sama proxy.
- Ef sögulegar 24 klst. mælingar svara ekki sýnir vefurinn skilaboð án þess að fella live stöðvarnar.

Til að prófa eftir deploy:
1. Opnaðu https://þitt-netlify-nafn.netlify.app/.netlify/functions/weather?kind=latest
2. Ef JSON birtist þar, virkar proxy-ið.
3. Opnaðu forsíðuna og endurhlaðaðu með Ctrl/Cmd + Shift + R.
