# Képkockasebesség és teljesítménymérés

## A monitor nem ad repülési sebességelőnyt

A renderelés `requestAnimationFrame` ütemezést használ, a fizika fixen
**240 Hz-en** számol. A képkocka eltelt idejét az akkumulátor összegyűjti,
és ennek megfelelő számú 1/240 másodperces lépés fut. 60 FPS körül négy,
120 FPS körül kettő; 35 FPS esetén felváltva hat-hét lépés jut egy képkockára.
Az interpoláció csak a kirajzolt modell helyét változtatja.

A `tests/fixed-step.test.js` mind az öt drónra ugyanazt a három másodperces
repülést futtatja 30, 35, 60, 75, 120, 144 és 240 Hz-es képkockákkal,
valamint váltakozó 60/35/120 FPS-sel. A fizikai lépésszám, pozíció, orientáció,
sebesség, motorerő és akkufogyasztás egyezik. Apró lebegőpontos tolerancia
biztosítja, hogy például 144 Hz-en ne vesszen el egy lépés az osztási maradéknál.

100 ms-nál nagyobb megakadásnál a korábbi védőkorlát megmarad: legfeljebb
24 fizikai lépés fut egy képkockában. Ez nagy akadásnál eldobhat szimulációs
időt, de nem gyorsítja a drónt. A panel külön kiírja az így kihagyott időt.

## A ritka beesés rögzítése

Repülés közben kattints a bal felső **FPS** számra. Hagyd nyitva a panelt,
és egy beesés után nyomd meg a **JSON letöltése** gombot.
A jelentés a legutóbbi tíz másodpercet őrzi (legfeljebb 2000 minta), a legrosszabb
képkockával, pálya/drón/nézet/pozíció adatokkal és renderfelbontással.
Csak helyi letöltés történik, automatikus feltöltés nincs.

A panel külön méri:

- Valódi megjelenítési képkockaidő: átlag, p95 és maximum.
- Teljes játék-képkocka CPU-ideje; ezen belül pálya-/ütközésfrissítés,
  fizika (a versenyellenőrzéssel együtt), renderhívás és egyéb munka.
- GPU rajzolási idő, ha a böngésző támogatja az
  [`EXT_disjoint_timer_query_webgl2`](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/)
  bővítményt. A CPU-renderidő nem a GPU ideje, és ezek részben átfednek.
- Rajzolási hívások, háromszögek, fizikai lépések száma és kihagyott szimulációs idő.
- Exportban a támogatott böngészők 50 ms feletti főszál-feladatai is szerepelnek.

A megjelenítési intervallumot az azt megelőző képkocka CPU-/GPU-munkájához
kötjük, így a legrosszabb képkocka nem a következő, már olcsó képkocka költségeit mutatja.
Szüneteltetés és háttérbe kerülés nem számít megakadásnak. A panel zárása leállítja
a mérést és felszabadítja a GPU query objektumokat. A mérési adatok nincsenek mentve
a felhasználói beállításokba.

GPU-mérésnél nincs `gl.finish`, szinkron várakozás vagy végtelen polling.
Képkockánként egyszer ellenőrizzük a később megérkező eredményeket,
legfeljebb négy függő query lehet, érvénytelen/disjoint eredményt eldobjuk.
Ha nincs timer-támogatás, a GPU-sor „Nem elérhető”, a CPU-adatok tovább működnek.

## Ellenőrzés

A teljes tesztcsomag 320 ellenőrzése sikeres; utána külön teszt került be a
képkockaintervallumok helyes hozzárendelésére és a szünet kizárására.
Böngészőben a panel, GPU-eredmények, működő JSON-letöltés és jelentésformátum
ellenőrzött. Egy rövid helyi X35/Betonudvar próba kb. 75 FPS mellett
nem reprodukálta a jelzett 60 → 35 FPS beesést; a konkrét okhoz egy
ilyen beesést tartalmazó felvétel szükséges.
# View-switch shader preparation (2026-10-15)

The first transition from clean FPV to a visible aircraft previously compiled
the aircraft's lit/CSM programs inside the live render frame. Analog FPV also
introduces separate linear render-target variants and its post-process program.
The camera switch itself took 0–0.2 ms; program compilation caused the hitch.

Local browser measurements on Playground / Rift X5, using the same render
sequence with analog off/on and all three views:

| First use | Render CPU before | New programs before | Render CPU after | New programs after |
| --- | ---: | ---: | ---: | ---: |
| External | 460.9 ms | 7 | 3.2 ms | 0 |
| Clean analog FPV | 152.0 ms | 4 | 1.4 ms | 0 |
| Visible-aircraft analog FPV | 2771.7 ms | 5 | 2.3 ms | 0 |

All twelve prepared transitions took 0.6–3.2 ms render CPU, with approximately
13.2–13.4 ms frame intervals in this local test. These are measurements of this
scene and browser, not a frame-rate guarantee for other devices or positions.

Solo and multiplayer loading now register the visible drone's CSM materials,
compile the required programs with `compileAsync`, and render preparation frames
under the loading screen to upload buffers and prepare depth/shadow variants.
This does not step physics, alter the selected view, or change flight speed.
Analog programs are only prepared when the option is enabled; enabling it later
uses a short translucent loading overlay in settings. Normal rendering is held
while preparation owns the camera; multiplayer simulation continues.

The output target is restored before awaiting parallel shader completion.
Cancelled loads cannot render over a newer aircraft. CSM projection uniforms
are shared between direct and analog shader variants so the changing near plane
stays consistent after switching views.
