# Rift 75 és a Játszótér

2026-10-13. Új, repülhető drón és harmadik pálya, a játékban és az angol
showcase-ben is. Választási sorrend: Rift 65, Rift 75, Rift C3, Rift X5.

## Drón

Saját narancs váz, fehér fröccsöntött jellegű, íves és hátul elkeskenyedő,
valódi oldal- és felső szellőzőnyílásokkal tagolt kameraburkolat; háromszög merevítésű motorfelfogatások, páros talpak,
1102-es motorok, háromágú 45 mm propellerek, zöld AIO és külön 1S 580 mAh csomag.
A kábelek a váz és a canopy alatt futnak; a csatlakozó a cella mögött találkozik.
A frame/címke a nyolc választható színt követi, a canopy fehér marad.

A forma referenciája a [BETAFPV Meteor75 Pro](https://betafpv.com/products/meteor75-pro-brushless-whoop-quadcopter).
A 75-ös név osztályt jelöl: a gyártó vázának tényleges motortávja 80,8 mm,
propellere 45 mm. Ezeket az arányokat követi a saját modell. A referencia 30,5 g
száraz tömegű; a szimulátorban az akkumulátorral becsült felszállótömeg 44 g.
A saját akkumulátor-, motor-, légellenállás-, tehetetlenség- és védőkeret-beállítások
a `data/drones/rift-75.json` fájlban vannak. A fizika becsült, nem gyártói repülési logból kalibrált.

Az AIO és a C03 jellegű kamera a 65-ös közös alkatrészei, a többi nagy egység
külön geometria. Nem a teljes 65-ös modell felnagyított másolata. A propellerek
saját forgástengelyt és külön lapátgeometriát kapnak, így a korábbi sérülésmodell
és a hozzá tartozó multiplayer látvány is működik.

## Pálya

84 × 84 m-es kis park, jól látható kerítéssel, déli bejárattal és összefüggő
körsétánnyal. Külön gumiburkolatos zónákon áll a két tornyos mászóvár, csúszda,
hinták, háromszintes csőrácsos kockamászóka és libikóka. Homokozó árnyékolóval, fedett játszóház/piknikasztal,
üreges fahenger és két rugós játék egészíti ki. Padok és kukák az utak mellett,
a fák a kerítés belső oldalán, a járdát szabadon hagyva állnak.

A mászóka régi, hegesztett acélcsöves játékot idéz: 4 × 6 cella, 1,2 m-es
négyzetek, legfeljebb 3,7 m-es magasság és kétszintes végződés. A tetején is
nyitottak a cellák. A csövek tényleges hengeres ütközést kapnak; a nyílásokat
nem tölti ki láthatatlan doboz. Festett, kopott csatlakozások és beton
talprögzítések egészítik ki. Belső, lekerekített sétány, ültetett szegélyek,
ugróiskola és változatosabb lombkoronák teszik rendezettebbé a környezetet.

A kerítésen kívül csak a talaj folytatódik a horizontig. 10 perces visszatérési
időkorlát működik. A nyitott mászóvár, alacsony átjárók és fahenger a 65/75-ös
whoophoz adnak szűk repülhető helyeket; minden drón választhatja a pályát.

A játékban választható név öt nyelven: Játszótér / Pocket Park / Spielplatz /
Terrain de jeux / Parque infantil. A showcase-ben saját közeli nézetek és
kapuszerkesztő is elérhető. A Pocket Circuit hét kapuja külön JSON útvonal,
freestyle repüléshez a versenyútvonal továbbra sem kötelező.

A látvány anyagonként és alapgeometriánként instancelt. A statikus fizika
előre sütött, térben összevont fájl; az új pálya letöltése kb. 40 kB fizikai adat.
Az aprólékos játszótéri elemeket 4 m-es blokkokra bontjuk, így a whoop
védőkeretének folyamatos ütközésvizsgálata egyszerre kevés háromszöget ellenőriz.
Nincs repülés közbeni objektumépítés vagy terepszél.

Ellenőrzések: a négy konfiguráció szabad levegőben, a két whoop felszállása a
kezdőútról 30% gázon, védőkeret és külön sérülés, nyitott mászóvár/fahenger/kockarács,
pályán túli talaj, JSON versenykapuk iránya és szabad nyílása, betöltés és színezés.
