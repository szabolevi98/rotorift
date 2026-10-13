# Rotorift

Böngészős FPV drónszimulátor Three.js megjelenítéssel, Rapier merevtestfizikával,
Node.js/WebSocket multiplayerrel és MySQL/MariaDB ranglistával.
Éles játék: **[fpv.levente.net](https://fpv.levente.net/)**.
VPS-telepítés és frissítés: [DEPLOY.md](DEPLOY.md).
Az első **játszható prototípus** elkészült; a három drón alapfizikája automatizált
repülési méréssel ellenőrzött. A konkrét valós gépekkel való pontos egyezéshez
repülési logokkal végzett hangolás, a rádiókhoz hardveres kompatibilitási próba szükséges.

## Indítás

Node.js 22 vagy újabb és WebGL 2 képes böngésző kell.
Mobilon fekvő nézetet kér a játék. A drónmodellek betöltésekor teljes képernyős
jelzés mutatja a letöltés százalékát és a 3D modell előkészítését.
Mobilon a repülés indításakor és folytatásakor automatikusan teljes képernyőre
vált a játék, a menübe visszatérve kilép belőle. A kézi kapcsoló továbbra is
elérhető. A működéshez a böngésző teljesképernyő-támogatása szükséges.
A rádióbeállítások Mode 2 animált 3D útmutatóval mutatják a botközepeket,
a tengelyek mozgását és a végpontkalibrálást. USB rádiónál az élő botállás is
látszik. Kis kijelzőn a 3D ábra elrejtődik, a szöveges útmutató megmarad.

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

A `.env` másolását csak első beállításkor végezd el. A játék címe alapból
**http://localhost:3015/**. A Node szerver szolgálja ki a teljes játékot,
az API-t és a WebSocket kapcsolatot. XAMPP-ból a MariaDB/MySQL szükséges;
az Apache alatt továbbra is külön elérhető a modellbemutató.

Az adatbázis neve alapból `rotorift`, a helyi XAMPP beállítás `root` felhasználó,
üres jelszó, `127.0.0.1:3306`. A szerver létrehozza az adatbázist és a táblákat,
ha a felhasználónak erre van jogosultsága. A saját elérés a `.env`-ben állítható.
Induláskor elérhetetlen adatbázissal is lehet repülni; online rekord ekkor nem menthető.

Fejlesztés: `npm run dev`. Ellenőrzés: `npm test`.
Repülési mérés: `npm run physics:measure`; az eredmény a
`docs/flight-measurements.json` fájlba kerül. A feltételek, kategóriánkénti
eredmények és a modell becslési határai: [physics-tuning.md](docs/physics-tuning.md).
Úthálózat vagy munkaterületi elrendezés módosítása után: `npm run maps:build`.
A burkolatok/szegélyek metszése és a két pálya ütközési fájlja előre készül el;
a játékban nincs poligonműveleti függőség. Csak a fizika újrasütése: `npm run collisions:build`.
Az összevont, térben felosztott ütközési hálók mérését és működését a
[collision-performance.md](docs/collision-performance.md) írja le.
A `npm run showcase:build` a burkolatmetszést automatikusan elvégzi a bemutató csomagolása előtt.
Az adatbázisteszt külön `rotorift_test_<id>` adatbázist hoz létre és takarít el;
a játék rekordjait nem módosítja. MariaDB nélkül csak ez a teszt marad ki.

## Repülés

- Rift 65: 65 mm, 1S tinywhoop; Rift C3: 3″, 4S cinewhoop; Rift X5: 5″, 6S freestyle.
- Liget: 700 × 700 méteres dombos park, átjárható központi épülettel, utakkal,
  sűrűbb facsoportokkal, tóparti fákkal és fasorral, nyílt freestyle térrel, két tóval és animált szökőkúttal.
  Csónakház, móló, híd, kávézó, fedett sétány és dombtetői pavilon ad repülhető részleteket.
  A déli Sportligetben átjárható klubház és terasz, kosárpálya, valamint két sor fedett
  parkoló és öt autó található; a fő sétányt szabadon hagyó saját bekötésekkel.
  A Liget időmérője és checkpointjai az elrendezés véglegesítéséig kikapcsolva.
  Betonudvar: félkész építkezés, saját kapus útvonallal.
- A Liget kerítésén túl csak a talaj folytatódik, objektumok nélkül. Kilépéskor 10 perces visszaszámlálás
  indul; visszatéréskor törlődik, lejáratkor a drón visszaáll a rajthelyre.
  Külön, fokozatosan egyszerűsödő távoli domborzat tölti ki a horizontot; a közeli
  objektumok és ütközések ettől függetlenül töltődnek be. A látótávolság 12 km.
  Körbeforgatható parkbemutató: [map-preview.html](http://localhost:3015/map-preview.html).
- Acro, Angle és Horizon; FPV és követőnézet; kamera dőlése és látószöge állítható.
- Beállítások → FPV kamera: külön kapcsolható, mentett Betaflight jellegű műhorizont
  és analóg videóeffekt. FPV nézetben működnek, egyjátékos és online repülésben is.
- Helyi szabad repülés és időmérő, elkülönített helyi rekorddal.
- Online szabad repülés, háromkörös verseny és szerver által követett egyéni időmérő.
- Öt nyelv: magyar, angol, német, francia, spanyol.

Billentyűzeten a **Space** élesít/kikapcsol, **W/S** növeli/csökkenti a megmaradó
gázértéket, a **nyilak** döntik a drónt, **A/D** fordítanak.
**H** becsült lebegési gázt állít (nem magasságtartás), **Shift** finomabb irányításhoz csökkenti a botkitérést.
**R** reset, **V** kameranézet, **M** helyi repülési mód váltás, **Esc** menü/folytatás.
Élesítéskor a gáz legyen alacsony. Minden alapbillentyű átállítható a beállításokban.

Az USB joystickként megjelenő rádió az elsődleges bemenet; rádió nélkül
automatikusan működik a billentyűzet. A beállításokban csatornakiosztás,
fordítás, holtjáték, botközép és hatmásodperces végpontkalibráció található.
A böngészőnek a csatlakoztatott rádión egy botmozdításra is szüksége lehet.
A TX15, Pocket és DJI vezérlők tényleges hardveres tesztje még hátravan.
A RadioMaster/EdgeTX rádiókhoz automatikus profil és eszközprioritás tartozik;
egyéni kiosztást négy mozdulatos botfelismerő tanít be. A PC-s és androidos
profilok külön mentődnek. A régi Android USB-csatornavesztéséről és a külön SIM
rádiómodell beállításáról: [rádióbeállítási útmutató](docs/radio-setup.md).

Telefonon is elérhető a képernyőn az **ARM/DISARM**, **Reset**, nézetváltás,
repülési mód és menü. A repülési tengelyeket a csatlakoztatott rádió/kontroller vezérli.
A Beállítások → Rádió / kontroller műveletek alatt a **Hozzárendelés** után
nyomj meg egy gombot vagy állíts egy szabad AUX csatornát végállásba.
Az ARM gomb váltja az állapotot; az AUX ARM kapcsoló beállása élesít,
kikapcsolása leállítja a motorokat. Alacsony gáz kell az élesítéshez.
A kiosztás eszközönként megmarad; csatlakozáskor/folytatáskor a már aktív kapcsoló
nem élesít automatikusan. Az AUX csatorna nem lehet repülési stickhez rendelve.

Az Actual Rates tengelyenként Center Sensitivity / Max Rate / Expo értékeket használ;
alapértékük 70 / 670 / 0. A beállítás külön menthető drónonként, másolható egy másik
drónra vagy mindháromra. A rádióprofil, nyelv, kamera, kiosztás és rate-ek a böngészőben maradnak.

## Multiplayer és rekordok

Az Egyjátékos és Multiplayer külön menüképernyő. A multiplayer oldal
szobalistát, szobakódos csatlakozást és önálló szobanyitást kínál; a nyitott
szobák öt másodpercenként frissülnek. A drón 3D előnézete és a közös
drón-/pályaválasztó mindkét indítási felületen megmarad.
A szimulációs opciók mindig nyitott panelen látszanak. Szobában a házigazda
állítja őket indítás előtt, a vendégeknél és indítás után zároltak.
Szüneteltetett repülés a menü bármely oldaláról folytatható vagy befejezhető.

Az online módban létrehozott szoba kóddal vagy a nyilvános listából érhető el.
Legfeljebb nyolc pilóta csatlakozhat; az egyéni időmérő egyfős.
Mindenki jelzi a készenlétét, a házigazda indítja a hárommásodperces rajtot.
Az élő eredménytábla a szerver körszámát és időit mutatja; a befutók a teljes
futamidő alapján kerülnek sorrendbe. Menübe lépéskor csak a saját drón áll meg;
a többiek repülése folytatódik.

Az 1. kapu indítja a kört. A sorrendben és megfelelő irányban teljesített kapuk
után az 1. kapu újbóli átlépése zárja azt. Reset új kísérletet kezd;
megszakítás vagy szabálytalan állapot érvényteleníti az aktuális kört.
Az online rekord kategóriája pálya + útvonalverzió + drón + fizika-konfiguráció hash + repülési mód.
A MySQL-profil helyi, névtelen azonosítót használ; több pilóta teszteléséhez
külön böngészőprofil szükséges, azonos profil két lapja nem lehet ugyanabban a szobában.

A saját fizika 240 Hz-en fut, az állapotküldés és a szobafrissítés 20 Hz-es.
A szerver a rajtot, kapukat, köridőket és mozgáskorlátokat ellenőrzi;
teljes Rapier újraszimulálás és csalásbiztos ranglista még nincs.
Kapcsolatvesztés után egy percig automatikusan visszatérhetsz ugyanabba a szobába,
ugyanazzal a pilótával és teljesített körökkel. A megszakadt kör újrakezdődik,
a drón a rajthelyen, kikapcsolt motorokkal folytatja. Az újratöltés is működik
ugyanabban a böngészőlapban. Lejárat után a hely felszabadul; a többiek futama folytatódik.
A házigazda lezárhat egy futamot, majd ugyanott készítheti elő a következőt;
új készenlét és külön futamazonosító szükséges. Saját eredményképernyő mutatja
a helyezést, köröket, legjobb kört, összidőt és a kiesett pilótákat is.
Az élő szobák Node-újraindítást nem élnek túl; a már mentett rekordok és eredmények igen.
Drón–drón ütközés a közös ghost mód kikapcsolásával használható.

## Fizikai konfigurációk

A `data/drones/*.json` fájlokban SI egységek szerepelnek:
tömeg (kg), méretek és súlypont (m), tehetetlenség (kg·m²), motoronkénti tolóerő (N),
motorválasz (s), légellenállás, repülésvezérlő és akkumulátoradatok.
A motorok tényleges pozícióban fejtenek ki erőt, a keverő számol a súlyponttal
és a motorhatárokkal. A látványmodell és a fizikai test külön kezelhető.

Opcionális akkumulátorfogyás és alacsony töltöttségnél teljesítménykorlát,
propellersérülés, propwash és szél már használható; paramétereik drónonként
konfigurálhatók. Az aerodinamikai talajhatás és további alkatrészsérülések későbbi munka.
A collider a középtestet és a motor/propeller környékét közelíti;
nem követi a modell minden apró alkatrészét. A parkban a fatörzsek és a fő
lombkoronák egyszerűsített ütközési felületet kapnak; az apró levelek és fűszálak
látványelemek. A környezetek további látványbeli finomításra nyitott prototípusok.

Konfiguráció változtatása után indítsd újra a Node szervert és frissítsd az oldalt.
A konfiguráció hash-e változik, a korábbi online idő más kategóriában marad.

## Modellbemutató és dokumentáció

Az elfogadott modellek önálló nézegetője: [GitHub Pages](https://szabolevi98.github.io/rotorift/),
illetve `http://localhost/rotorift/showcase/` XAMPP alatt. A statikus drón- és pályabemutató,
valamint a kapuszerkesztő is a Pages-re kerül; a játékhoz külön Node szerver kell.

- [Fejlesztési terv](docs/plan.md)
- [Prototípus állapota és ellenőrzése](docs/prototype.md)
- [Modellek leírása](showcase/README.md)

Licenc: [AGPL-3.0](LICENSE).

## Showcase and race editor

The English showcase combines the drone studio (65 → C3 → X5) with both map viewers. Open http://localhost:3015/showcase/ or the GitHub Pages site. The old /map-preview.html entry redirects to the map tab.

Choose **Maps & races → Edit gates**. Place gates by clicking terrain or floors; select numbered gates to move/rotate them with the gizmo or numeric controls. Gate 1 is start/finish; arrows show the required crossing direction. Use Earlier/Later, Undo/Redo and the start-position controls to arrange the race.

Each route is a separate file: `data/maps/liget/race_1.json`, `data/maps/betonudvar/race_1.json`, then `race_2.json`, etc. The server discovers these JSON files automatically at startup. **Save to project** writes directly to these folders on same-origin localhost; reload the game after saving. **Download JSON** and **Import JSON** also work on GitHub Pages. Exported files must be placed in the matching map folder to become game routes.

Routes have `id`, `name`, `version`, `spawn` and ordered `gates`. Gate positions `p` are absolute metres; direction `n` is a horizontal unit vector; `width` and `height` are metres. Spawn X/Z are world coordinates and spawn Y is ground clearance. Increase the version when editing JSON manually. The editor increments it for changes; project saving also detects geometry changes and bumps the version. Records are separated by map, route ID/version, drone/config, flight mode and simulation rules. Multiplayer rooms retain their chosen route snapshot even if a file is edited later.

One demo race ships for each map: **Park Flow** (6 gates, including the pavilion passage) and **Concrete Circuit** (10 gates). Free flight hides race gates.

Build the complete static showcase with `npm ci` and `npm run showcase:build`. For offline use, keep `index.html`, `map-viewer.html`, `map-viewer.css` and `map-viewer.bundle.js` together. Both renderers pause when their tab is inactive. The GitHub Pages workflow rebuilds and publishes these files; re-run the build after changing map geometry or race files.
