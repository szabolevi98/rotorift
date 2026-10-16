# Saját és globális körszellemek

A Racing projekt `shared/ghost.js`, szerveres `raceController.js`, rekordmentési
kódja és `web/mp.js` top-listás választója alapján készült. A Rotoriftben is
20 Hz-es pózminták és képkockánkénti pozíció-/kvaternió-interpoláció fut.

## Kapunkénti deltaidő

A helyi és online időmérőben a kiválasztott saját vagy globális szellem a
referencia. A részideje a rögzített 3D útból, az élő köridőméréssel közös,
irányhelyes kapumetszéssel készül; a dive-kapukat is kezeli. Hiányzó vagy még
betöltődő szellemrészidőt nem helyettesítünk a játékos legjobb idejével.
Kikapcsolt szellem mellett és normál versenyben az aktuális menet legjobb teljes,
érvényes körének azonos kapuja a referencia, nem a legjobb külön szektorok.

A zöld mínusz gyorsabb, a piros plusz lassabb részidőt jelent; a referencia neve
alatta látható. A jelzés 2,6 másodperc után eltűnik, azonos hálózati snapshot nem
indítja újra. Körkezdés, szünet, érvénytelen kör és Reset eltünteti. Reset és
kapcsolat-helyreállítás megőrzi a kategória legjobb körét; mód- és szabályváltás,
illetve új menet tiszta referenciával indul. Online a szerver pontos metszési idejét
használjuk, nem a snapshot beérkezését. Csak az utolsó részidő és annak referenciája
kerül a snapshotba; a teljes részidőtörténet nem utazik minden csomaggal.

## Használat

Egyjátékos menüben válassz **Időmérő** vagy **Ellenőrzött egyéni időmérő** módot.
A **Körszellem · top 10** választóban:

- Nincs szellem: egyedül repülsz.
- Saját legjobb felvett kör: ezen a böngészőn mentett érvényes köröd.
- A kategória globális top 10 eredményei: név, helyezés és köridő szerint.

A **Top 10 frissítése** újra lekéri a listát. A Rekordok oldalon a top 10
felvétellel rendelkező sorain külön **Szellem kiválasztása** gomb is van;
ez a megfelelő drón/pálya/útvonal/mód és a szellem kiválasztásával visszavisz
a menübe. A felszállást ezután a pilóta indítja.

A szellem az első kapu átlépésekor indul veled, minden új körben újraindul.
Reset és szünet közben elrejtjük; lejárt szellemkör nem folytatódik ismételve
a következő kapuátlépés előtt. Freestyle és multiplayer verseny közben nincs
szellemkör-lejátszás. Szimulációs opció- vagy módváltás a megfelelő új kategóriát
alkalmazza; folyamatban lévő hibás körből nincs mentés.

## Mentés és ranglista

- Helyi időmérő: 240 Hz-es fizikai pózokból 20 Hz-es minták. Csak a legjobb
  rendelkezésre álló érvényes felvétel mentődik a böngészőben, kategóriánként.
- Ellenőrzött online időmérő és multiplayer verseny: a szerver az elfogadott
  mozgásüzenetekből rögzít. Kapuátlépésnél interpolált pontos kezdő-/végpóz
  kerül be; a kliens nem tölthet fel tetszőleges szellemfájlt a globális listára.
- A szerver új személyes legjobb felvételét a pilóta saját böngészője is megkapja.
- MariaDB: meglévő `laps` táblán idempotens `ghost_data MEDIUMTEXT NULL` migráció.
  A lassabb körök időadata megmarad, de szellempayloadot csak személyes legjobb
  vagy azonos legjobb körhöz tárolunk. A gyorsabb rekordhoz mindig annak saját
  felvétele tartozik, a lassabb nem írhatja felül.
- Ranglista: játékosonként egy legjobb kör. A nyilvános `ghostId` a pilóta külön
  `public_id` azonosítója, nem a profil bejelentkezési tokenje. A választás egy
  jobb kör után is ugyanannál a pilótánál marad, annak új legjobb felvételével.
  `/api/ghost` csak a kért kategória top 10
  felvételét szolgálja ki. A ranglistaválaszban csak elérhetőségi jelzés van,
  a pózsorozatot csak kiválasztáskor töltjük le.
- A kategória tartalmazza a pálya-, útvonal- és útvonalverziót, drónt és
  konfigurációhash-t, repülési módot, akkumulátor/propeller/propwash/ütközés/szél
  opciókat. Ezek eltérő eredményeit nem keverjük.

A korábbi rekordokhoz nincs utólag kitalált mozgás: „Még nincs felvétel” jelölést
kapnak. Globális szellemhez új, legalább azonos legjobb érvényes kör szükséges.
Saját helyi felvétel a korábbi, felvétel nélküli időrekordnál lassabb is lehet;
a választó a ténylegesen felvett szellemkör idejét mutatja.

Formátum: `version: 1`, `sampleRate: 20`,
`[eltelt_ms,x,y,z,qx,qy,qz,qw]`. Legfeljebb 20 perc / 24001 minta.
Adatbázis és hálózat felől is ellenőrizzük a méretet, szigorúan növekvő
időbélyegeket, véges koordinátákat és egységnyi kvaterniót.

## Megjelenítés és ellenőrzés

Egyetlen mentaszínű, átlátszó anyag: egy összevont test és négy külön forgó
propeller, legfeljebb öt rajzolási hívással. Nincs szellem-Rapier test,
drón–szellem ütközés, árnyék vagy bonyolult fény-/tükröződés-számítás.
A saját drónhoz nagyon közel elrejtjük a modellt, hogy FPV-ben ne fedje el a képet.

Ellenőrzések: valódi MariaDB mentés/újranyitás, régi rekordok migrációja,
gyorsabb/lassabb körök, kategória- és top 10 korlátozás, HTTP API,
szerveres kétpilótás körfelvétel és megszakított kör kizárása, helyi mentés,
elavult menülekérések kizárása, interpoláció és öt rajzolásra összevonás.
Böngészőben a menüválasztó és az eredeti X5 modellen a szellem renderelése
ellenőrzött. Tesztadatok kizárólag külön tesztadatbázisban vagy ideiglenes,
helyi vizuális ellenőrző oldalon szerepeltek; az éles ranglistába nem kerültek.
