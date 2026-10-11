# Rotorift – fejlesztési terv

Rögzítve: 2026. október 11.

Frissítés: a felhasználó multiplayerre bővítette a tervezett játékot,
a racing projekt Node.js megoldása alapján. A három showcase-modell
(Rift X5, Rift 65, Rift C3) egyelőre elkészült és elfogadott.

Állapot: a felhasználó 2026. október 11-én engedélyezte a játék fejlesztésének
megkezdését, valamint a commitot és push-t. Az alábbiak a teljes tervezett kiadás
követelményei; a megvalósítás és ellenőrzés állapota külön követendő.

Megvalósítási frissítés: elkészült a 0.1-es játszható repülési prototípus,
a két pályával, három fizikai konfigurációval, öt nyelvvel és multiplayer alappal.
Részletes állapot és ellenőrzések: [prototype.md](prototype.md).
A teljes első kiadás elfogadási feltételei még nem mind teljesülnek;
különösen a hardveres rádióteszt, fizikai hangolás és szobába visszatérés hátravan.

## 1. Cél és első kiadás

A Rotorift böngészőben futó FPV drónszimulátor lesz, saját arculattal,
pályákkal és drónnevekkel. A cél valósághű, jól hangolható repülési élmény,
amely rádióval gyakorlásra, billentyűzettel pedig kipróbálásra is használható.

Az első kiadás tartalma:

- Két saját környezet: füves, fás park és félkész építkezés.
- Három repülhető drón: 65 mm / 1S tinywhoop, 3 hüvelyk / 4S cinewhoop,
  5 hüvelyk / 6S freestyle.
- Egyjátékos szabad repülés és kapus időmérés, saját rekordokkal.
- Többjátékos szabad repülés és kapus verseny, Node.js szerverrel,
  szobákkal, élő eredménytáblával és tartós online ranglistákkal.
- Acro, Angle és Horizon repülési mód.
- Elsődlegesen USB-s FPV rádió, továbbá billentyűzetes irányítás.
- Drónonként menthető Actual Rates, másolás másik drónra vagy minden drónra.
- Teljes felület öt nyelven: angol, magyar, német, francia, spanyol.
- Saját logó, favicon és metaadatok.

Az első kiadás része a multiplayer; AI ellenfél egyelőre nincs.
Más szimulátorok neve nem kerül a játékba, a marketingbe vagy a metaadatokba.
A pályák elrendezése, modelljei és arculati elemei saját készítésűek legyenek.

## 2. Technológia és referencia

- Three.js: 3D megjelenítés, kamerák, fények, modellek és vizuális effektek.
- Rapier: merevtestfizika és ütközések.
- A repülésvezérlő, a motorok és a légellenállás külön szimulációs réteget
  kapnak; a Rapier önmagában nem modellez egy FPV drónt.
- Node.js: HTTP kiszolgálás, REST API, WebSocket multiplayer,
  szobák, online versenyvezérlés és eredménykezelés.
- WebSocket: a racing `ws` alapú mintája, közös kliens–szerver protokollal.
- MySQL/MariaDB: a racing mintájára játékosprofilok, rekordok és futameredmények
  tartós tárolása. Fejlesztéskor a szerver adatbázis nélkül is elindulhasson;
  a tartós online ranglista működéséhez beállított adatbázis kell.
- Helyben tervezett indítás: `npm start`; a Node folyamat szolgálja ki a klienst,
  a `/shared/` modulokat, az `/api/` végpontokat és a `/ws` kapcsolatot.
  A pontos port később konfigurálható. XAMPP/Apache használható a showcase-hoz,
  illetve élesben a webes tartalom és a Node reverse proxy kiszolgálásához.
  A multiplayerhez futó Node szerver szükséges.

Helyi technikai referencia: `D:/xampp/htdocs/racing`.
Átvehető szervezési minták: elkülönített megjelenítés és fizika, fix időlépés,
adatvezérelt tartalom, külön nyelvfájlok és központi nyelvkezelés;
HTTP/API/WebSocket kiszolgálás, szobakezelés, állapotszinkronizálás,
kapuellenőrzés és adatbázisos ranglista.

A helyi racing forrás jelenleg a saját jármű fizikáját kliensen futtatja;
a szerver mozgást és versenyszabályokat ellenőriz, nem szimulálja újra a Rapier világot.
A Rotorift tervezett kiindulása ugyanez az azonnali helyi irányítás:

- A saját drón fizikája, repülésvezérlője és rate-számítása fix időlépéssel
  a kliensen fut, a rádióra adott válasz nem vár hálózati körre.
- Online a kliens sorszámozott és időbélyegzett állapotokat küld;
  a szerver ellenőrzi a sorrendet, időzítést, megengedett mozgást és resetet.
- A szerver dönt a rajtról, kapusorrendről, körérvényességről, időkről,
  helyezésekről és a ranglistára kerülő rekordokról.
- A többi drón szerver által továbbított állapotokból, interpolációval jelenik meg.
  Az állapotküldés, snapshotok és fizika gyakorisága külön hangolható;
  a racing autós frekvenciái és mozgáskorlátai nem automatikus drónalapértékek.
- A drónfizikához, a háromdimenziós kapuátlépéshez és mozgásellenőrzéshez
  saját szabályok szükségesek. Különösen a roll/pitch, gyors forgások,
  emelkedés, zuhanás és ütközés utáni állapot legyen kezelhető.
- Ez szerver által ellenőrzött kliensfizika; nem teljes szerveroldali
  fizikai hitelesítés. A ranglista megbízhatóságát a validációs prototípusnál
  kell felmérni, és szükség esetén szigorúbb visszaellenőrzést tervezni.

A fizika és szabályok Three.js/DOM nélküli, közös modulokba kerüljenek.
Így a helyi gyakorlás és az online mód ugyanazokat az alapokat használja,
a szerver pedig hozzáfér a kapugeometriához és a drónok megengedett paramétereihez.

Megnézett helyi referenciák: `racing/README.md` architektúrafejezete,
`server/index.js`, `server/net/wsServer.js`, `server/game/room.js`,
`server/game/raceController.js`, `server/db/` és `shared/protocol.js`.

Tervezett projektfelépítés a meglévő dokumentáció és showcase mellett:

Az első prototípusban a REST végpontok a `server/index.js`-ben,
a szobák és online versenyszabályok a `server/net/rooms.js`-ben,
a menük a `web/main.js`-ben működnek. Az alábbi külön `api/`, `game/`, `ui/`
és protokollmappák a további bővítéskor történő szétbontás céljai.

```text
docs/                  követelmények, terv és technikai jegyzetek
demo/                  meglévő, különálló showcase és részletes modellforrások
package.json           tervezett Node indítási, fejlesztési és tesztparancsok
.env.example           tervezett port-, host- és adatbázis-beállítások mintája
web/                   publikus kliens, belépő HTML és stílusok
web/lang.js            központi nyelvkezelés
web/lang/              en.json, hu.json, de.json, fr.json, es.json
web/assets/            saját logó, favicon, modellek, textúrák és hangok
web/game/              jelenet, kamera, HUD és játékmenet
web/input/             rádió, billentyűzet, kiosztás és kalibráció
web/net/               WebSocket kliens, óraszinkron, távoli drónok interpolációja
web/ui/                menük, lobby, scoreboard, ranglista és beállítások
server/index.js        Node HTTP belépőpont és helyi statikus kiszolgálás
server/api/            katalógus, szobalista, profil és ranglista REST végpontok
server/net/            WebSocket kapcsolatok, üzenetellenőrzés és sessionök
server/game/           szobák, rajt, kapus versenyvezérlés és mozgásellenőrzés
server/db/             MySQL/MariaDB séma, migrációk és adattárolási réteg
shared/physics/        drónfizika, repülési módok és rate-számítás
shared/race/           3D kapuk, útvonalak, körszabályok és időmérési segédek
shared/net/            protokoll, állapotformátumok és közös hibakódok
data/drones/           drónkatalógus és fizikai paraméterek
data/maps/             környezetek, rajtpontok és kapus útvonalak
tools/                 modelloptimalizálás, asset- és fordításellenőrzés
deploy/                tervezett Node szolgáltatás és reverse proxy minták
test/                  fizika, rate-ek, időmérés, hálózat, ranglista és fordítások
```

A `demo/` már létezik; a játékhoz felsorolt többi új mappa csak tervezett.
A kliens a szerver által közzétett katalógusból kapja a pályák és drónok adatait;
az adatbázishoz kizárólag a szerver kapcsolódik. A showcase részletes modelljei
optimalizálás után kerülnek a játék assetjei közé, a fizikai ütközőtestek külön készülnek.

## 3. Pályák

### Füves, fás park

- Saját név; ideiglenes munkanév: **Liget**.
- A játszható terület 700 × 700 méter: az eredeti 140 méteres oldalhossz ötszöröse.
- Központi parképület, alatta végigrepülhető észak–déli sétánnyal; normális úthálózat,
  különböző fák, bokrok, padok, pergola, tavak és dombos, változatos területek.
- Tudatosan kialakított, sűrűbb facsoportok a belső parkban is, tóparti fák és fasor; az épületek megközelítése és a nagy freestyle rét nyitott marad.
- A bútorok a sétányokhoz igazodnak: út mellett álló, azzal párhuzamos padok pihenőöblökkel, külön piknikterasz, bekötések az épületekhez. Az utak nem vágnak át az épületeken és a berendezésen; az íves utak teljes szélességét ellenőrizni kell.
  Északnyugaton nagyobb tó (kb. 172 × 120 m) animált szökőkúttal, csónakházzal és mólóval;
  délkeleten kisebb tó (kb. 88 × 62 m) átrepülhető gyalogoshíddal.
  Kávézó és fedett terasz, oszlopsoros sétány, nyitott dombtetői pavilon.
  A sétányok kössék össze ezeket a helyeket; a látható részekhez tényleges ütközések tartozzanak.
- A kerítés jól láthatóan jelölje a játszható terület szélét, de legyen átrepülhető.
  A terep a kerítésen túl is folytatódjon, a drón körül betöltődő új területekkel.
  A kerítésen kívül kizárólag talaj legyen; növényzet, utak és más objektumok ne.
- Kilépéskor 10 perces aktív játékidős visszaszámlálás indul. Visszatéréskor törlődik;
  szünet alatt megáll. Lejáratkor a drón disarmolva visszatér a rajthelyre.
  Ugyanez online is működjön, szerveroldali időméréssel.
- Nyitott füves részek, fák, lombkoronák és változatos repülhető átjárók.
- Szabad gyakorlás, freestyle lehetőségek és kapus időmérő útvonalak.
  A Ligeten az időmérő és az összes checkpoint ideiglenesen kikapcsolva (`racingEnabled: false`, üres kapulista).
  Az új checkpointokat csak a végleges pálya alapján tervezzük meg; addig helyi és online szabad repülés marad.
- A három drón méretkülönbségeihez igazodó gyakorlóhelyek és útvonalak.

### Félkész építkezés

- Saját név; ideiglenes munkanév: **Betonudvar**.
- Befejezetlen épületváz, pillérek, födémek, nyílások és szintváltások.
- Beltéri és kültéri szakaszok, repülhető rések, freestyle vonalak és kapus útvonalak.
- A látható akadályok és az ütközési geometria egyezzenek a repülés szempontjából.

A munkanevek javaslatok, a végleges pályanevek később választhatók ki.

## 4. Drónkatalógus

| Első kiadás | Méret | Akkumulátor | Jelleg |
| --- | --- | --- | --- |
| Tinywhoop | 65 mm vázméret | 1S | Könnyű mikrodrón, propellervédőkkel |
| Cinewhoop | 3 hüvelykes propeller | 4S | Védett propellerek, filmes repülés |
| Freestyle | 5 hüvelykes propeller | 6S | Erős, nyitott propelleres freestyle drón |

A 65 mm átlós motortávot jelent, a hüvelykes méretek propellerátmérőt.
Felhasználói módosítás: az első tinywhoop a 75 mm-es helyett 65 mm-es;
formai referencia a BETAFPV Air65. A showcase saját modellneve Rift 65,
narancssárga vázzal. A modellbemutató után a játék fejlesztése is engedélyezett.
Az engedélyezett showcase harmadik modellje a Rift C3, 3 hüvelykes / 4S cinewhoop:
formai referencia a GEPRC Cinelog30 V3, a felhasználó képei alapján,
felül elhelyezett akkuval és naked GoPro jellegű, könnyített akciókamerával.
Mindhárom modell saját nevet és vizuális megjelenést kapjon.

A felhasználó a Rift X5, Rift 65 és Rift C3 showcase-modelljét egyelőre késznek
fogadta el. A vizuális bemutató és a GLB export elkészült; újabb modellkidolgozás
most nem feladat. A játékba illesztéshez később külön szükséges a modelloptimalizálás,
az ütközési geometria, a fizikai paraméterezés és a repülési hangolás.

A kategóriák különböző tömeggel, tehetetlenséggel, tolóerővel, motorreakcióval,
légellenállással és ütközési geometriával rendelkezzenek. A különbség érezhető
legyen repülés közben is. A pontos értékeket a fizikai modell kidolgozásakor
kell megalapozni és hangolni; ebben a tervben még nincsenek kitalált gyári adatok.

### Drónonkénti fizikai konfigurációs fájlok

Kötelező minden repülhető drónhoz külön, szerkeszthető konfigurációs fájl.
Tervezett helyük: `data/drones/rift-65.json`, `data/drones/rift-c3.json`
és `data/drones/rift-x5.json`; később minden új drón saját fájlt kap.
A fizikai szimuláció ezekből töltse a paramétereket, hogy a viselkedés
kódátírás nélkül hangolható legyen.

A konfiguráció tartalmazza legalább:

- Teljes repülési tömeg, tömegközéppont és forgási tehetetlenség,
  a felszerelt akku és akciókamera hatásával együtt.
- Motorelhelyezés, forgásirányok, tolóerő- és reakciónyomaték-görbék,
  motorfelpörgési és lassulási válaszidő.
- Propellerméret és aerodinamikai paraméterek; a propellervédők hatása,
  lineáris és forgási légellenállás.
- Akkumulátor cellaszáma, feszültsége és a teljesítményre gyakorolt hatása.
- Repülésvezérlő hangolása, az önszintező módok paraméterei,
  egyszerűsített ütközőtestek és ütközési anyagparaméterek.

A mezők mértékegysége és megengedett tartománya dokumentált legyen;
betöltéskor séma- és értékellenőrzés szükséges. A személyes rate-beállítások
külön maradnak a drón fizikai konfigurációjától.

Cél: a 65 mm-es / 1S tinywhoop valóban könnyű mikrodrónként viselkedjen,
a 3 hüvelykes cinewhoop és az 5 hüvelykes freestyle pedig a saját kategóriája szerint.
Ezt külön repülési hangolással és összehasonlító próbákkal kell igazolni.
A vizuális modell átméretezése önmagában nem teljesíti ezt a követelményt.

Online a szerver által kijelölt, verziózott konfigurációt használja minden résztvevő
és a szerver mozgásellenőrzése. Helyben módosított fizikai paraméterekkel végzett
gyakorlás ne adhasson rekordot a hivatalos online ranglistához.

Későbbi bővítések, opcionálisan inaktív katalóguskártyákkal:

- 75 mm / 1S tinywhoop.
- 3,5 hüvelyk / 4S drón.
- 3,5 hüvelyk / 6S drón.
- Külön racing drónok.

Ezek státusza „Készül” vagy „Hamarosan”, mind az öt nyelven.
Az első kiadásban csak a három elkészült modell indítható el.

## 5. Irányítás

### USB-s FPV rádió

- Az alapértelmezett repülési vezérlő a rádió.
- Tervezett böngészős bemenet: Gamepad API, ahol az eszköz joystickként elérhető.
- Eszközválasztás, csatlakozási állapot, tengelykiosztás és kalibráció.
- Roll, pitch, yaw és throttle hozzárendelése, tengelyenkénti invertálás,
  középállás, végpontok és deadzone beállítása.
- Élő csatornakijelzés a kiosztás ellenőrzésére, az alapértelmezett Mode 2
  mellett szabadon módosítható hozzárendeléssel.
- Az eszközprofilok és a kalibráció helyben megmaradnak újratöltés után.

A felhasználónál később rendelkezésre álló teszteszközök:

- RadioMaster TX15.
- RadioMaster Pocket.
- DJI FPV Controller; a pontos változat és a számítógépes csatlakoztatás módja
  a tényleges eszköztesztnél ellenőrizendő.

Ezek tervezett teszteszközök, a kompatibilitásuk még nincs igazolva.
Az automatikus érzékelést és a kiosztást valódi hardveren is ellenőrizni kell.

### Billentyűzet és bemenetváltás

- Rádió nélkül a játék billentyűzettel kipróbálható és játszható.
- Külön gombok a roll, pitch, yaw és throttle kezelésére, módosítható kiosztással.
- Fokozatos virtuális botkitérés és külön gázkezelés, hogy ne csak hirtelen,
  teljes kitérésű parancsokkal lehessen repülni.
- A rádió és a billentyűzet egyszerre elérhető, de a repülési tengelyeket
  egy kijelölt bemeneti forrás vezérli; a nyugalmi rádiójel nem írhatja felül
  a billentyűzetes irányítást.
- A menü, szünet, újraindítás és egyéb gyorsgombok rádió mellett is használhatók.
- Induláskor használható rádió hiányában billentyűzetes vezérlés választható automatikusan.
- Repülés közbeni csatlakoztatás vagy bontás ne okozzon hirtelen gázadást:
  helyi módban bontáskor szünet, folytatás előtt a vezérlő és gázállás ellenőrzése.
  Online csak a saját drón bemenete kerülhet biztonságos, disarmolt állapotba;
  a többi játékos szimulációja és a szerver versenyórája tovább fut.
  A bontást a szerver felé is jelezni kell, az aktuális mért kör érvénytelen.
- Arming/disarming és reset legyen külön hozzárendelhető művelet.

## 6. Repülési módok

- **Acro:** a botkitérés a kívánt szögsebességet adja meg; nincs önszintezés.
- **Angle:** roll és pitch esetén korlátozott kívánt dőlésszög és önszintezés.
- **Horizon:** közép környékén önszintezés, nagy kitérésnél akrobatikus forgás,
  a Betaflight működését követő átmenettel.

Mindhárom mód elérhető legyen mindhárom első kiadásos drónhoz.
A kezdő alapmód Acro; a mód menüből és hozzárendelt vezérlőgombbal váltható.
A rate-görbe szögsebesség-parancsot határoz meg: Angle és Horizon módban
az önszintező szabályozással való kapcsolatát külön kell megvalósítani.
Angle módban a roll/pitch kitérés szögparancs, nem közvetlen Acro rate-parancs.

## 7. Drónonkénti rate settings

A kért mezők a **Betaflight Actual Rates** modellnek felelnek meg.
Ezek nem a régebbi, „Betaflight” nevű rate-modell RC Rate / Super Rate mezői.

Roll, pitch és yaw tengelyenként külön állítható:

| Tengely | Center Sensitivity | Max Rate | Expo |
| --- | --- | --- | --- |
| Roll | 70 °/s | 670 °/s | 0,00 |
| Pitch | 70 °/s | 670 °/s | 0,00 |
| Yaw | 70 °/s | 670 °/s | 0,00 |

Ezek a Betaflight 4.5.2 forrásában ellenőrzött alapértékek; az ellenőrzéskor
a master ágban is azonosak. A rögzített verzió adja a reprodukálható referenciát.
Az Expo megjelenítési tartománya 0,00–1,00. A Center Sensitivity a görbe
közép körüli meredekségét, a Max Rate a teljes kitérésnél kért szögsebességet adja meg.

Követelmények:

- Minden drón saját rate-beállítást tárol helyben, újratöltés után is.
- „Alkalmazás erre a drónra”, „Másolás másik drónra” és „Alkalmazás minden drónra”.
- A másolás csak a rate-beállításokat érinti, nem a drón fizikai paramétereit.
- Alapértékek visszaállítása és tengelyenkénti szerkesztés.
- Javasolt élő rate-görbe és botkitérés-előnézet a beállítások megértéséhez.
- A rádió és a billentyűzet ugyanazt a kiválasztott drónhoz tartozó rate-modellt
  használja a bemenet normalizálása után.
- A rate-ek nem helyettesítik a repülésvezérlő stabilizálását és a fizikát.

Ellenőrzött források:

- [Betaflight – Rate Calculator / Actual Rates](https://betaflight.com/docs/wiki/guides/current/Rate-Calculator)
- [Betaflight 4.5.2 – alapértelmezett rate-profilok](https://github.com/betaflight/betaflight/blob/4.5.2/src/main/fc/controlrate_profile.c)
- [Betaflight 4.5.2 – Actual Rates számítás és egységváltás](https://github.com/betaflight/betaflight/blob/4.5.2/src/main/fc/rc.c)

## 8. Játékmódok

### Szabad repülés

Pálya-, drón- és repülésimód-választás után kötetlen gyakorlás, szünettel,
újraindítással és ütközés utáni visszahelyezéssel.

### Kapus időmérés

- A környezetekben kijelölt kapus útvonalak.
- Sorrendben, a megfelelő irányból teljesítendő kapuk és célvonal.
- Aktuális idő, kör/szakasz állapota, következő kapu és személyes legjobb idő.
- A kihagyott kapu vagy reset ne eredményezhessen érvényes rekordot.
- Gyors újrapróbálás és helyben mentett saját rekordok.
- A rekordok pályánként, útvonalanként, drónonként és repülési módonként különüljenek el.
- Helyi gyakorlásnál az időmérés a szimuláció idejét használja; szünetben nem telik.
  Online a szerver által ellenőrzött közös időalap számít, a menü megnyitása
  vagy egy kliens szünete nem állíthatja meg az időmérést.

### Multiplayer: közös szabad repülés és kapus verseny

- Szobalista, szobalétrehozás és csatlakozás kóddal; publikus és kódos szobák.
- Lobby játékoslistával, pálya-, útvonal- és drónválasztással, készenléti állapottal.
- Közös szabad repülésnél a játékosok látják egymás drónját és nevét.
- Kapus versenynél közös visszaszámlálás, elkülönített rajthelyek,
  szerver által követett kapusorrend, körszám, célba érés és futameredmény.
- A szoba szabályai határozzák meg az engedélyezett drónkategóriát és repülési módot;
  eltérő kategóriák eredményei ne keveredjenek a közös rekordlistán.
- A kiválasztott drón, mód és fizikai verzió mért kör közben rögzített;
  váltás vagy reset megszakítja az adott kört, új próbálkozás szükséges.
- Nicknév és stabil játékosazonosító a racing profilkezelési mintája alapján;
  az azonos megjelenített név nem jelent azonos játékost. A teljes fiókrendszer
  szükségessége későbbi döntés, a multiplayernek nem előfeltétele.
- Ping- és kapcsolatállapot, rövid szakadás utáni visszacsatlakozás kezelése.
  A szerver mondja meg, folytatható-e a futam; a kliens nem pótolhat utólag kapukat.
- A verseny érvényességi és helyezési szabályait a szerver kezeli;
  a kliens által beküldött kész köridő önmagában nem válhat rekorddá.
- A játékoslimitet, a drón–drón ütközések szabályát és a kapcsolatvesztés
  türelmi idejét a hálózati prototípusnál kell véglegesíteni.

### Scoreboard és tartós ranglista

- **Élő scoreboard:** az aktuális szoba játékosai, kapus versenynél helyezés,
  kör- és kapuhaladás, aktuális/utolsó/legjobb köridő, célba érési vagy DNF állapot.
  Szabad repülésnél játékoslista és kapcsolatállapot látszik, versenyhelyezés nélkül.
- **Futamvégi eredménytábla:** végleges sorrend, teljes idő, érvényes legjobb kör,
  teljesített körök és kiesés; a szerver eredményéből, tartós mentéssel.
- **Online rekordranglista:** pálya, útvonal, drón és repülési mód szerint szűrhető
  legjobb érvényes idők, névvel és dátummal. A pálya/útvonal és fizika verziója
  is a rekord kategóriájának része, hogy egy későbbi átépítés ne keverjen eltérő szabályokat.
- A személyes helyi rekordok továbbra is elérhetők egyjátékos gyakorlásnál.
  Helyben mért vagy szüneteltetett kör nem kerül automatikusan az online ranglistára.
- Egyedül is indítható szerver által követett online időmérés, amelynek érvényes
  körei ugyanabba a tartós ranglistába kerülhetnek, mint a multiplayer versenykörei.
- A szoba és az élő állapot memóriában él; a stabil profilok, kategóriánkénti
  rekordok, futamok és játékoseredmények MySQL/MariaDB adatbázisba kerülnek.
  A mentés futam- és kör-azonosítókkal védett a visszacsatlakozásból eredő duplázástól.
- Ranglista- vagy adatbázishibánál a felület jelezze, hogy a rekord nem menthető;
  az aktuális repülés maradjon használható, és ne jelezzen hamisan sikeres mentést.
- A scoreboard, lobby, hálózati hibák és ranglista mind az öt nyelven elérhető.

## 9. Megjelenítés, hang és fizika

- Elsődleges nézet: a drónhoz rögzített FPV kamera.
- Javasolt állítható kameraszög és látószög, helyben mentett beállításokkal.
- Áttekinthető HUD, módjelzés, vezérlőállapot és időmérés.
- Drónkategóriánként eltérő motorhang, a terheléshez igazítva.
- Fix fizikai időlépés és a rendereléstől független szimuláció.
- Tömeg, gravitáció, forgási tehetetlenség, motorerők, nyomatékok és légellenállás.
- A drón forgásának vezérlése szabályozón keresztül történjen, valódi erőkkel
  és nyomatékokkal; a modell ne közvetlen pozíciómozgatásra épüljön.
- Kis méretű, gyors drónoknál az ütközések és kapuátlépések nagy sebességnél
  is legyenek megbízhatóak.
- Javasolt grafikai minőségi fokozatok; a teljesítménycélt az első prototípus
  mérései és a tesztgép alapján kell véglegesíteni.

## 10. Öt nyelv

Pontosan az alábbi öt nyelv kell az első kiadásban:

| Kód | Nyelv neve a választóban |
| --- | --- |
| en | English |
| hu | Magyar |
| de | Deutsch |
| fr | Français |
| es | Español |

A racing projekt mintájára külön `web/lang/<kód>.json` fájlok, azonos
fordításikulcs-készlettel; központi `t()` függvény, HTML-ben `data-i18n`
jelölések és nyelvváltáskor a dinamikus szövegek frissítése.

- Mentett nyelvválasztás, első alkalommal böngészőnyelv alapján választás.
- Nem támogatott böngészőnyelvnél angol alapnyelv.
- Saját nevükön szereplő nyelvek, a racing projekt mintájára zászló nélkül.
- Menü, HUD, beállítások, kalibráció, súgó, hibák, státuszok és meta leírás fordítása.
- A dokumentum `lang` attribútuma kövesse az aktuális nyelvet.
- A „Készül” / „Hamarosan” kártyák szövege is legyen lefordítva.
- Fordításikulcsok egyezésének automatikus ellenőrzése.

## 11. Logó, favicon és metaadatok

- Saját Rotorift logó és kis méretben is felismerhető ikonváltozat tervezése.
- Favicon beállítása a logó ikonjából, megfelelő böngészős formátumokkal.
- Oldalcím, öt nyelvű meta description és megosztási metaadatok.
- Saját megosztási kép és az arculathoz illő színek, tipográfia.
- A végleges nyilvános URL-hez kötött metaadatok a publikálási cím ismeretében készülnek.

## 12. Javasolt megvalósítási sorrend

A felhasználó által engedélyezett fejlesztés sorrendje:

1. Projektalap, nyelvkezelés és menüváz; a Three.js/Rapier inicializálása.
2. Node HTTP/API/WebSocket alap, közös protokoll és adatvezérelt katalógus;
   helyi gyakorlás és online session világos szétválasztása.
3. USB-s rádió felismerése, kalibráció és billentyűzetes bemenet.
4. Egy drón fizikai prototípusa, FPV kamera, Acro mód és Actual Rates.
5. Angle és Horizon, drónonként mentett rate-ek és másolási műveletek.
6. A három elfogadott modell játékhoz optimalizálása, saját fizikája és hangja.
7. Park környezet, szabad repülés, ütközéskezelés és reset.
8. Kétklienses multiplayer prototípus: lobby, közös repülés, állapotküldés,
   távoli drónok megjelenítése, óraszinkron és mozgásellenőrzés.
9. Kapus időmérés és multiplayer verseny: szerveres rajt, kapuk, körök,
   scoreboard, futamvégi eredmények és szabályos reset.
10. MySQL/MariaDB profilok, rekordok és eredmények; online ranglista
    és szerver által követett egyszemélyes időmérés.
11. Építkezési környezet és a két pálya útvonalainak véglegesítése.
12. Arculat, favicon, metaadatok és mind az öt nyelv teljes játékfelületének véglegesítése.
13. Eszköztesztek, repülési hangolás, hálózati késleltetés/szakadás,
    szerver- és adatbázis-újraindítás, teljesítmény és terhelés ellenőrzése.

## 13. Az első kiadás elfogadási feltételei

- Mindkét saját pálya és mindhárom induló drón játszható.
- Minden drón saját, ellenőrzött konfigurációs fájlból kapja a fizikai paramétereit;
  a 65 mm-es, 3 hüvelykes és 5 hüvelykes gépek kategóriának megfelelő, külön hangolt
  viselkedése igazolt. A konfiguráció verziója az online rekord kategóriájához kötött.
- Szabad repülés és szabályos kapus időmérés működik, saját rekord menthető.
- Legalább két külön kliens ugyanabba a Node.js szobába csatlakozhat;
  közös szabad repülés és kapus verseny működik, a drónok és állapotok szinkronban vannak.
- Az online rajt, kapusorrend, köridő és helyezés szerver által kezelt;
  kihagyott kapu, szabálytalan mozgás, reset vagy megszakított kör nem adhat online rekordot.
- Az élő scoreboard és a futamvégi eredménytábla a szerver állapotát mutatja.
- A ranglista megfelelő kategóriákra szűrhető; adatbázissal a profilok,
  rekordok és eredmények szerver-újraindítás után is megmaradnak.
- Szobakód, készenlét, kapcsolatvesztés és visszacsatlakozás kezelése ellenőrzött;
  az újracsatlakozás nem dupláz játékost vagy eredményt.
- Helyi egyjátékos gyakorlás hálózati kapcsolat nélkül is használható
  a már betöltött pályán; a helyi rekordok elkülönülnek az online ranglistától.
- Acro, Angle és Horizon eltérő, a választott módnak megfelelő viselkedést ad.
- Rádió nélkül billentyűzettel is elindítható és irányítható a játék.
- Rádiós kiosztás, kalibráció, kapcsolódás és bontás kezelése működik;
  a megadott hardverekkel való ellenőrzés külön rögzítendő.
- A három rate-mező tengelyenként és drónonként menthető, másolható,
  és az alapértékek a fenti Betaflight-referenciával egyeznek.
- A rate-számítás középnél, teljes kitérésnél és köztes pontokon is ellenőrzött.
- Mind az öt nyelven teljes a felület, a választás és beállítások megmaradnak.
- Saját logó, működő favicon és kitöltött metaadatok vannak.
- A placeholder drónok egyértelműen jelöltek és nem repülhetők.
- A képkockasebesség változása nem módosítja a repülés sebességét vagy a rekordokat.
- Online a menü vagy egy játékos bemenetbontása nem szünetelteti mások futamát;
  késleltetett, duplikált és sorrenden kívüli üzenetek nem eredményeznek hamis rekordot.

## 14. Későbbi döntések

Ezek a követelményterv elkészítését nem akadályozzák:

- Végleges saját pálya- és drónnevek, logó és arculat.
- A drónok pontos fizikai adatai és hangolása.
- Végleges billentyűkiosztás, kapus útvonalak és teljesítménycél.
- A DJI vezérlő pontos változata és tényleges számítógépes elérhetősége.
- Szobánkénti játékoslimit, hálózati frissítési ütemek és a drón–drón ütközések szabálya.
- Profilkezelés részletei, kapcsolatvesztés türelmi ideje, szerverhost és publikálási mód.
- Ranglista-validáció végleges szigorúsága; szükség esetén szerveres visszaellenőrzés.
- Későbbi drónkategóriák és AI ellenfelek; a multiplayer már az első kiadás része.
