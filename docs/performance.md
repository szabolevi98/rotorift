# Pályák teljesítményjavítása

## 2026-10-16 – ritka megakadások vizsgálata

A beküldött Liget/Rift 75 jelentés 97 képkockája kb. 1,29 másodpercnyi,
stabil 75 FPS-es szakaszt tartalmazott, 13,5 ms-os maximális intervallummal.
Ebből a korábban érzékelt megakadás oka nem állapítható meg.
A mérő megnyitásakor elvesző előzmény javítása és a jelentés számai a
[diagnosztikai jegyzetben](frame-diagnostics.md) szerepelnek.

A CPU-előzmény most zárt panelnél is készül, fix méretű körpufferbe.
Panelmegnyitás nem nullázza a felvételt, és külön megmarad az indítás/nullázás
óta legrosszabb képkocka. GPU-lekérdezés csak nyitott panelnél történik.
A böngészős exportpróba 747 mintát, 9,99 másodpercnyi intervallumot tartott meg,
több mint 500, még a panel megnyitása előtt rögzített CPU-only mintával;
a tíz másodperces ablakból már kiesett csúcsminta is az exportban maradt.

A fejlesztői mérőoldal `frames` paramétere 30–600 mintát enged helyzetenként.
Ha meg van adva, a mintavétel valódi animációs képkockákra oszlik, nem egyetlen
hosszú főszál-feladatban fut. Legfeljebb 20 bemelegítő minta után átlag, p95 és
maximum render/GPU-, valamint fizikai részidőt közöl. Példa mind a négy pályára:

`/performance.html?variant=moving&physics=prepared&drone=rift-75&hold=1&frames=120&prepare=1`

A `prepare=1` a játékban is használt aszinkron shader-előkészítést futtatja,
egyszer pályabetöltéskor. Nélküle a mérőoldal hideg shaderprogramokat vizsgál,
így nem szabad az eredményt előkészített játékrepülésként értelmezni.
A legrosszabb renderhez külön CPU-idő, `gl.finish()` várakozás és előtte/utána
programszám tartozik; az utóbbi új shaderfordítást jelezhet.

A mérőlapot aktív böngészőben kell futtatni: a háttérlap animációs ütemezését
a böngésző korlátozhatja. A teszt előre kijelölt, közeli talaj/épület helyzeteket
vizsgál; a drón helyét a `hold` mód tartja, kezdeti sebessége 7 m/s.
Négy fizikai lépést mér mintánként. Nem teljes felületes játék-FPS, nem több
különböző készüléken végzett teszt, és nem bizonyítja minden ritka akadás hiányát.
`gl.finish()` továbbra is csak ezen a fejlesztői lapon szerepel, a játékban nincs.

### A hideg és az előkészített shaderes játszótéri próba

GTX 1080 / ANGLE D3D11, 1280 × 504, Rift 75, mozgó kamera, helyzetenként
180 képkocka, 20 bemelegítő után 160 minta. Az előkészítés nélküli
`outside` helyzetben 89,6 ms-os csúcs ismétlődött: 89,5 ms CPU-render,
0,1 ms GPU-várakozás, a programok száma 4-ről 5-re nőtt. A korábbi négy pályás,
120 képkockás hideg próbában ugyanezen a helyen 114,9 ms volt a csúcs.

A játékban már használt `compileForTarget` előkészítésével, változatlan
geometriával az `outside` csúcsa 2,9 ms-ra csökkent; a programszám végig 9
maradt. A másik négy közeli helyzet rendermaximuma 0,9–1,1 ms, a négy fizikai
lépés maximuma az öt helyzetben 1,9–2,9 ms volt. A hideg fejlesztői teszt
csúcsa tehát nem bizonyít a már előkészítést használó játékban új shaderhibát.
Az eredeti beküldött, stabil FPS-szakasz alapján más konkrét ok nem igazolható.

Az előkészített, négy pályás végső próbában 18 helyzet és helyzetenként
120 képkocka szerepelt (20 bemelegítő, 100 értékelt minta). A táblázat
pályánként a helyzetek legnagyobb p95 és maximum részidejét mutatja, ms-ban:

| Pálya | Render/GPU p95 | Render/GPU max. | Fizika, 4 lépés p95 | Fizika, 4 lépés max. |
| --- | ---: | ---: | ---: | ---: |
| Betonudvar | 5,2 | 6,9 | 2,6 | 3,2 |
| Liget | 3,6 | 4,4 | 2,2 | 2,9 |
| Játszótér | 0,9 | 2,8 | 1,9 | 2,5 |
| Skyline | 1,1 | 1,9 | 1,4 | 2,4 |

Ezekben az előkészített próbákban nem reprodukálódott a súlyos megakadás;
a legrosszabb renderek alatt sem nőtt a shaderprogramok száma.
A [nyers saját mérési jegyzőkönyv](performance-measurements-2026-10-16.json)
a hideg és előkészített teszteket is megőrzi. A felhasználó eredeti teljes
jelentését nem másoljuk a publikus repóba. Más készülékek hosszabb valódi
repülése és egy újabb, tényleges FPS-esést tartalmazó felvétel továbbra is szükséges.

## Betonudvar kisebb tárgycsoportjai — 2026. október 14.

Egy északi szállító teherautó és tizenkét kisebb tárolócsoport került az
üres helyekre: hordók, raklapos anyagok, kábelcsévék és egy nyitott hulladékos
konténer. A csoportok a kerítésen belül, a munkautakon kívül maradnak; a
kisebb raklapok és csévék a meglévő talaj lejtéséhez igazodnak.
A tárgyak a meglévő régiós instancinget és egyszerű analitikus ütközőket
használják. A Betonudvar verziója 3; az újragenerált ütközési fájl
8301 alakzatot tartalmaz, és 1 984 573 bájt tömörítve, körülbelül 18 kB-tal
több a korábbinál. A pályanézőben két új nézet mutatja a tárolóhelyeket.
Az önálló, mozgó kamerás próba GTX 1080-on, 1280 × 504-es renderfelületen
2,18–3,37 ms render/GPU-időt és 0,59–1,35 ms költséget mért négy fizikai
lépésre a bejáratnál és a betonváz két nézetében. Ezek részidők, nem teljes
képkockaidők vagy minden gépre érvényes FPS-ígéretek.

## Játszótér talajának villogása — 2026. október 14.

A 262 km széles kirajzolt talajdoboz alacsony FPV-nézetben mélységi és
vágási hibát okozott: mozgáskor a talaj egyes részein az ég látszott. A
közeli föld kétméteres háromszögekre, a külső föld külön részletességi
gyűrűkre váltott. A fű nem kerül a megemelt burkolatok alá. A kerti sétány
szegmensei és körívei előre összevont felületként készülnek, zárt oldalfalakkal.

Az elkülönített böngészős GPU-próba 0,15–2 m magas, döntött kamerákból,
0,001 és 0,012 m közeli vágósíkkal 155 268 talajmintát ellenőrzött.
A korábbi talaj 26 568 mintánál az eget mutatta; az új talaj egyiknél sem.
A megvilágított összehasonlítás 48 kameraállást vizsgált. Ez helyi
regressziós mérés, nem minden gépre szóló grafikus garancia.

A mozgó kamerás, előkészített fizikás próba GTX 1080-on, 1280 × 504-es
renderfelületen 0,48–0,85 ms render/GPU-időt és 0,60–1,25 ms költséget
mért négy fizikai lépésre. A 880 analitikus játszótéri ütköző és a
tömörített ütközési fájl változatlan; a renderelés nem teszi nehezebbé a CCD-t.
27 pálya-, burkolat-, ütközési és versenyútvonal-teszt sikeres.

## Korábbi pályateljesítmény-vizsgálatok

2026. október 12. A Betonudvar és a Liget épületeinek környezetében jelentett
lassulás után készült összehasonlító mérés és javítás.

## Fizika

A Rapier 0.14 `World.step()` minden lépés végén frissíti a scene-query indexet is.
A repülés nem használ raycastot: a tényleges kontaktusokat és CCD-t a külön
physics pipeline számolja. Repülésben ezt a teljes pipeline-t futtatjuk 240 Hz-en,
az el nem használt lekérdezési index újraépítése nélkül. A `DronePhysics` alapértéke
továbbra is `updateSceneQueries: true`, így a raycastot használó kódok működése megmarad.
Későbbi repülésbeli raycast előtt `world.updateSceneQueries()` szükséges.

A statikus alkatrészek fizikai aktivitása a drón körül 40 m-es környezetre
korlátozódik; 8 m mozgás után ellenőrizzük újra. A teljes világkoordinátás AABB
számít, így hosszú gerendák, födémek és rámpák közepe helyett a legközelebbi részük
határozza meg az aktiválást. A 32 m-es tartalék jóval nagyobb az egy képkockában
szimulált maximális elmozdulásnál. Teleport/reset azonnal újraértékel.
A talaj és a Liget korábbi közeli terepterületei továbbra is aktívak.
A látvány, az összes pályaobjektum és az ütközők geometriája megmaradt.

Node.js/WASM próba: Rift X5, semleges bemenet és lebegési gáz; 240 bemelegítő,
2400 mért lépés. Az érték négy fizikai lépés átlagos költsége, azaz a fizika
része egy 60 FPS-es képkockában; nem a teljes képkockaidő.

| Hely | Korábban | Javítva |
| --- | ---: | ---: |
| Betonudvar, bejárat | 11,41 ms | 0,27 ms |
| Betonudvar, alsó betonváz | 11,51 ms | 1,17 ms |
| Betonudvar, felső betonváz | 10,98 ms | 1,22 ms |
| Liget, ház előtt | 4,21 ms | 0,90 ms |
| Liget, átjáró | 3,84 ms | 1,54 ms |
| Liget, üveges emelet | 3,56 ms | 1,07 ms |

## Árnyékok és renderelés

Mind a négy 2048² árnyéktérkép és az 1600 m-es árnyéktávolság megmaradt.
Újrarajzolás akkor kell, amikor a CSM texelhez igazított lefedése változik,
a kamera vetítése változik, új/törölt/láthatóvá tett árnyékvető jelenik meg,
vagy látható mozgó drón van. Kis fényirányú eltolás a meglévő 200 m-es
árnyékvető-tartalékban maradhat; 50 m-nél újrarajzolunk. A régi árnyékmátrix
és a hozzá tartozó térkép együtt marad érvényes. Külső nézetben és multiplayerben
a mozgó drónok miatt folyamatos a frissítés. Menüben az elfedett játékjelenet
nem renderel tovább az előnézet mellett.

A logaritmikus mélységkezelés, a renderfelbontás, az anyagok és a geometria
megmaradtak; a korábban javított távoli talaj mélységpontosságát nem rontjuk vissza.

Böngészőpróba: 1280 × 504 képpont, GTX 1080 / ANGLE Direct3D11.
Helyenként 30 render, 6 bemelegítő után a 24 átlagát vesszük; `gl.finish()`
kizárólag a fejlesztői mérésben várja meg a GPU-t. A táblázat a renderelés és
GPU-befejezés ideje, fizikát és felületet nem tartalmaz. A mozgó kamera renderenként
0,25 m-t halad, változatlan tekintési iránnyal. Ezek összehasonlító helyi mérések,
nem általános FPS-ígéretek.

| Hely | Álló kamera, korábban → javítva | Mozgó kamera, korábban → javítva |
| --- | ---: | ---: |
| Betonudvar, bejárat | 6,01 → 1,87 ms | 6,68 → 3,15 ms |
| Betonudvar, alsó betonváz | 5,01 → 0,90 ms | 4,33 → 2,23 ms |
| Betonudvar, felső betonváz | 3,59 → 0,72 ms | 3,94 → 1,96 ms |
| Liget, ház előtt | 4,84 → 2,53 ms | 4,05 → 2,61 ms |
| Liget, átjáró | 4,08 → 1,71 ms | 3,80 → 2,61 ms |
| Liget, üveges emelet | 3,59 → 1,61 ms | 3,42 → 2,38 ms |

Fejlesztői grafikus mérőoldal: `/performance.html`.
Mozgó próba: `/performance.html?variant=moving`; a korábbi, minden renderben
újrarajzolt árnyékokkal: `/performance.html?variant=moving&original=1`.
A mérőoldal külön fejlesztői eszköz, nem módosít mentett beállításokat vagy játékállapotot.
Az intenzív mérést ne futtassuk a játék közben ugyanazon a GPU-n.

## Ellenőrzések

### A Betonudvar domborzati átdolgozása után

A kétméteres tereprács 36 látható területből áll; a hozzájuk tartozó ütközők
szintén a 40 m-es fizikai környezet alapján kapcsolódnak be. Az új gödrök,
rámpák és földdepók után a 240 Hz-es fizika négy lépése a bejáratnál 0,18 ms,
az alsó betonvázban 1,10 ms, a felső betonvázban 1,29 ms volt.
A 1280 × 504-es, mozgó kamerás grafikus próba rendre 3,90 / 2,30 / 3,01 ms.
Ezek helyi mérések, nem teljes képkockaidők; a kamera magassága most az új
építési terasz magasságával korrigált. A korábbi táblázat a sík terep változatát méri.

Új tereptesztek ellenőrzik a rácspontok közötti ütközési magasságot, a rámpák
lejtését, az alaptestek talajhoz illeszkedését, a vízszintes épületpadokat,
a kerítésen túli csupasz talajt és a korlátos fizikai aktivitást.

A hangár, a betonkeverő telep, a szerelőudvar, a külső terepgyűrűk és a skyboxok
hozzáadása után 67/67 teszt sikeres. A bejáratnál 0,50 ms, a két betonváz-nézetben
1,32 / 1,45 ms volt a négy fizikai lépés helyi átlagköltsége. A mozgó kamerás
grafikus próba a Betonudvaron 4,77 / 2,71 / 2,54 ms, a Ligeten 2,91 / 2,80 / 2,52 ms
volt (azonos 1280 × 504-es mérési felület, GTX 1080). A bővebb geometria látható
marad; a távoli talaj is kapott részletességi szinteket, a fizikai aktivitás helyi.
A felhőzet szférikus textúrája időjárásonként egyszer készül el, a tükröződési
kép mapváltáskor frissül. Nincs képkockánkénti felhőzaj-számítás vagy PMREM-render.
Az ég színéhez illő fényintenzitások megváltoztak, ezért ez a grafikus mérés
az új látvány költségét mutatja, nem azonos látvány melletti gyorsulást.

A közös teljesítményjavításkor 63/63, a domborzat átdolgozása után 64/64 teszt sikeres.
A teljesítményjavítás ellenőrzései: hosszú ütközők és teleportos újraaktiválás,
60 m/s-os CCD-falütközés helyi aktivitással, azonos fizikai/kontaktus/CCD-pálya
lekérdezési index frissítésével és anélkül; statikus árnyékcache és helyes
érvénytelenítés mozgásnál, vetítésváltozásnál, új árnyékvetőnél és mozgó drónnál.
A távoli árnyéklefedés, a pályaátjárók és az újratöltés korábbi ellenőrzései is sikeresek.
