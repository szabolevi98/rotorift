# Rotorift 0.1 – első repülési prototípus

## 2026-10-13 – Önálló lapátsérülések

- Négy külön propeller, három-három ép/hajlott/csorbult/letört lapáttal; saját tolóerővesztés és rezgés. A teljesen hiányzó lapátokkal a rotor tolóereje nulla.
- Valódi ütközési pontokhoz kötött sérülés, fizikai védőgyűrűk a 65/C3 modelleken, sérült GLB lapátok és négy külön HUD ikon. Multiplayer állapotátadás és reset.
- Küszöbök a 6-os verziójú drónkonfigurációkban; a sérülés anyagvizsgálattal még nem kalibrált becslés. Működés és tesztfeltételek: [propeller-damage.md](propeller-damage.md).

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
| Nyelvek        | EN/HU/DE/FR/ES, mentett választás, dinamikus felület, oldalcím és kereső-/OG-/Twitter-leírás                  |
| Arculat        | Rotorift ikon, favicon, saját narancssárga arculat; külön megmaradó showcase                                |

A drónkonfigurációk 3. verziója megtartja a 2. verzió 28% körüli lebegési gázát és az X5 teljes gázas
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

## Repülési mód és választható szimuláció

A HUD bal alsó módgombja és a hozzárendelhető M gyorsgomb Acro → Angle → Horizon
sorrendben vált, offline és online is. Online a szerver jóváhagyja a pilóta saját
módját; a többi pilóta módja nem változik. Mért kör közbeni váltás érvényteleníti
az adott kört, a következő tiszta kör az új mód kategóriájába kerül.

A repülés menüjének „Szimulációs opciók” részében külön választható:

- Akkumulátor: a konfigurált mAh kapacitás, becsült motoráram és belső ellenállás
  alapján fogy, terhelés alatt csökken a feszültség és az elérhető motorteljesítmény.
  LOW BATTERY figyelmeztetés 20% alatt vagy tartósan alacsony cellafeszültségnél;
  LAND NOW 6% alatt vagy tartós kritikus feszültségnél. Utóbbinál az alkalmazott
  gáz ténylegesen korlátozott; teljes lemerüléskor már nem tartható a lebegés.
  A kritikus figyelmeztetés nem tűnik el a terhelés megszűnésével.
- Propellersérülés: az armolt drón propeller-ütközőinek Rapier-kontaktusából és
  ütközési erősségéből keletkezik, motoronként csökkenti a hatásfokot és vibrációt
  okoz. A védett whoopokra kisebb sérülési szorzó vonatkozik. A HUD jelzi a sérülést.
- Propwash: működő rotorokkal, a saját légörvénybe történő süllyedéskor jelentkező
  egyenetlen tolóerő. Oldalirányú kitéréskor, a légörvényből kilépve lecseng.
- Ghost mód: csak multiplayerben látható. Bekapcsolva nincs drón–drón ütközés;
  kikapcsolva a többi pilótának simított kinematikus Rapier-ütközőteste van.
  Reset/teleport nem söpör végig a pályán ütközőként; kilépéskor a test felszabadul.
  A környezettel való ütközés ghost módban is megmarad.
- Szél: szélcsend, enyhe (2 m/s), közepes (5 m/s) és erős (9 m/s) alapszél,
  fokozatos széllökésekkel. A földhöz képesti sebesség helyett a levegőhöz képesti
  sebességből számoljuk a légellenállást. Online a széllökések közös szobaórát használnak.

Alapállapot: a három fizikai extra kikapcsolva, szélcsend és bekapcsolt ghost mód.
A helyi választás mentett; helyi szünet alatt állítható. Reset feltölti az akkumulátort
és helyreállítja a propellereket. A három JSON drónkonfiguráció `simulation` blokkja
tartalmazza a kategóriánkénti becsült hangolást.

Online a szoba létrehozója választja ki a szabályokat, a lobbyban kizárólag a
házigazda módosíthatja őket. Változtatás törli mindenki készenlétét. A belépők
ugyanazokat a beállításokat kapják; indítás után a szabályok rögzítettek.
Host kilépésekor az új házigazda örökli a lobby jogosultságát.
Az állapotüzenetek eltérő szabálykulccsal nem fogadhatók el.

A fizika továbbra is kliensoldali, a szerver a közös szabályokat, módváltásokat,
állapotok és körök érvényességét ellenőrzi. A pilóták közötti ütközés helyi,
simított távoli testekre adott reakció; késleltetéses finomhangolás még szükséges.
Az opciók és a szél külön, ötkarakteres szabálykulcsú ranglistakategóriát adnak. A MariaDB migráció
megőrzi a korábbi köröket az alap `00010` kategóriában; a verziózott drónkonfiguráció
és a repülési mód továbbra is elkülönül.

Ellenőrzött: fogyás és feszültségesés, LOW BATTERY/LAND NOW és tényleges tolóerőkorlát,
valódi propellerkontaktus, propwash lecsengése, a négy szélerősség tényleges sodródása,
ghost/ütközés és testfelszabadítás, host jogosultság és átadása, indítás utáni zárolás,
szabályegyezés és személyes online módváltás, MariaDB kategóriák elkülönítése.
Böngészőben: kapcsolók, offline és online módgomb, akkufogyás, szél-HUD és rögzített szabályok.
A teljes tesztcsomag 84/84 tesztje sikeres.

## Drónszínek és multiplayer nyomvonalak

A repülés menüjében és a showroomban nyolc szín választható: narancs, sárga,
türkiz, lila, kék, zöld, rózsaszín és fehér. Mindkettő a közös palettát használja.
A játék színválasztása böngészőben megmarad, az előnézet azonnal követi.
Az X5 és C3 TPU-/védőelemei, valamint a 65 mm-es whoop váza színeződik;
a három drón akkucímkéinek narancs díszítése is a pilótaszínt követi.
A címke sötét/világos háttere és feliratai megmaradnak. A közös textúrákat
nem módosítjuk: címkénként és palettaszínenként újrahasznált külön textúra készül,
így egy másik pilóta vagy előnézet választása nem színezi át a saját címkét.
A showroom ugyanazt a színezést használja, a letöltött GLB is az aktuális címkét kapja;
a kábelek, csatlakozók, optika és PCB anyagai változatlanok. A színanyagokat
szemantikus GLB-mesh-nevek alapján jelöljük összevonás előtt, és minden előnézet,
saját drón és távoli pilóta külön anyagpéldányt kap; a geometria továbbra is közös.
A GLB nem tárolja a showroom TPU-anyagainak tone mapping kivételét és shaderét.
Betöltés és anyagklónozás után ezeket a közös `configureDronePolymer()` állítja
vissza, így a játékban is megmarad a telített szín, fényekkel és árnyékokkal.

A multiplayer szobák legfeljebb nyolc pilótát fogadnak; kilépéskor a hely felszabadul.
A Node szerver csak a paletta nyolc színazonosítóját fogadja el. A hello/appearance
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
választás és újracsatlakozás; nyolc különböző színű pilóta csatlakozása, a kilencedik
elutasítása és a kilépéssel felszabaduló hely újbóli elfoglalása; böngészőben mentett
szín és két további kliens élő nyomvonala.
A szín- és nyomvonal-ellenőrzések a teljes tesztcsomag részei.

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
- A három konfiguráció és az új akkumulátor-, sérülés-, propwash- és szélmodellek hangolása valódi repülési adatok alapján.
- Pályák látványának és kapus útvonalainak finomítása, pontosabb ütközési geometria és teljesítményprofilozás.
- A multiplayer életciklus további terheléses és több eszközös ellenőrzése.
- Mozgásellenőrzés szigorítása, késleltetéses/terheléses tesztek és szükség esetén szerveres visszaszimulálás.
- Több eszköz és kijelzőméret tesztelése, végleges hangok és megosztási kép.

A fizikai JSON-kben a `tuningStatus: initial-estimate` szándékosan megmarad:
az automatizált stabilitási tesztek nem bizonyítják a valódi drónnal azonos repülési karaktert.

## 2026-10-13 – Három drón repülési mérése

- Újrafuttatható `npm run physics:measure`: valódi Rapier/game-controller mérés, JSON-jegyzőkönyv dátummal és konfiguráció-hash-sel. Lebegés, gyorsulás, közel szinttartó utazósebesség, roll/pitch/yaw válasz és fékezés, kifutás, Angle/Horizon visszaszintezés.
- 81 bot/gáz/tengely részpróba, mindkét forgásirány; további 120/240 Hz és távoli koordinátás összehasonlítás. Az új tesztek a normál tesztcsomag részei.
- Javítva a motorerők világkoordinátás átadásának pontosságvesztése: ez a 65-ösön teljes gáznál kis kitérések hullámzását okozta. Helyi erő-/nyomatékösszegzés, változatlan motormodell és szabályozási paraméterek.
- Konfigurációverzió 4, külön ranglistakategória; személyes rate-ek változatlanok. Mért hover 27,6–28,2%, utazósebesség 78,6 / 120,6 / 196,7 km/h. Feltételek és valós adatokkal nem igazolt becslések: [physics-tuning.md](physics-tuning.md).

## 2026-10-13 – Akkumulátor és nagy repülési kijelző

- Drónonkénti LiPo/LiHV görbe, motorokból becsült áram, mAh-integrálás, terhelési feszültségesés, RC visszaállás és merülés végi teljesítménycsökkenés. Teljesen üres akkumulátor nem ad tovább tolóerőt.
- Nagy akkumulátorikon az ARM fölött, százalék, csomag-/cellafeszültség, becsült hátralévő idő, sárga LOW BATTERY és piros LAND NOW kártya.
- Opcionális marad, multiplayerben házigazda által szabályozott. Konfigurációverzió 5; részletes mezők, mérések és korlátok: [battery-simulation.md](battery-simulation.md).

## 2026-10-13 – Opcionális FPV OSD és analóg videó

- Beállítások → FPV kamera alatt két külön, alapból kikapcsolt, megjegyzett személyes kapcsoló. Egyjátékos és multiplayer FPV nézetben is működnek; a követőnézet és a menü tiszta marad.
- A Betaflight jellegű műhorizont kilenc lépcsőzetes fehér vonalszegmensből, fix oldalsó és középjelölésből áll. A drón interpolált testhelyzetéből származó gravitációvektor alapján követi a pitch/roll dőlést, a yaw-tól és kameraállítástól függetlenül. A 20° pitch / 40° roll műszerkitérés a klasszikus [Betaflight OSD](https://github.com/betaflight/betaflight/blob/4.5.2/src/main/osd/osd_elements.c) megjelenítési tartományához igazodik; saját SVG-megvalósítás.
- Az analóg kép szemcsézettséget, scanline-okat, enyhe színtelítettség-/kontrasztváltozást és vignettát kap. A játék világára kerül, a HUD olvasható marad. Kis, előre kirajzolt SVG zajcsempe és CSS-kompozitálás; nincs extra Three render-target vagy shaderpassz. Csökkentett mozgás beállítás mellett a zaj statikus.
- Automatikus irány-/yaw-/fliptesztek; böngészőben kapcsolók, újratöltés utáni mentés, tényleges dróndőlés, követőnézet, menü, mobilos fekvő elrendezés és hibamentes konzol ellenőrzött. Mind az öt nyelven fordított beállítások.

## 2026-10-13 – Talaj- és épületközeli fizikai optimalizálás

- Mindkét pályán előre bekészített, tömörített, térben felosztott ütközési geometria. A dobozok összevont háromszöghálók, a kerek alakzatok megőrzik az eredeti geometriát. A kapuk külön maradnak.
- Kisebb, sebességirányba előretöltő fizikai környezet; változatlan látványbetöltés. Ütközési előkészítés a töltőképernyőn, a ligetben a véges bekészített területen túl fizikai csupasz talaj folytatódik.
- Mért fizikai részidő épület/átjáró közelében 1,3–1,4 ms helyett 0,15–0,19 ms négy fizikai lépésre. Részletek, reprodukálható böngészős mérés és geometriai ellenőrzések: [collision-performance.md](collision-performance.md).

## 2026-10-13 – Multiplayer visszatérés és futameredmények

- Kapcsolatvesztés után a szerver 60 másodpercig fenntartja a pilóta helyét. Ugyanabban a böngészőlapban az újratöltés is visszatér; külön, laponként mentett titkos kulcs azonosítja a kapcsolatot.
- A pilóta azonosítója, színe, repülési módja és teljesített körei megmaradnak. Az aktuális kör újrakezdődik, a drón a rajthelyre kerül és újra ARM-olni kell. A többiek futama folytatódik.
- A kapcsolat nélküli drón nem marad ütköző objektum. A házigazda szerepét szükség esetén egy csatlakozott pilóta veszi át. A visszatérés megszakítható; a kifejezett kilépés nem válik automatikus visszalépéssé.
- A házigazda lezárhat egy futamot, majd ugyanabban a szobában készítheti elő a következőt. Pálya, útvonalpillanatkép, drón és szabályok megmaradnak; minden pilóta új készenlétet jelöl. Minden futam saját azonosítót kap.
- Külön eredményképernyő: saját helyezés, pilóták, körszám, legjobb kör, összidő és állapot. Az időközben kilépett pilóták sem tűnnek el a futam résztvevői közül; nem teljesített verseny esetén DNF-et kapnak.
- A futameredmény egyetlen, változtathatatlan pillanatképként kerül mentésre; az ismételt lezárás, visszatérés és új futam nem duplázza az eredményt. A korábbi futam protokoll-2 csomagjait a szerver figyelmen kívül hagyja.
- A szobák továbbra is a futó Node-folyamatban élnek; a Node újraindítása után a már mentett rekordok/eredmények megmaradnak, de az élő szobákat újra kell létrehozni.
