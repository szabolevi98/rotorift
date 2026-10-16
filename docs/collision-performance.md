# Bekészített ütközési geometria és talajközeli teljesítmény

Aktuális állapot (2026-10-16): mind a négy pálya — Liget, Betonudvar,
Játszótér és Skyline — előre elkészített ütközési fájlokat használ.
Az alábbi 2026. október 13-i javítás és mérései az akkori három pályára vonatkoznak.

## Whoop FPS-esés javítása az akadályok közelében

A 75-ös drónnal a játszótéri vár alatt reprodukálható volt a lassulás:
egy 240 Hz-es fizikai lépés 19,53 ms, a torony mellett 38,97 ms lett.
Távolabb ugyanaz a drón 0,51 ms alatt számolódott. A képkockánként esedékes
több fizikai lépés ezért önmagában felélte a teljes képkockaidőt.

A bake korábban az egyszerű dobozokat is térbeli háromszöghálókba vonta össze.
A whoop 48 vékony, domború védőívének folyamatos ütközésvizsgálata (CCD)
ezekkel a hálókkal lett rendkívül drága. Most a gerendák, födémek, burkolatok
és a játszótér végtelen talaja az eredeti, analitikus dobozalakzat marad.
Valódi háromszöghálót csak a valóban összetett felületeknél használunk.
Mindhárom pálya ütközési fájlja újragenerálva; a látvány és a CCD megmarad.

Azonos helyi Node/Rapier mérés (7 m/s, azonos pozíció visszaállítva,
80 lépés, 11 bemelegítő kihagyva):

| Rift 75 helyzet | Korábbi lépés | Javított lépés |
| --- | ---: | ---: |
| Vár alatt, 0,7 m magasság | 19,53 ms | 0,45 ms |
| Torony mellett, 0,7 m magasság | 38,97 ms | 0,44 ms |
| Talaj felett, 0,15 m magasság | 20,15 ms | 0,40 ms |

A böngészős ellenőrzésben (GTX 1080 / ANGLE, 1280×504) négy fizikai lépés
a vár alatt 1,90 ms, a torony mellett 1,66 ms, talajközelben 1,66 ms.
A külön, GPU-val megvárt rajzolás ezekben a pontokban 0,50–0,57 ms volt.
A Liget épületében négy lépés 1,44–1,66 ms, a Betonudvar épületszintjein
2,13 ms volt. Ezek részidők, nem teljes játékbeli FPS-ígéretek.

Reprodukció: `/performance.html?map=jatszoter&physics=prepared&drone=rift-75&hold=1`.
A `map` és `drone` paraméter más pályát/drónt is enged; a `hold` a mért pontban
tartja a drónt 7 m/s-os tesztsebességgel. A mérőoldal mentett beállítást nem módosít.
Új regresszióteszt tiltja az egyszerű játszótéri részek hálóvá alakítását,
és ellenőrzi a nyitott átjárót, szilárd födémet, oszlopot és külső talajt.

## Mi változott?

Az építkezés eredetileg közel 5000 külön Rapier alakzatot készített. A liget
a környező darabokhoz újabb talaj- és faalakzatokat hozott létre repülés közben.
Egy épület mellett a 40 m-es fizikai környezet több száz alakzatot tartott aktívan.

Az új build ugyanazokból a procedurális pályaépítőkből összegyűjti a valóban
szilárd részeket. Az összetett háromszöghálók 32 m-es térbeli
részekbe összevont hálók lesznek. Távol a pályától nagyobb részeket használunk.
A dobozok, gömbök, hengerek és kúpok pontos analitikus alakzata megmarad: a fa koronája
és a kör alakú részek nem kapnak durvább, szögletes ütközést.

Az eredmény tömörített, tartalomhash-sel elnevezett `.rrc` fájl. A liget kb.
3,42 MB, az építkezés 1,97 MB, a játszótér 19 kB letöltés; első alkalommal a töltőképernyő mutatja
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

## A korábbi, X5-tel végzett mérés eredményei

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

## Rift 65: terep miatti CCD-tüske (2026-10-15)

A beküldött diagnosztika a ligetben, a `[43.698, 3.876, 22.115]` környékén
133 ms-os képkockát mért: ebből 122 ms a fizika, 24 bepótolt 240 Hz-es lépéssel.
A GPU közben 6–10 ms körül maradt. A rögzítés már az akadás közben kezdődik,
így egy korábbi háttérterhelés szerepe ebből nem állapítható meg.

Az akadást külső terhelés nélkül is elő lehetett idézni. A 32 m-es, lejtős
talajháló AABB-ja olyan üres légteret is lefedett, amely több méterrel a helyi
felszín felett van. A Rapier 0.14 folyamatos ütközésvizsgálata (CCD) ebben
költséges háromszögháló-vizsgálatot végzett. A háló ideiglenes kikapcsolásával
a tüske megszűnt; a védőkeretek és propellerek külön kikapcsolása nem oldotta meg.

A sütő a teljes, szabályos rácsokat most natív `heightfield` alakzatként menti.
A magasságok, a háromszögátlók, a fizikai felszín és az ütközési elemszám
megmaradnak. Lyukas, szabálytalan, többszintes vagy eltérő átlójú hálót nem
alakítunk át. Az útburkolatok és az összetett geometria szükség szerint
háromszögháló marad; az analitikus alkatrészek változatlanok.

Az összehasonlítást a `node scripts/measure-terrain-ccd.mjs` futtatja:
ugyanaz a rács, azonos Rift 65, bekapcsolt CCD, 9 aktív statikus elem,
rögzített pozíció/forgás és vezérelt `[0.3,3.5,7.5]` m/s sebesség. Az utóbbi
kontrollált reprodukciós bemenet; a régi napló nem tartalmazta a pontos forgást
vagy sebességet. A mentett helyi mérés: `docs/terrain-ccd-measurements.json`.

| Magasság a mérőpontban | Háló: medián/lépés | Heightfield: medián/lépés |
| --- | ---: | ---: |
| 1 m | 7,150 ms | 0,529 ms |
| 2 m | 6,326 ms | 0,275 ms |
| 3,526 m | 6,338 ms | 0,224 ms |
| 3,876 m | 4,660 ms | 0,212 ms |
| 4,239 m | 4,634 ms | 0,222 ms |

Ez a fizika részideje, nem általános FPS-ígéret. A 240 Hz-es lépésköz és
a monitorfrissítéstől független időzítés megmarad. A böngészős mérőoldal
`terrain-hotspot` és `terrain-low` pozíciói is ezt a környéket vizsgálják.
A diagnosztika most már sebességet, forgást, szögsebességet és a legdrágább
egyetlen fizikai lépést is exportálja a későbbi akadások elkülönítéséhez.
