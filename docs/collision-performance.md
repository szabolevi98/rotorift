# Bekészített ütközési geometria és talajközeli teljesítmény

2026. október 13. A Racingben alkalmazott bekészített geometria elve alapján
a Rotorift is kész ütközési fájlokat tölt a két pályához.

## Mi változott?

Az építkezés eredetileg közel 5000 külön Rapier alakzatot készített. A liget
a környező darabokhoz újabb talaj- és faalakzatokat hozott létre repülés közben.
Egy épület mellett a 40 m-es fizikai környezet több száz alakzatot tartott aktívan.

Az új build ugyanazokból a procedurális pályaépítőkből összegyűjti a valóban
szilárd részeket. A dobozfelületek és meglévő háromszöghálók 32 m-es térbeli
részekbe összevont hálók lesznek. Távol a pályától nagyobb részeket használunk.
A gömbök, hengerek és kúpok pontos analitikus alakzata megmarad: a fa koronája
és a kör alakú részek nem kapnak durvább, szögletes ütközést.

Az eredmény tömörített, tartalomhash-sel elnevezett `.rrc` fájl. A liget kb.
3,47 MB, az építkezés 2,28 MB letöltés; első alkalommal a töltőképernyő mutatja
a letöltést és fizikai előkészítést. Egy böngészőoldalon a már letöltött adatok
újrahasználhatók. A Wasm alakzatok a repülés előtt elkészülnek; a látványépítő
ilyen esetben kihagyja a saját ütköző alakzatok létrehozását.

A fizikai környezet 18 m-es, és a sebesség irányában 0,35 s előretekintést ad.
4 m mozgás vagy jelentősebb sebességváltozás újraellenőrzi az aktív részeket.
A teljes AABB számít, így hosszú födémek és gerendák nem tűnnek el a középpontjuk
távolsága miatt. A látvány betöltése ettől független, objektumokat nem tüntetünk el.

A liget részletes, bekészített talaja -512…512 m között fedi a játékteret.
Ezen túl ugyanabból a terepfüggvényből készül a közvetlen közelben szükséges
csupasz talaj. A kerítésen túl továbbra is lehet repülni és a távoli föld látszik.
A kapuk a kiválasztott versenyútvonal szerint külön készülnek, kapcsolhatók maradnak.

Régi vagy hibás fájl, illetve hiányzó böngészős kitömörítés esetén a játék
a procedurális ütközési geometriát használja. A bekészített változat alapútja
a gzip kitömörítését támogató böngészőben használható; a fallback a játszhatóságot tartja meg.

## Mért eredmények

Node + tényleges Rapier/DronePhysics, négy 240 Hz-es fizikai lépés egy mintában,
360 minta, előzetes bemelegítés; a régi 40 m-es, külön alakzatos és az új
bekészített változat összevetése. Ez a fizika részideje, nem teljes képkocka vagy FPS.

| Helyzet | Korábbi fizika | Bekészített fizika |
| --- | ---: | ---: |
| Építkezés: talaj a kezdőúton | 0,47 ms | 0,16 ms |
| Építkezés: épület első szintje | 1,33 ms | 0,15 ms |
| Építkezés: felső épületszint | 1,28 ms | 0,13 ms |
| Liget: talaj a kezdőhely közelében | 0,95 ms | 0,11 ms |
| Liget: központi átjáró | 1,39 ms | 0,19 ms |
| Liget: központi felső helyiség | 1,28 ms | 0,15 ms |

Az építkezési mérőpontban 562 helyett 11, a liget átjárójában 8 bekészített
alakzat aktív. A fenti mérés helyzete és ideje reprodukálható; más gépen az
abszolút idők eltérnek. A Three rajzolásának, árnyékoknak és GPU-nak külön költsége van.

A `/performance.html?physics=prepared&variant=moving` böngészős mérőoldal
a fizika, ütközési frissítés és GPU-val megvárt rajzolás költségét külön mutatja.
A `physics=procedural` a futáskor készített változatot méri az új, szűkített
fizikai környezettel. A GPU-mérésben a pályageometria, draw callok és háromszögszám
megmaradnak; az optimalizálás az ütközési munkát csökkenti.

## Újragenerálás és ellenőrzés

`npm run collisions:build` csak a fizikát készíti elő, `npm run maps:build`
a burkolatokat és a fizikát is. A fájlok a `web/assets/collisions` mappában,
a generált manifest a `shared/world/collision-assets.js` fájlban van.
A teszt a geometriaforrások és mapverziók hash-ét is ellenőrzi, így elavult fájl
nem marad észrevétlen. Nincs külön npm függőség.

A geometriai tesztek ellenőrzik a nyitott épületszinteket/födémaknákat, oszlopokat,
csövek belsejét, a központi parkátjárót, talajmagasságot, pályán túli talajt,
30%-os gázzal felszállást és 60 m/s-os oszlopütközést CCD-vel. A sebességfüggő
aktiválás irányváltáskor, mozdulatlan helyzetből is ellenőrzött.
