# Rotorift

Böngészős FPV drónszimulátor Three.js megjelenítéssel, Rapier merevtestfizikával,
Node.js/WebSocket multiplayerrel és MySQL/MariaDB ranglistával.
Az első **játszható prototípus** elkészült; a fizikai konfigurációk még kezdeti
becslések, valódi rádiós és repülési hangolás szükséges.

## Indítás

Node.js 22 vagy újabb és WebGL 2 képes böngésző kell.

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
Az adatbázisteszt külön `rotorift_test_<id>` adatbázist hoz létre és takarít el;
a játék rekordjait nem módosítja. MariaDB nélkül csak ez a teszt marad ki.

## Repülés

- Rift 65: 65 mm, 1S tinywhoop; Rift C3: 3″, 4S cinewhoop; Rift X5: 5″, 6S freestyle.
- Liget: 700 × 700 méteres dombos park, átjárható központi épülettel, utakkal,
  változatos növényzettel és parkberendezéssel. Betonudvar: félkész építkezés.
  Mindkettő saját kapus útvonallal; szabad repülésben a kapuk kikapcsolnak.
- A Liget kerítésén túl folytatódik a terep. Kilépéskor 10 perces visszaszámlálás
  indul; visszatéréskor törlődik, lejáratkor a drón visszaáll a rajthelyre.
  Körbeforgatható parkbemutató: [map-preview.html](http://localhost:3015/map-preview.html).
- Acro, Angle és Horizon; FPV és követőnézet; kamera dőlése és látószöge állítható.
- Helyi szabad repülés és időmérő, elkülönített helyi rekorddal.
- Online szabad repülés, háromkörös verseny és szerver által követett egyéni időmérő.
- Öt nyelv: magyar, angol, német, francia, spanyol.

Billentyűzeten a **Space** élesít/kikapcsol, **W/S** növeli/csökkenti a megmaradó
gázértéket, a **nyilak** döntik a drónt, **A/D** fordítanak.
**H** becsült lebegési gázt állít (nem magasságtartás), **Shift** nagyobb botkitérést ad.
**R** reset, **V** kameranézet, **M** helyi repülési mód váltás, **Esc** menü/folytatás.
Élesítéskor a gáz legyen alacsony. Minden alapbillentyű átállítható a beállításokban.

Az USB joystickként megjelenő rádió az elsődleges bemenet; rádió nélkül
automatikusan működik a billentyűzet. A beállításokban csatornakiosztás,
fordítás, holtjáték, botközép és hatmásodperces végpontkalibráció található.
A böngészőnek a csatlakoztatott rádión egy botmozdításra is szüksége lehet.
A TX15, Pocket és DJI vezérlők tényleges hardveres tesztje még hátravan.

Az Actual Rates tengelyenként Center Sensitivity / Max Rate / Expo értékeket használ;
alapértékük 70 / 670 / 0. A beállítás külön menthető drónonként, másolható egy másik
drónra vagy mindháromra. A rádióprofil, nyelv, kamera, kiosztás és rate-ek a böngészőben maradnak.

## Multiplayer és rekordok

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
Kapcsolatvesztéskor a repülés megszakad, a kliens újracsatlakozik,
de a régi szobába és folyamatban lévő futamba még nem tér vissza automatikusan.
Távoli drónok vizuálisan láthatók; drón–drón ütközés még nincs.

## Fizikai konfigurációk

A `data/drones/*.json` fájlokban SI egységek szerepelnek:
tömeg (kg), méretek és súlypont (m), tehetetlenség (kg·m²), motoronkénti tolóerő (N),
motorválasz (s), légellenállás, repülésvezérlő és akkumulátoradatok.
A motorok tényleges pozícióban fejtenek ki erőt, a keverő számol a súlyponttal
és a motorhatárokkal. A látványmodell és a fizikai test külön kezelhető.

A jelenlegi akkumulátormodell állandó névleges feszültséget használ;
kapacitásfogyás, feszültségesés, propwash, aerodinamikai talajhatás és
alkatrészsérülés későbbi munka. A kapacitás most leíró adat.
A collider a középtestet és a motor/propeller környékét közelíti;
nem követi a modell minden apró alkatrészét. A parkban a fatörzsek és a fő
lombkoronák egyszerűsített ütközési felületet kapnak; az apró levelek és fűszálak
látványelemek. A környezetek további látványbeli finomításra nyitott prototípusok.

Konfiguráció változtatása után indítsd újra a Node szervert és frissítsd az oldalt.
A konfiguráció hash-e változik, a korábbi online idő más kategóriában marad.

## Modellbemutató és dokumentáció

Az elfogadott modellek önálló nézegetője: [GitHub Pages](https://szabolevi98.github.io/rotorift/),
illetve `http://localhost/rotorift/demo/` XAMPP alatt. Csak a statikus modellbemutató
kerül a Pages-re; a játékhoz külön Node szerver kell.

- [Fejlesztési terv](docs/plan.md)
- [Prototípus állapota és ellenőrzése](docs/prototype.md)
- [Modellek leírása](demo/README.md)

Licenc: [AGPL-3.0](LICENSE).
