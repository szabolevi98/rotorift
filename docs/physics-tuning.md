# Repülési hangolás – 2. konfigurációverzió

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
felfutása ehhez néhány századmásodpercet hozzáad. A lebegési gáz a tömegtől,
motor/prop párostól, görbétől és feszültségtől függ: nem minden valós drónnál 28%.

## Bemenet és forgás

A korábbi billentyűzet normál módban csak 0,28-as kitérést adott: az alap
rate-ekkel ez kb. 67°/s, vagyis egy roll több mint 5 s. Most a nyilak és yaw
gombok teljes kitérést érnek el, rövid, időalapú felfutással és visszaközpontosítással.
Bármelyik Shift lenyomva 35%-ra csökkenti a kitérést finom irányításhoz.
A rádió kalibrált teljes tartománya és a személyes rate-ek megmaradnak.

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
