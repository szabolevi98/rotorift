# Rotorift – aktuális állapot és ellenőrzések

Frissítve: **2026-10-16**. Ez az oldal az aktuális megvalósítást és a ténylegesen
nyitott munkát foglalja össze. A korábbi prototípus fejlesztéstörténete a Gitben,
a részletes mérések és korlátaik a lent hivatkozott témadokumentumokban maradnak.

## Elkészült

| Terület | Aktuális megvalósítás |
| --- | --- |
| Projektalap | Node.js HTTP/API/WebSocket szerver, Three.js és Rapier; működő VPS-kiadás az fpv.levente.net címen. |
| Flotta | Öt repülhető drón: Rift 65, Rift 75, Rift C3, Rift X35, Rift X5; külön validált fizikai JSON és konfigurációhash. |
| Modellek | Öt saját GLB, részletes kábelezés, külön forgó/sérülő propellerek, nyolc választható szín és színkövető akkucímkék. |
| Pályák | Liget/Grove, Betonudvar/Concrete Yard, Játszótér/Playground és Skyline; stabil belső azonosítók, öt nyelven megjelenített nevek. |
| Útvonalak | Összesen 11 választható JSON-verseny: 3 Liget, 3 Betonudvar, 2 Játszótér, 3 Skyline. Freestyle-hoz nem kötelező útvonalat választani. |
| Fizika | 240 Hz-es fix lépés, külön motorválasz, tömeg/súlypont/tehetetlenség, légellenállás és előkészített pályaütközések. |
| Repülési módok | Acro, Angle, Horizon; váltás repülés közben is. Mért kör közbeni módváltás érvényteleníti a kört. |
| Bemenet | USB rádió/gamepad felismerés, mentett profil, csatornakiosztás, kalibráció, billentyűzetes tartalékvezérlés és felfutáskorlátozás. |
| Beállítások | Tabos beállítások, mozgó botokkal működő 3D rádiósegéd, drónonkénti Actual Rates és kamera, opcionális auto-arm. |
| Kamerák/HUD | Követőnézet, drónt mutató FPV és tiszta FPV; élő botjelzők, FPS/diagnosztika, nagy akkukártya, műhorizont és analóg effekt. |
| Szimuláció | Opcionális akkufogyás/feszültségesés, LOW BATTERY/LAND NOW és teljesítménykorlát; külön lapátsérülések, propwash, négy szélállapot. |
| Multiplayer | Legfeljebb nyolc pilóta, szobalista/kód, lobby, szerveres rajt, szín/nyomvonal, host által választott közös opciók és választható pilótaütközés. |
| Futaméletciklus | Automatikus visszatérés ugyanabba a szobába 60 másodperces foglalással, új futam ugyanabban a szobában, külön eredményképernyő és DNF. |
| Időmérő | Helyi és globális rekordok, saját/top 10 körszellemek, kapunkénti delta a kiválasztott szellemhez vagy az aktuális session legjobb érvényes köréhez. |
| Adattárolás | MySQL/MariaDB profilok, rekordok, eredmények; útvonalverzió, drón/config, mód és szimulációs opciók szerinti kategóriák. |
| Showcase | Angol drón- és pályanéző, GLB-export, kapuszerkesztő, JSON-import/export; GitHub Pages-kiadás. |
| Menü és arculat | Sötét hangár, kereshető drón-/pályaválasztó, útvonalrészletek automatikus SVG-vel; saját ikon, megosztási kép és dinamikus copyright. |
| Nyelvek/mobil | EN/HU/DE/FR/ES, fordított betöltés és pályanevek; fekvő mód jelzése, fullscreen-kezelés és képernyős repülési akciók. |

A hangár egyjátékos indítóképernyője Full HD monitoron a böngészősávokkal együtt,
1920 × 911 képpontos nézetben is kifér, időmérővel és szellemválasztóval.
A kisebb képernyők szükség szerint továbbra is görgethetők.

## Fontos működési szabályok

- A fizika nem a kijelző frissítési frekvenciájával lép: a 60/120/144 Hz nem ad
  sebességelőnyt. Nagy megakadáskor a korlátos utolérés eldobhat szimulációs időt;
  ezt a diagnosztika külön méri.
- A kerítésen kívül csak a talaj folytatódik. Visszatérésre **egy perc** van;
  a visszatérés törli a számlálót, a lejárat disarmolt resetet eredményez.
- A kapuk nyílásán át lehet repülni; keretük fizikai akadály. A vezetővonal csak
  vizuális segítség. Az útvonal-előnézet a mentett adatokból készül.
- Reset feltölti az akkumulátort és helyreállítja a propellereket. A motoronkénti
  lapátsérülések külön állapotok, nem egy közös sérülési százalék.
- Online a menü nem állítja meg a többiek játékát. Node-újraindításkor az élő
  szobák elvesznek, a mentett rekordok és eredmények megmaradnak.
- A rádió előretolása a drón orrát lefelé dönti. A nyers FPV rádióprofil pitch
  invert alapértéke kikapcsolt, a szabványos gamepadé bekapcsolt; az egyéni mentés megmarad.

## Ellenőrzések és korlátaik

Az automatizált tesztek a katalógus mind az öt fizikai konfigurációját vizsgálják,
beleértve a lebegést, forgási választ, visszaszintezést és a fix időlépést.
Külön tesztek ellenőrzik az ütközéseket, akkumulátort, sérülést, bemeneteket,
kamerákat, rekordokat, szellemeket, útvonalakat és hálózati életciklust.
Az egyes korábbi dokumentumok tesztszámai és időmérései az ott jelzett állapotra
vonatkoznak; nem a mindenkori teljes tesztcsomag eredményei.

A böngészős és Node-os helyi mérések nem ígérnek minden gépen azonos FPS-t.
Az USB-rádió szimulált tesztje nem helyettesíti az adott rádió/firmware/Android/
böngésző kombináció tényleges kipróbálását. A felhasználó rádiós tapasztalatai
alapján több profiljavítás elkészült; teljes hardveres kompatibilitási mátrix nincs.

A fizika `tuningStatus: initial-estimate` értéke szándékos: a stabilitási tesztek
nem bizonyítják a referencia-drónnal azonos karaktert. A sérülési küszöbök,
akkumulátoráramok, légellenállás és propwash továbbra is hangolási becslések.

A szerver rajtot, kapukat, időket és mozgási korlátokat ellenőriz, de nem futtat
minden pilótához teljes Rapier-visszaszimulálást. A ranglista nem csalásbiztos.
A pilótaütközés simított távoli testekkel helyben számolódik, ezért késleltetéses
és több eszközös vizsgálata továbbra is szükséges.

## Ténylegesen nyitott munka

1. **Teljesítmény:** ritka FPS-beesések okának követése, hosszabb repülések és
   összehasonlítható tesztek mind a négy pályán, asztali és mobil eszközökön.
   A korábbi közeli whoop-CCD és nézetváltási shadermegakadások javítva; ez nem
   bizonyítja, hogy minden lehetséges megakadás megszűnt.
2. **Valódi hardver:** Pocket/TX15 és más elérhető rádiók, Android USB-kiosztás,
   csatlakozás/bontás és kalibráció dokumentált, reprodukálható próbái.
3. **Fizikai hitelesítés:** az öt konfiguráció összevetése valódi repülési és
   akkumulátoradatokkal, ahol ezek hozzáférhetők.
4. **Multiplayer:** hosszabb nyolcpilótás, több eszközös és eltérő késleltetésű
   repülés/verseny, visszacsatlakozás és bekapcsolt pilótaütközés tesztelése.
5. **Hang:** jelenleg egyszerű, gázfüggő szintetizált motorhang működik;
   drónonként részletesebb hangzás későbbi kidolgozás marad.
6. **Későbbi bővítés:** erősebb szerveroldali visszaellenőrzés, ha a versenyek
   igénye indokolja; külön tervben szereplő, még el nem kezdett repülőtámogatás.

A visszacsatlakozás, futamújraindítás, eredményképernyő, megosztási kép,
kapuszerkesztő, szellemek és deltaidő **elkészültek**, nem nyitott alapfunkciók.
A pályák és modellek további javítása konkrét hibák vagy új igények alapján történik.

## Részletes dokumentáció

- [Fejlesztési terv és eredeti követelmények](plan.md)
- [Pályakatalógus és fordítások](map-catalog.md)
- [Fizikai hangolás és mérési korlátok](physics-tuning.md)
- [Akkumulátor](battery-simulation.md), [propellersérülés](propeller-damage.md)
- [Előkészített ütközések](collision-performance.md), [teljesítmény](performance.md)
- [FPS-jelentés és nézetváltás előkészítése](frame-diagnostics.md)
- [Rádióprofilok](radio-setup.md), [tabos beállítások](settings-menu.md)
- [Körszellemek és deltaidő](lap-ghosts.md)
- [Műhorizont és analóg kép](fpv-horizon.md)
- [Turtle és drónonkénti kamera](turtle-camera.md)
- [Rift 75 és Játszótér](pocket-park-and-rift75.md), [Rift X35](rift-x35.md), [Skyline](skyline.md)
- [Elkészült megosztási kép](cover.md)
- [Repülők későbbi bevezetésének terve](fixed-wing-plan.md)
