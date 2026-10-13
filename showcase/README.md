# Rotorift Showcase – bővíthető drónbemutató

Modellválasztós bemutató a saját, kódból épített Rift X5 freestyle, Rift 65
tinywhoop, Rift 75 whoop és Rift C3 cinewhoop drónnal. Mind a négy modell választható.
Ez külön modellbemutató;
a játék, a repülési fizika és az irányítás még nem készül ebben a demóban.

## Megnyitás

- GitHub Pages: <https://szabolevi98.github.io/rotorift/>.
  A `main` ágra kerülő showcase-változásokat a `showcase-pages.yml` workflow
  újraépíti és publikálja; csak az önálló modellbemutató kerül a Pages-re.
- XAMPP/Apache alatt: <http://localhost/rotorift/showcase/>.
- Vagy nyisd meg az `index.html` fájlt közvetlenül Chrome-ban / Edge-ben.
- A kész HTML a teljes Three.js kódot és minden textúrát tartalmazza;
  internetkapcsolat és telepítés nélkül is működik. WebGL 2 szükséges.

Egérhúzással forgatható, görgetéssel nagyítható. Érintőképernyőn egyujjas
forgatás és kétujjas nagyítás használható. Külön felül-, elöl-, oldal- és hátulnézet is van.

Akkumulátor, propellerek és akciókamera külön kapcsolhatók. Van széthúzott
nézet, propelleranimáció, automatikus forgatás, négy műanyagszín és drótváz.
Az akciókamera kapcsolója az X5 és a C3 modellnél aktív.
Az alapértelmezett szín a logó teltebb narancssárgája; sárga, türkiz és lila is választható.

## Rift X5

- Saját X-karbonváz: 230 mm átlós motortáv, 5 mm karok, furatok és kivágások.
  A vázoszlopok a két lemezre ülnek fel, átmenő csavarszárakkal és karleszorítással.
  A 149 mm hosszú középtest hátul 30 mm-rel megnyújtva külön elektronikatérrel készül;
  a motorok és az első kamerák helye a korábbi változatból marad.
- Négy részletes motor, réztekercsekkel és nyitott felső haranggal.
- Részletes TPU motorvédők: furatolt talp, nyitott védőperem, ütközőbordák,
  rétegillesztések, csavarfészkek és alsó csúszótalpak.
- Négy 127 mm átmérőjű, háromágú propeller, csavart térbeli lapátokkal
  és sötét, füstszínű áttetsző műanyaggal.
- Döntött FPV kamera, formázott, furatolt TPU oldaltartókkal, oldalirányú
  rezgéscsillapítókkal, átmenő döntőcsavarokkal és a vázhoz kapcsolt orrvédővel.
- Teljes méretű, saját akciókamera GoPro-jellegű TPU keretben, oldalsó és
  exponálógomb-nyílásokkal, peremes rögzítéssel és csavaros, villás döntőcsuklóval.
- FC és ESC valódi szerelőfuratokkal, folytonos gumitávtartókkal, átmenő
  csavarszárakkal, rögzítőanyákkal és összekötő kábelköteggel.
  A stack a négy kar és motor középpontjában ül; a korábbi helyénél 4 mm-rel hátrébb,
  a hozzá igazított rögzítőfuratokkal, alkatrészekkel és kábelbekötésekkel.
  A 12 motorfázis-pad az ESC saját középpontjához igazodik, a sarokbakok
  között; a kábelvégek külön fémes forrasztási kötéssel csatlakoznak.
- VTX csavarozott TPU tálcán, rezgéscsillapító alátéttel, rögzítőpántokkal,
  csatlakozókkal és a kondenzátor külön tartójával.
  A VTX és a vevő a hosszabb hátsó lemezek között ül, a bekötések a vázon belül futnak.
- 6S 1300 mAh akkumulátor, felfekvő csúszásgátló pad, két pánt, páros XT60
  dugó és aljzat kulcsolt házzal, arany érintkezőkkel és kábelvédőkkel;
  hétérintkezős balanszcsatlakozó és külön bekötött ESC tápkábelek.
  Az akku hátlapján külön furatolt kivezetőpanel, a két tápkábelen gumipersely,
  a balanszkötegen lapos tehermentesítő hüvely és a dugón kábelbevezető gallérok vannak.
  Az XT60 az akku mögött, a felső lemezre csavarozott TPU gallérban ül;
  az ESC tápkábele külön, gumiperselyes felső kivágáson érkezik hozzá.
  Az akkukábel hátrahajtott ívvel és egyenes végszakasszal csatlakozik
  az XT60 hátoldalának üreges kábelvédő hüvelyeibe.
  A balanszdugó a tápkábelpár mellett fut, közös gumipánttal rögzítve;
  a balanszköteg rövid visszahajtással csatlakozik a dugó hátoldalához.
  A dugó és kábelbevezető gallérjai a tápkábel visszahajtott íve fölött ülnek,
  a gumipánt a külön egyenes kábelrészt és a dugó oldalát fogja össze.
- A hátsó vázra kapcsolt TPU antennahíd, ELRS vevő és egyetlen valódi
  T-formájú dipólantenna, saját tartóval, koaxkábelével és vevőbekötéssel.
  A T-antennát csavarozott alsó talp, két lapos merevítő, alsó bölcső
  és két, gumibetéttel körbefogó TPU hüvely tartja.
- Az előző változatnál 25%-kal hosszabb omni VTX-antenna, karcsú, nyolclapú
  fekete fejjel, narancssárga oldalsó csíkokkal, lecsapott peremekkel és lapos felső panellel;
  a hátsó tartóból egyenes, hátrafelé döntött szár indul;
  formai referencia: [GEPRC Momoda 2](https://geprc.com/product/geprc-momoda2-5-8g-antenna/).
- Kódból készített karbontextúra és saját címkék, külső modell vagy fotó nélkül.

Az 5 hüvelykes kategória arányainak referenciái:
[GEPRC Vapor X5 váz](https://geprc.com/product/gep-vapor-x5-frame/) és
[GEPRC MARK5 váz](https://geprc.com/product/geprc-gep-mk5-frame/).
A Rift X5 saját geometria, nem gyártói CAD vagy pontos termékrekonstrukció.
Az akciókameratartó formai referenciája a
[GEPRC állítható TPU GoPro-tartó](https://geprc.com/product/geprc-mark5-gp-5-6-7-8-9-10-adjustable-tpu-mount/).
Az ELRS dipólantenna kialakításának referenciája az
[ExpressLRS hardverismertető](https://www.expresslrs.org/hardware/hardware-selection/).
A geometria vizuális demó; gyártáshoz és valós repüléshez nem szolgál méretezésként.

## Rift 65

- 65 mm átlós motortáv, 31 mm-es, csavart, áttetsző háromágú propellerek.
- Narancssárga PP-jellegű váz vékony propellervédő falakkal, háromágú
  motortartókkal, nyitott középrésszel és alul kialakított akkuklipszekkel.
  Gyűrűnként két karcsú, lekerekített, nyitott talp csatlakozik az alsó peremhez:
  összesen nyolc, a külső sarkok két oldalán, egységes talpmagassággal.
- Négy apró 0702 motor, ezüst haranggal, kék felső peremmel, tekercsekkel,
  nyitott felső küllőkkel, tengellyel és alsó rögzítőcsavarokkal.
- 45°-ban elhelyezett AIO panel, 26 × 26 mm furatkiosztással. A négy
  csillapított rögzítés és a canopy lábai a propellerek forgási területén kívül vannak.
- FC, ESC, VTX és vevő vizuális részletei, motorfázis-padok, forrasztások és kábelek.
- Áttetsző, nyitott kameratartó, íves bordákkal és négy csavarozott szemmel;
  28°-ban felfelé döntött mikro FPV kamera, lencsetubussal és hátsó panellel.
- Zsugorcsöves pálca-VTX-antenna és külön vevőantenna.
  Az ELRS sugárzó rövid, 5 mm-es pálca; a canopy mellett felfelé áll,
  saját megtámasztással, a propellerek forgási körén kívül.
- Alul elhelyezett 1S 300 mAh akku saját címkével, páros BT2.0-jellegű csatlakozóval.
  Az FC tápkábele alsó oldali forrasztópontokból indul; a panel és a váz közti
  résben, a hátsó gumibak két oldalán halad, az áttetsző canopy alatt.
  Az akkuvezeték furatolt végpanelen és gumiperselyeken lép ki; a csatlakozóházak
  alatt visszahajlik a dugó hátoldali kábelbevezetéseihez.

Formai referencia a felhasználó két fotója az eredeti
[BETAFPV Air65-ről](https://betafpv.com/collections/air-whoops/products/air65-brushless-whoop-quadcopter).
A motortáv, propellerméret és furatkiosztás referenciája az
[Air65 váz adatlapja](https://betafpv.com/collections/accessory/products/air65-brushless-whoop-frame).
A Rift 65 saját procedurális geometria, vizuális bemutató, nem gyártói CAD.

## Rift C3

- A felhasználó négy Cinelog30 V3 fotóján alapuló cinewhoop forma,
  saját Rotorift nevekkel és procedurális geometriával.
- 128 mm átlós motortáv, fordított 1404 motorok, alul forgó,
  76 mm-es, háromágú, csavart lapátú propellerek.
- Narancssárga, alacsony profilú védőgyűrűk, kivágott oldalsó hidak,
  a felső vázhoz kapcsolt támaszok és a keretből induló talpak.
  Gyűrűnként két szélesebb, lekerekített, tömör talp ül a külső íven,
  összesen nyolc, azonos magasságú felfekvő felülettel.
  Két széles, ívelt oldalnyereg és két lapos első borda simul a gyűrűkbe;
  a karbonlemez csavarozott felfekvő felületeken ül rajtuk.
- 2,5 mm-es, lyuggatott karbon felső váz, alsó elektronikatálca,
  felfekvő oszlopok, átmenő csavarok és megerősített első támaszok.
  Elöl és hátul hagyományos, egyenes élű, 14 mm széles karbonkarok futnak
  a letört sarkú motortalpakig, elkeskenyedő nyak nélkül. Mind a négy csavar
  és alátét teljesen a karbon fölött ül; a csavarok a lemez furatain át
  a motor talpáig érnek.
- Csillapított AIO panel, forrasztott motorkábelek, rögzített digitális VTX,
  hűtőbordák, porvédett adatcsatlakozók és hátsó vevő-/táppanel.
- Döntött digitális FPV kamera, narancssárga, ablakos védőkerettel;
  külön két omni videoantenna és ELRS T-dipólantenna.
  A kamera körül nyitott karbon orrvilla fut; a TPU oldalak külön talpakon
  ülnek, a merevítők a váz aljához kapcsolódnak. A döntőcsavar a tartó
  furatán és a gumiperselyen megy át, a felső tartóhíd a lencsevédő fölött fut.
- Felül 4S 720 mAh akku két pánttal, saját címkékkel és kábelkivezetésekkel;
  páros XT30 csatlakozó és rögzített, ötpólusú balanszdugó.
  Az XT30 a hátsó lemez közepén, csavarozott TPU bölcsőben ül; a tápkábelek
  a VTX két oldalán haladnak, majd a felső lemez kábelnyílásán lépnek ki.
  Az akkuvezetékek külön visszahajló íven érkeznek a dugó hátoldalába;
  a balanszdugó közvetlenül a két fő tápkábelen ül, vékony gumialátéttel
  és a dugót meg a két kábelt együtt körbefogó, zárt gumipánttal.
  A két videóantenna külön, furatolt felső talpat kapott, saját koaxátvezetéssel.
  Az ELRS T-antenna ezek alatt és mögött, két teljes körbefogó bilinccsel,
  gumibetéttel és a karbonlemez aljára csavarozott alsó tartóval kapcsolódik.
- Dönthető, naked GoPro jellegű akciókamera, könnyített 9 mm-es házzal,
  nyitott narancssárga tartóval, látható hátsó elektronikával és hűtőbordákkal.
  A tartó keresztmerevítőn és csavaros döntőcsuklón ül, a tápkábel a kamera
  hátsó csatlakozójától a BEC csatlakozójáig fut.

Formai és méretreferencia:
[GEPRC GEP-CL30 V3 váz](https://geprc.com/product/gep-cl30-v3-frame/) és
[Cinelog30 V3 O4 Pro](https://geprc.com/product/geprc-cinelog30-v3-o4-pro-quadcopter/).
A naked kamera saját, egyszerűsített geometria. A modell nem gyártói CAD;
a geometria vizuális bemutató, gyártáshoz és valós repüléshez nem szolgál méretezésként.

## Export

Az alapállapotú modellek elmentve is megtalálhatók:
`rotorift-rift-x5.glb`, `rotorift-rift-65.glb` és `rotorift-rift-c3.glb`.

A „Modell letöltése” gomb valódi, textúrákat is tartalmazó GLB fájlt ment.
Az export mindig összeszerelt állapotot ad, az aktuálisan kiválasztott színnel
és látható alkatrészekkel. A geometria méterben importálódik; az alkatrészek
külön elnevezett objektumok, a propellerek saját középpontjuk körül forgathatók.

Importálható Blenderben (`File → Import → glTF 2.0`) vagy Three.js GLTFLoaderrel.
A részletes bemutatómodell játékon belüli használata előtt szükséges lesz a
rajzolási hívások csökkentése, LOD és egyszerű ütközési geometria készítése.

## Forrás és újraépítés

- `drone.js`: a Rift X5 parametrikus modellje és procedurális textúrái.
- `whoop65.js`: a Rift 65 parametrikus modellje és akkucímkéje.
- `cinewhoop3.js`: a Rift C3 védőkerete, váza, elektronikája és naked kamerája.
- `catalog.js`: a modellválasztó katalógusa, nevek, státuszok, adatlapok és exportnevek.
- `viewer.js`: kamera, stúdiófények, kezelőszervek és GLB export.
- `../shared/visual/drone-rendering.js`: a játék és a demó közös színkezelése,
  tükröződési környezete, zöld PCB-je és kékes optikai üveganyaga.
- `sync-materials.mjs`: az elfogadott GLB-k anyagainak frissítése a közös
  beállításokból; a geometria és a beágyazott textúrák megőrzésével. `node showcase/sync-materials.mjs`.
- `template.html`, `style.css`: a bemutató felülete.
- `build.mjs`: a forrásokat egyetlen offline HTML-be csomagolja.
- `vendor/`: Three.js r169, OrbitControls, GLTFExporter, TextureUtils.

A forrás módosítása után, Node.js-szel:

```powershell
node showcase/build.mjs
```

Új modellhez készíts egy, a `createRiftX5()` felületét követő gyártófüggvényt,
majd rendeld hozzá a `catalog.js` megfelelő bejegyzésének `create` mezőjéhez,
töltsd ki az adatlapját és állítsd a státuszát `ready` értékre. Az új forrásfájlt
a `build.mjs` csomagolási listájába is fel kell venni. A nézegető automatikusan
építi fel a választót, igazítja az adatlapot, és a kiválasztott modellt exportálja.
Az új modell `cameraScale` értékével a nézet és a nagyítási tartomány állítható.
A `coming` bejegyzések nem hoznak létre geometriát és nem indíthatók el.

A Three.js és kiegészítői MIT licenc alatt használhatók; a licenc a
`vendor/LICENSE.three.txt` fájlban található. A saját forrásokra a projekt
gyökérkönyvtárában található licenc vonatkozik.
