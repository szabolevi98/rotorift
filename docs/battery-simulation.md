# Akkumulátorszimuláció – 2026. október 13.

Az akkumulátor továbbra is opcionális. Online szobában a házigazda kapcsolja,
a szoba szabálya minden pilótára érvényes. A fogyasztást a repülő drón motorjai
határozzák meg; a HUD az ebből számított telemetriát mutatja. Reset új akkumulátort ad.

## Elektromos modell

- Tényleges motoronkénti tolóerőből becsült áram: lineáris motorveszteség-tag
  és `thrust^1.5` tag keveréke, valamint drónonkénti alapfogyasztás. Az összes
  motor áramából integrált mAh adja a töltöttséget. Kikapcsolt motorokkal a
  repülésszimulációban nincs fogyasztás; tárolási/menüfogyasztást nem modellezünk.
- Darabonként lineáris nyugalmi cellafeszültség-görbe: kezdeti gyors esés,
  hosszabb plató, merülés végi térd. A 65/C3 LiHV teljes cellafeszültsége 4,35 V,
  az X5 konfigurált LiPo-é 4,20 V.
- Belső ellenállásból azonnali `I × R` feszültségesés; a belső ellenállás
  a töltöttség csökkenésével nő. Egy elsőrendű RC ág további terhelési esést
  és néhány másodperces visszaállást ad gázelvétel után. A visszaálló feszültség
  nem tölti vissza a kapacitást.
- A kapocsfeszültség a motorok elérhető tolóerejét is befolyásolja. Friss
  akkumulátor valamivel erősebb, gyenge akkumulátor kisebb teljesítményt ad;
  ez csak bekapcsolt akkumulátorszimulációnál érvényes.
- LOW BATTERY 20% töltöttségnél vagy tartósan alacsony terhelt feszültségnél.
  LAND NOW 7% tartaléknál vagy tartósan 3,15 V/cella alatt. Rövid terhelési
  tüskét szűrünk; a figyelmeztetés resetig megmarad.
- LAND NOW alatt a gáz korlátozott: a tartalék elején marad leszállási erő,
  a tartalék végén csökken. Teljesen elfogyott kapacitásnál két másodperces
  teljesítménylefutás után megszűnik a motorok meghajtása; az üres akkumulátor
  nem ad korlátlan ideig tolóerőt.

Az RC modell felépítésének támpontja a
[Comparative Research on RC Equivalent Circuit Models for Lithium-Ion Batteries](https://www.mdpi.com/2076-3417/7/10/1002)
tanulmány. A saját görbe, ellenállások és áramparaméterek játékbeli hangolási
becslések; nincsenek konkrét FPV akkumulátor méréséből azonosítva. Nem modellezünk
hőmérsékletet, öregedést vagy egyedi cellaeltéréseket.

## Drónonkénti paraméterek

| Paraméter | Rift 65 | Rift C3 | Rift X5 |
| --- | --- | --- | --- |
| Kapacitás | 300 mAh / 1S | 720 mAh / 4S | 1300 mAh / 6S |
| Teljes cellafeszültség | 4,35 V | 4,35 V | 4,20 V |
| Áram referencia maximuma, alapfogyasztás nélkül | 14 A | 38 A | 95 A |
| Lineáris áramtag aránya | 0,82 | 0,50 | 0,70 |
| Csomag belső ellenállása | 0,035 Ω | 0,025 Ω | 0,024 Ω |
| Polarizációs ellenállás | 0,012 Ω | 0,012 Ω | 0,010 Ω |
| Visszaállási időállandó | 2,5 s | 3 s | 3 s |

A mezők a drón JSON-jában vannak; a validátor a hibás értékeket induláskor
elutasítja. Az ellenállások a teljes csomagra értendők. A konfigurációk 5-ös
verziót és új hash-t kaptak, így az új hangolás külön rekordkategória.

## Repülési mérés

Valódi Rapier + DronePhysics, 240 Hz, szélcsend, sérülés és propwash nélkül,
semleges botokkal. A mérőprogram a változó akkufeszültséghez igazította a gázt,
hogy lebegjen; a játék nem kap automatikus magasságtartást.

| Mért érték | Rift 65 | Rift C3 | Rift X5 |
| --- | --- | --- | --- |
| Lebegési áram 30 s-nál | 2,68 A | 5,85 A | 11,92 A |
| LOW BATTERY első jelzése | 5:08 | 5:54 | 5:14 |
| LAND NOW első jelzése | 6:15 | 6:52 | 6:05 |

Ezek nyugodt lebegési eredmények, nem garantált repülési idők. Aktív freestyle
és nagy gáz lényegesen gyorsabban merít. A becsült hátralévő idő öt másodperces
átlagáramból számol a tartalékig; repülési stílusváltás után fokozatosan alkalmazkodik.

## Kijelző és ellenőrzés

Az ARM fölötti nagy kártya akkumulátorikont és töltöttséget, csomag- és
cellafeszültséget, valamint élesített állapotban becsült hátralévő időt mutat.
Alacsony töltöttségnél sárga, leszállási állapotban piros. A figyelmeztetés
képernyőolvasóval is elérhető; az élő feszültséget nem olvassa fel folyamatosan.
Kikapcsolt szimulációnál a kártya rejtett.

A tesztek mindhárom drónnál ellenőrzik a fogyasztás integrálását, a gáztól
függő merülést, a rövid terhelési esést, a kapacitás nélküli feszültség-visszaállást,
a figyelmeztetéseket, a teljes kimerülést, a resetet és a 30/120/240 Hz-es
időlépés-egyezést. Böngészőben a gyorsított, 1%-os kapacitású, adatbázis nélküli
tesztpéldányon a nagy kijelző és a LAND NOW megjelenése is ellenőrzött;
a gyorsított kapacitás nem kerül az éles konfigurációkba.
