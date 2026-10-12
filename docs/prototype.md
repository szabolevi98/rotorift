# Rotorift 0.1 – első repülési prototípus

2026. október 12. A teljes kiadás követelményeit a `plan.md` tartalmazza;
      ez a dokumentum a most elkészült és ellenőrzött alapot különíti el a hátralévő munkától.

## Elkészült

| Terület        | Megvalósítás                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| Projektalap    | Node HTTP/API/WebSocket szerver, helyi Three.js és Rapier runtime                                           |
| Katalógus      | Három drón külön validált fizikai JSON-nel és verzióhash-sel; két pálya                                     |
| Modellek       | A három elfogadott GLB modell; anyagonként összevont mesh-ek; külön forgó propellerek                       |
| Repülés        | 240 Hz-es fix fizikai lépés; motorválasz, súlypontot figyelembe vevő keverő, légellenállás és ütközés       |
| Repülési módok | Acro, Angle, Horizon; saját FPV kamera és követőnézet                                                       |
| Bemenet        | Gamepad API rádiókiosztás, tengelyfordítás, holtjáték és kalibráció; menthető billentyűzetes kiosztás       |
| Rate-ek        | Tengelyenként Actual Rates, 70/670/0 alapérték; mentés drónonként és másolás egyre/mindenre                 |
| Pályák         | Liget park és nagy Betonudvar építkezés; mindkettő helyi/online szabad repülésre                            |
| Helyi játék    | Szabad repülés, kapus időmérő, elkülönített helyi rekord                                                    |
| Multiplayer    | Szobakód, nyilvános lista, lobby, készenlét, szerveres rajt, 20 Hz-es állapotok és távoli modellek          |
| Verseny        | Háromkörös online verseny, kapusorrend és irányellenőrzés, élő scoreboard, teljes futamidő szerinti befutás |
| Adattárolás    | MySQL/MariaDB profilok, köridők és futameredmények; kategóriánkénti ranglista                               |
| Nyelvek        | EN/HU/DE/FR/ES, mentett választás, dinamikus felület és meta description                                    |
| Arculat        | Rotorift ikon, favicon, saját narancssárga arculat; külön megmaradó showcase                                |

A drónkonfigurációk 2. verziója a lebegési gázt 28% körülire, az X5 teljes gázas
utazósebességét kb. 200 km/h-ra hangolja. A billentyűzet teljes Acro botkitérést
ad, Shift mellett finom irányítással. Szűrt forgáscsillapítás mérsékli a túlpörgést.
A mérések és a szerkeszthető paraméterek a [fizikai hangolási jegyzetben](physics-tuning.md) szerepelnek.

Alul középen két élő Mode 2 botállásjelző látható: balra gáz/yaw, jobbra pitch/roll.
A kalibrált, a fizikának átadott bemenetet követik minden képkockában, rádióval és
billentyűzettel is; a feliratok mind az öt nyelven elérhetők. Keskeny képernyőn
a telemetria föléjük kerül. A billentyűzet lineáris felfutási korlátot (slew rate
limiter) használ: pitch/roll 0,22 s alatt éri el a teljes kitérést, yaw 0,30 s alatt
75%-ig fut fel. Utóbbi a 70/670/0 alaprate mellett 390°/s. Elengedéskor 0,08 s alatt
középre térnek; Shift mellett finomabb kitérés. A rádió analóg bemenetét ez nem módosítja.

A játék, menü-előnézet és offline demó közös ACES/sRGB színkezelést, 1,2 expozíciót
és egyszer előállított procedurális ég/föld tükröződési környezetet használ.
A kamerák és akciókamerák kékes optikai üveget kaptak, a három drón PCB-je egységes
zöld. A modellek anyagbeállításai a `shared/visual/drone-rendering.js` fájlban közösek;
a GLB-k geometriája és beágyazott textúrái változatlanok.

## Drónszínek és multiplayer nyomvonalak

A repülés menüjében a showroom négy színe választható: narancs, sárga, türkiz,
lila. A közös választás böngészőben megmarad, az előnézet azonnal követi.
Az X5 és C3 TPU-/védőelemei, valamint a 65 mm-es whoop váza színeződik;
a kábelek, csatlakozók, optika és PCB anyagai változatlanok. A színanyagokat
szemantikus GLB-mesh-nevek alapján jelöljük összevonás előtt, és minden előnézet,
saját drón és távoli pilóta külön anyagpéldányt kap; a geometria továbbra is közös.

A Node szerver csak a paletta négy színazonosítóját fogadja el. A hello/appearance
üzenetek és a szobapillanatkép továbbítják a színt. Csatlakozás, újracsatlakozás,
futamindítás és reset megtartja; a lobby és scoreboard színes jelölőket mutat.
A kozmetikai választás nem része a fizikai konfiguráció hashének vagy a rekordkategóriának.

A többi pilóta drónja 3 másodperc alatt elhalványuló, saját színű nyomvonalat húz.
A csík képernyőn 3 px széles; a talaj és objektumok mögött takarásban marad.
Pilótánként egy újrahasznált, legfeljebb 128 pontos geometria van, 30 Hz-es mintavétellel.
Resetkor (szerveres resetId), teleportnál és renderelési szünet után új nyomvonal kezdődik;
megálláskor a meglévő csík fokozatosan tűnik el. Kilépéskor, kapcsolatbontáskor
és pályaváltáskor a távoli modellek és nyomvonalak felszabadulnak.

Ellenőrzött: mindhárom elfogadott GLB színanyagai és izolációja, nyomvonal-korlátok,
elhalványulás és reset/teleport, valódi WebSocket-színváltás, csatlakozás közbeni
választás és újracsatlakozás; böngészőben mentett szín és két további kliens élő nyomvonala.
A teljes ellenőrzés 71/71 tesztje sikeres.

## Liget átdolgozása

A park 700 × 700 méteres. A két épületszárnyat az emelet köti össze, alatta 8 méter
széles, 4,2 méter magas, mindkét végén nyitott sétány vezet át. A központi sétányhoz
kövezett és kavicsos utak, körsétány, padok, kerti pergola, piknikasztalok, ültetőládák
és lámpák kapcsolódnak. A fák tudatosan kijelölt ligetekben állnak, a központi tér
és a déli közösségi rész körüli gyep nyitott. Északnyugaton kb. 172 × 120 méteres, szabálytalan partú
nagy tó található animált szökőkúttal, csónakházzal és mólóval. A délkeleti kisebb tó
kb. 88 × 62 méteres, felette gyalogoshíd vezet át, a híd alatt is lehet repülni.
Kávézó nyitott, fedett terasszal, oszlopsoros árnyékolt sétány és dombtetői pavilon
ad további repülhető részeket. Az épületek alapjaihoz a talaj igazodik.
A terep, a látható utak, a hidak és az építmények külön ütközési felülettel rendelkeznek.
Az eredetileg üres déli részen Sportliget áll: nyugatra két oldalsó kiszolgáló szárnyas,
8 m széles középső átjárós klubház, fedett terasz és kosárpálya; keletre 54 × 46 m-es
parkoló, két sor nyitott autóbeállóval és öt autóval. Külön sétányok kötik össze a
részeket, a fő sétány szabad marad. A felületek alatt a domborzat vízszintesre igazodik.
A pályanézet külön Sportliget nézetet tartalmaz mind az öt nyelven.
A talaj mélységkezelése távolról is stabil, az utak teljes felülete követi a terepháromszögeket.

A kerítés átjárható határjelzés. Kívül kizárólag a talaj folytatódik, növényzet,
utak vagy egyéb objektumok nélkül. A terep a kerítésen túl is újabb
128 méteres területekkel töltődik tovább: a drón körül egyszerre 49 terület marad
betöltve. Ettől külön, hat egyszerűsödő terepgyűrű biztosítja a távoli talajt,
kb. 28,7 km sugarú területen. Ugyanazt a magasságfüggvényt, anyagot, színezést és
világkoordinátás textúrát használja; a részletességi szintek élei egyeznek,
átfedő síkok és rések nélkül. A látótávolság 12 km, a horizont fokozatosan ködbe olvad.
A közeli 9 terület terepe és fái aktívak a fizikában; a távoli talajnak nincsenek
objektumai és ütközési felületei. Az elhagyott részletes területek felszabadulnak.

A Liget napárnyékai négy, egyenként 2048 × 2048 felbontású távolsági tartományt
használnak (60 / 200 / 600 / 1600 m). Az árnyéktérképek a kamera látóterét követik,
magasból is lefedik a parkot, a tartományok között és a távoli határnál átmenettel.
A látószög vagy képarány változásakor újraszámolódnak; a fényirány állandó.
Ugyanez az árnyékolás működik a pályanézetben. A betöltött növények és online drónok
is megkapják; pályaváltáskor az árnyéktérképek és az anyagokhoz rendelt módosítások
felszabadulnak. A külön modell-előnézet saját anyagai megmaradnak.

Kilépés után a HUD 10 percről számol vissza, aktív játékidő szerint. Visszatéréskor
törlődik, menü alatt megáll; lejáratkor disarmolt visszaállítás következik.
Online a szerver méri az időt, és elég nagy mozgástartományt enged a külső repüléshez.
A Liget pálya- és útvonalverziója 3. Az időmérő ideiglenesen kikapcsolva, a kapulista üres.
A menü tiltja az időmérős módokat, a szerver elutasítja a Liget verseny- és hotlap szobáit.
Helyi és online szabad repülés elérhető; a végleges checkpointokat később tervezzük meg.

Külön körbeforgatható pályanézet: `/map-preview.html`, a játékban választott nyelvvel.

## Betonudvar első részletes változata

600 × 600 méteres építkezés nyolc, 2–11 szintes nyitott betonvázzal és egy
acélvázas, fedetlen csarnokkal. A födémekben egymás fölötti nyitott aknák,
széleken befejezetlen szakaszok, kilógó betonvasak és állványzatok vannak.
A lépcsők és a parkoló külső rámpája tényleges szinteket kötnek össze.
Három rácsszerkezetes toronydaru 48/64/76 m magas, hosszú gémmel, ellensúlyokkal,
vezetőfülkével és függő horoggal; a rácsok közötti nyílásokat nem zárja rejtett doboz.

Nyolc munkagép/jármű: rakományos kamion, mélyágyas szállító, betonkeverő,
kotrógép, bulldózer, homlokrakodó, dömper és megemelt platós teherautó.
A központi munkautat keresztutak, nyugati/keleti kiszolgálóutak és rendezett
iroda-, szerviz- és anyagtároló területek egészítik ki. Nyitott konténerek,
betoncsövek, betonlemez-rakások, vasanyag, földkupacok, kordonok és világítótornyok
adnak további helyszíneket. A 48 × 40 m-es munkagödör 4,5 m mély, lejtős oldallal,
alaptestekkel és vasalással; a megjelenített és fizikai talaj megegyezik.

Az ideiglenes kerítés térbeli jelzés, átjárható; kívül csak a talaj folytatódik.
A látótávolság 12 km, fokozatos köddel; a napárnyékok ugyanúgy négy tartományban
követik a kamerát, mint a Ligeten. A 9577 ismétlődő elem 313 térbeli/anyag/geometria
szerinti instancelt csoportra oszlik; 4864 statikus ütköző közül csak a közeli
részek vesznek részt a repülés fizikájában.

Pálya- és útvonalverzió: 2. A régi kapuk eltávolítva, az időmérő ideiglenesen
tiltva helyben és online. A kerítés elhagyásakor 10 perces visszatérési idő jár.
3D nézet a játék pályaválasztója alatt, vagy
`/map-preview.html?map=betonudvar`, tizenkét nézettel és öt nyelven.

A talaj most tényleges, kétméteres háromszögrácsú domborzat: közel 17 m
szintkülönbség, négy alapozási gödör, három délről levezető géprámpa és nyolc
szabálytalan, hosszúkás földdepó. A magasabb építési teraszok között rézsűk
és szintre rendezett épület-, daru- és géppadok vannak. A gödrökben alaptestek,
beton alapgerendák, zsaluzat és dúcolás; keleten közműcső-szerelési terület.
Az utak követik a terepet, a talaj színe elkülöníti a kitermelt és tömörített földet.
A terep 36 × 100 m-es látható részre oszlik, egyező szélekkel és normálokkal;
a fizikai aktivitás a drónt követi. A kerítésen túl csak folyamatos, csupasz talaj van.
A közeli talaj, a magasságlekérdezés és az ütközés ugyanazokat a háromszögeket használja.

További munkazónák: 56 × 50 m-es, részben burkolt hangár két nagy kapuval,
oldalnyílással, beépítetlen tetőmezőkkel és belső galériával; betonkeverő telep
két magas silóval, adagolóval, szállítószalaggal és adalékanyag-bunkerekkel;
előregyártott portálok szerelőudvara és zsaluzat-előkészítő terület.
A munkautak fizikai ütközést kaptak a látható, 8,5 cm-rel magasabb felszínen,
így a spawnon/reset után a drónok nem süllyednek az út alá.

A kerítésen kívüli föld azonos anyaggal és illeszkedő szélekkel folytatódik:
hét, fokozatosan durvuló terepgyűrű 38,4 km-ig, majd csupasz, sík távoli talaj.
Nincsenek külső objektumok. A talaj repülés közben végig látható, az ütközők
aktivitása követi a drónt.

Mindkét pálya saját skyboxot és hozzá illő fényeket, tükröződést, ködöt kapott.
Liget: kék, napos ég néhány felhővel, meleg napfény. Betonudvar: borús, szürke
felhőzet, gyengébb közvetlen fény és erősebb szórt világítás. A 1024 × 512-es
szférikus égképek időjárásonként egyszer készülnek el, külső letöltés nélkül;
az előnézet ugyanazt az égképet és fényprofilt használja, mint a repülés.

## Ellenőrzések

A pályák közös teljesítményjavítása a [mérési jegyzetben](performance.md) szerepel:
240 Hz-es fizika felesleges scene-query indexépítés nélkül, közeli statikus
ütközők aktivitása, változatlan árnyéktérképek újrahasználata és a menüben
elfedett játékjelenet renderelésének leállítása. A látvány és az árnyéktávolság megmaradt.

Az `npm test` a következőket ellenőrzi:

- Actual Rates teljes kitérése, középső meredeksége, expo-ja és előjele.
- Rádiócsatornák kiosztása, kalibrált tartománya, fordítása, holtjátéka és hiányzó csatorna kezelése.
- Mindhárom drón gravitációja, kiegyensúlyozott lebegése, motorválasza és földi ütközése.
- Elrugaszkodás 30% gáznál, 27–30%-os lebegés, teljes kitérésű roll/pitch 0,7 s
  alatti körbefordulása, rate-követés és elengedés utáni fékezés;
  kategóriánkénti utazósebesség beállása, kemény sebességlevágás nélkül.
- Acro attitűdtartás, Angle/Horizon pitch és roll visszaszintezés; motorhatáron is kiegyensúlyozott semleges állapot.
- Fizikai integráció összevetése 120 és 240 Hz-en.
- Külső kamera közeli, mérethez igazított képkerete mindhárom drónnál; közös mozgás gyors helyváltoztatásnál, függőleges és fordított helyzetben is. Nézetváltáskor az FPV szög és látómező megőrzése.
- Kapu iránya, nyílása, interpolált átlépési ideje, sorrendje és érvénytelen kör kezelése.
- Valódi két WebSocket kliens közös szobája, készenlét, rajt, három szabályos kör, körmentés és futameredmény.
- Ismételt csomag, hibás konfiguráció, megszakítás és hosszú állapotküldési szünet kezelése.
- MariaDB profil és kategóriarekord megőrzése új adatbáziskapcsolaton át, futameredmény idempotens mentése; külön tesztadatbázison.
- Fordításikulcsok egyezése mind az öt nyelven, HTML-lefedettség; statikus fájlok kiszolgálása.
- Liget domborzata, pontos területillesztések és a terep ütközési magassága;
  szabad épületátjáró, járható sétány, átjárható kerítés és korlátos területbetöltés.
- Két külön tómeder, épületek vízszintes alapjai, sűrűbb facsoportok, tóparti fák, fasor és nyitott freestyle rét;
  híd alatti átjáró és nyitott kávézóterasz; ideiglenesen tiltott versenyszobák.
- Az utak tényleges ívéhez igazított, kifelé elhelyezett padok külön kavicsos pihenőöblökkel; a horgászházat és a kávézót megkerülő sétányok, külön bekötőutak és útról áthelyezett piknikpergola. A lámpák a kereszteződéseket és a központi épületet szabadon hagyják.
- Távoli talaj fedése 100, 500 és 2000 m magasságból, illeszkedő részletességi szintek és korlátos geometria.
- Árnyékok talaj- és lombkorona-lefedése 100–1000 m magasságból; 52–140° látószög
  és fekvő/álló képarány; új anyagok árnyékolása és erőforrások felszabadítása.
- A 600 másodperces határidő, visszatérés és szünet kezelése; online visszaállítás
  valódi WebSocket klienssel, a tesztben rövidített türelmi idővel.
- Betonudvar: szabad főút, nyitott födémaknák és átrepülhető első szint minden
  betonvázban; ütköző oszlopok, tényleges munkagödör/lejtők, üreges betoncsövek,
  kerítésen túli talaj, korlátos rajzolási csoportszám és erőforrás-felszabadítás.

Valódi böngészőben ellenőrzött: mindhárom modell betöltése, billentyűzetes élesítés és
felszállás, közeli külső kamerakövetés, reset és FPV nézetváltás, menü miatti leállítás,
rate-ek másolása, nyelvváltás és metaadatok;
építkezési online szoba, két pilóta közös rajtja és a másik drón megjelenítése.
Hardveres rádióteszt még nem történt.

## Következő lépések

- TX15, Pocket és az elérhető DJI vezérlő felismerése, kiosztása és kalibrációja valódi hardveren.
- A három konfiguráció repülési hangolása; akkumulátor feszültségesése és fogyása, propwash és aerodinamikai részletek.
- Pályák látványának és kapus útvonalainak finomítása, pontosabb ütközési geometria és teljesítményprofilozás.
- Szobába visszatérés kapcsolatvesztés után, futam újraindítása, dedikált eredményképernyő és meccs-életciklus finomítása.
- Mozgásellenőrzés szigorítása, késleltetéses/terheléses tesztek és szükség esetén szerveres visszaszimulálás.
- Több eszköz és kijelzőméret tesztelése, végleges hangok és megosztási kép.

A fizikai JSON-kben a `tuningStatus: initial-estimate` szándékosan megmarad:
az automatizált stabilitási tesztek nem bizonyítják a valódi drónnal azonos repülési karaktert.
