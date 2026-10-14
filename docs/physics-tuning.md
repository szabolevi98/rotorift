# Repülési hangolás – 5. konfigurációverzió

2026-10-14: a [Rift X35](rift-x35.md) saját 1-es konfigurációval csatlakozott:
215 g, 3,5″ propeller, 160 mm motortáv, 4S / 650 mAh akku, akciókamera nélkül.
Mért szimulációs hover: 28,63%; szinttartó teljes gázas utazósebesség: 153,58 km/h;
teljes roll: 0,571 s; 50–25 km/h kifutás: 1,688 s / 16,30 m.
A mérőprogram és repülési tesztek mind az öt konfigurációt ellenőrzik.

2026-10-13-i kiegészítés: a három korábbi konfiguráció most 6-os verziójú,
külön lapátsérüléssel. A Rift 75 új, 1-es verziójú konfiguráció; akkumulátorral
44 g, mért lebegési gáza 27,8%, fenntartható utazósebessége 90,2 km/h.
Ugyanaz a mérőprogram mind a négy gépet futtatja, az eredmény JSON tartalmazza a részleteket.

Az 5. verzió a [részletesebb akkumulátorszimulációt](battery-simulation.md)
vezeti be. Kikapcsolt akkumulátorszimulációnál a lent mért alaprepülés változatlan.

## 2026. október 13. – megismételhető repülési mérés

Az `npm run physics:measure` a játék tényleges `DronePhysics` vezérlőjét és
Rapier fizikai pipeline-ját futtatja, renderer nélkül. A teljes mérés a
[flight-measurements.json](flight-measurements.json) fájlba kerül, dátummal,
konfiguráció-hash-sel és minden részpróba eredményével. A lentiek szimulált
értékek: nem gyári repülési mérések vagy a referencia-drónok igazolt végsebességei.

Alap Actual Rates, Acro, 240 Hz, szélcsend, névleges feszültség, kikapcsolt
akkufogyás, sérülés és propwash. Közvetlen botkitérés; a billentyűzet felfutása
nincs beleszámolva. A tömeg akkumulátorral és a modellen szereplő kamerával értendő.

| Mérés | Rift 65 | Rift C3 | Rift X5 |
| --- | --- | --- | --- |
| Felszállótömeg | 26 g | 310 g | 680 g |
| Lebegési gáz | 28,2% | 27,6% | 27,6% |
| Teljes roll ideje lebegési gáznál | 0,575 s | 0,583 s | 0,571 s |
| Teljes yaw fordulat ideje lebegési gáznál | 0,588 s | 0,646 s | 0,617 s |
| Roll válasz, a kért sebesség 90%-áig | 71 ms | 83 ms | 63 ms |
| Yaw válasz, a kért sebesség 90%-áig | 96 ms | 183 ms | 138 ms |
| Teljes gázas, közel szinttartó utazósebesség | 78,6 km/h | 120,6 km/h | 196,7 km/h |
| 0–50 km/h, előredöntött, felpörgött motorokkal | 0,354 s | 0,333 s | 0,238 s |
| 0–100 km/h, ugyanilyen feltételekkel | nem éri el | 0,892 s | 0,508 s |
| 50–25 km/h kifutás ideje, vízszintes drón, lebegési gáz | 0,717 s | 1,650 s | 3,263 s |
| Kifutási távolság 50–25 km/h között | 6,9 m | 15,9 m | 31,5 m |

A gyorsuláspróba eleve az előredöntött, felszállt, felpörgött drónról indul;
nem tartalmazza a felszállás és előredöntés idejét. A végsebességpróba 30 s,
a gáztelítésnél elérhető **kiegyensúlyozott** motortolóerőből számított dőléssel.
Az eltolódott tömegközéppont miatt ez kisebb lehet, mint négy motor egyéni
maximumának összege. A végállapot függőleges sebessége mindháromnál 0,001 m/s
alatt marad, tehát az eredmény nem zuhanásból nyert sebesség.

Ugyanaz a 670°/s rate mindhárom gépen közel azonos tartós forgási sebességet
jelent; a kategóriák a reakcióban, a gázerőben, a légellenállásban és a
kifutásban különböznek. A yaw a mérésekben lassabban épül fel, mint a roll/pitch;
teljes botkitérésnél a végső beállított rate-je ugyanúgy 670°/s.

### Javított pontossági hiba

A kibővített teszt a 65-ösön teljes gáznál, 25%-os roll kitéréssel talált
hibát: a kért 55°/s helyett a forgás hullámzott, legfeljebb kb. 33%-os
túllövéssel. Az erők világkoordinátás `addForceAtPoint` átadása a Rapier float32
számításában, magasban és az origótól távol pontosságot veszített.

A motorok tolóerejét és a tömegközéppontra számított `r × F` nyomatékát most
helyi koordinátákban összegezzük, majd egyszer forgatjuk és adjuk át a fizikának.
Egyenként megmarad a motor felpörgése, lefutása, forgásiránya és sérülése.
Nem állítjuk közvetlenül a drón orientációját vagy szögsebességét.
Ez a szélcsendes, felpörgött hover során mért kis C3/X5 sodródást is megszüntette.

A `flight-envelope.test.js` mindhárom tengelyt mindkét irányban, teljes és kis
botkitéréssel, 8%-os, lebegési és teljes gáznál ellenőrzi: 81 részpróba.
Ellenőrzi a sebességkövetést, túllövést, elengedés utáni fékezést, visszalengést,
keresztirányú forgást, 120/240 Hz összehasonlítást, valamint a 10 m-es és
1000 m magas, 4 km-rel eltolt helyzetek azonos reakcióját. Az Angle/Horizon
35°-ról 0,33–0,37 s alatt kerül 2°-on belül vízszintbe; az Acro megtartja a dőlést.

A pontossági javításkor a drónkonfigurációk 4-es verziót és új hash-t kaptak, hogy a javított fizikával
repült körök külön eredménykategóriába kerüljenek. A személyes rate-ek változatlanok.

### A fizikai becslések támpontjai és határai

A [BETAFPV Air65](https://betafpv.com/products/air65-brushless-whoop-quadcopter)
17,3 g akkumulátor nélküli tömege és a
[300 mAh LAVA akkumulátor](https://betafpv.com/products/lava-1s-300mah-75c-battery-5pcs)
8,3 g tömege kb. 25,6 g felszállótömeget ad: ez alátámasztja a 26 g-os 65-ös becslést.
A [CineLog30 V3 gyártói adatai](https://geprc.com/product/geprc-cinelog30-v3-o4-pro-quadcopter/)
128 mm tengelytávot, 1404-es motorokat, 76 mm propellert és 4S akkumulátort adnak meg;
a saját C3 310 g-ja akkumulátoros, naked kamerás felszereltségi becslés.
A [Vapor X5](https://geprc.com/product/geprc-vapor-x5-analog-freestyle-fpv-drone/)
5 colos, 2207-es motoros referenciát ad; az X5 680 g-ja szintén akkumulátorral
és kamerával értendő becslés.

A motor-időállandók, tehetetlenség, nyomatékállandó, légellenállás és
gázgörbe nem a konkrét referencia-példányok mért azonosítása. A modell egyszerűsített:
nem számol részletes propeller-áramlást vagy irányfüggő aerodinamikát. A
`tuningStatus: initial-estimate` ezért megmarad. Az automatizált teszt a
beállított repülési viselkedést és a hibamentes végrehajtását igazolja;
konkrét valós géppel 1:1 azonosságot mért repülési logokkal lehet igazolni.

## Korábbi, 2026. október 11–12-i hangolás

2026. október 11. A számok a szimulátorban mért értékek, nem gyári repülési
mérések. Az összehasonlító próbákhoz az alapértelmezett 670°/s Actual Rates,
névleges akkufeszültség és 240 Hz-es Rapier lépés tartozik.

| Drón | Korábbi lebegési gáz | Új lebegési gáz | Teljes roll ideje | Teljes gázas sebesség |
| --- | --- | --- | --- | --- |
| Rift 65 | 57,9% | 28,2% | 0,58 s | 79 km/h |
| Rift C3 | 54,1% | 27,6% | 0,58 s | 121 km/h |
| Rift X5 | 38,1% | 27,6% | 0,57 s | 196 km/h |

A sebességpróba 80° előredőléssel, teljes gázzal, ütközés nélkül, 40 másodpercig
tartott. Az X5 korábbi értéke ugyanezzel a próbával 382 km/h volt.
A roll-próba már felpörgött motorokkal, lebegési gáznál indul. A billentyűzet
felfutása ehhez további időt ad: a fenti mérés közvetlen teljes botkitéréssel készült.
A lebegési gáz a tömegtől,
motor/prop párostól, görbétől és feszültségtől függ: nem minden valós drónnál 28%.

## Bemenet és forgás

A korábbi billentyűzet normál módban csak 0,28-as kitérést adott: az alap
rate-ekkel ez kb. 67°/s, vagyis egy roll több mint 5 s. A nyilak most teljes
kitérést érnek el 0,22 s alatt, lineáris felfutási korláttal (slew rate limiter).
2026. október 12-től a yaw gombok 0,30 s alatt 75%-ig futnak fel, ami az alap
rate-ekkel 390°/s. A botok elengedéskor 0,08 s alatt térnek középre.
Bármelyik Shift lenyomva 35%-ra csökkenti a kitérést finom irányításhoz.
A rádió kalibrált teljes tartománya és a személyes rate-ek megmaradnak.
Az alapértékek megfelelnek a [Betaflight 4.5.2 Actual Rates profiljának](https://github.com/betaflight/betaflight/blob/4.5.2/src/main/fc/controlrate_profile.c#L44):
70 középső érzékenység, 670°/s maximum, 0 expo mindhárom tengelyen.
Ez teljes kitérésnél gyors, de szándékos; a billentyűzet korlátja a bemenetet formálja,
nem írja át a drónonként mentett rate-eket.

A forgást továbbra is motorerők és a konfigurált tehetetlenség hozzák létre.
A P szabályozást szűrt, mért szögsebesség-változás csillapítása egészíti ki:
ez mérsékli a motorlag miatti túlpörgést és a bot elengedése utáni visszalengést.
Nem írjuk közvetlenül felül a test orientációját vagy szögsebességét.

## Gáz és légellenállás

Az egyetemes `throttle²` helyett drónonkénti `motor.thrustExponent` határozza meg
a gáz–tolóerő görbét. Az X5 kitevője 1,5; a két kisebb dróné 1,25.
A C3 maximális tolóereje motoronként 3,8 N, a 65-é 0,31 N, az X5-é 11,5 N.
A H ugyanennek a görbének az inverzével számít lebegési gázt, nem magasságot tart.

A 65 motorerejének nagyságrendi támpontja a gyártó
[0702 II motortáblázata](https://betafpv.com/products/0702-ii-brushless-motors),
amely motor/prop változattól függően kb. 28–37 g maximális tolóerőt ad meg.
A C3 kategóriájának támpontja a
[GEPRC 1404 motorcsalád](https://geprc.com/product/geprc-speedx2-1404-3000kv-4600kv-motor/).
A három teljes konfiguráció és a gázgörbék továbbra is hangolási becslések.

A nagyobb négyzetes légellenállás sebességfüggő erővel állítja be az utazó
végsebességet; nincs kemény sebességlevágás. Zuhanás, irány, gázállás és ütközési
impulzus miatt pillanatnyilag eltérhet a táblázat értéke. A `maxSpeedMps` a szerver
mozgásellenőrzésének névleges kategóriahatára, nem kliensoldali sebességkorlát.

## Új hangolási mezők

- `motor.thrustExponent`: dimenzió nélküli, 0,5–3; gáz–tolóerő görbe.
- `controller.rateGain`: tengelyenként 1/s, pozitív; szögsebesség-hiba erősítése.
- `controller.rateDamping`: tengelyenként dimenzió nélküli, nem negatív; gyorsuláscsillapítás.
- `controller.derivativeFilterSeconds`: pozitív időállandó másodpercben.
- `linearDrag`: kg/s; `quadraticDrag`: kg/m; `angularDrag`: kg·m²/s, nem negatív.

A konfigurációk verziója 2, új hash-sel. A korábbi ranglisták megmaradnak, de az
új hangolással repült körök külön konfiguráció-kategóriába kerülnek.
A tesztek tényleges elrugaszkodást, lebegést, forgási sebességet, teljes flipet,
túlpörgést, elengedés utáni fékezést, sebességbeállást és 120/240 Hz stabilitást mérnek.
