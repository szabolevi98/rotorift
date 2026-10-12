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
| Pályák         | Liget park szabad repülésre, Betonudvar építkezés 3D kapukkal és útvonallal                                 |
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

## Ellenőrzések

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
