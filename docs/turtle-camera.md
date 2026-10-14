# Turtle mód és drónonkénti kamera

## Használat

- DISARM, majd gáz teljesen le.
- Turtle bekapcsolása: alapértelmezetten **T**, a HUD **Turtle mód** gombja,
  vagy a beállításokban hozzárendelt rádiós gomb/AUX kapcsoló.
- ARM, majd a jobb stick roll vagy pitch tengelyével fordítsd át a drónt.
  Billentyűzeten ugyanezt a döntéshez beállított billentyűk végzik.
- Amikor talpra került: DISARM → Turtle kikapcsolása → normál ARM.
- A Turtle csak disarmolt állapotban váltható. Reset és szüneteltetés kikapcsolja.

A domináns roll/pitch irány egy motorpárt fordított forgással hajt; gáz és yaw
nem ad normál emelőerőt ebben a módban. Az átfordítás a Rapier erő- és
talajérintkezés-szimulációjával történik. Nem módosítjuk közvetlenül a drón
pozícióját vagy orientációját, és nem javítjuk a propellereket vagy az akkumulátort.
Akkumulátor-szimuláció és propellersérülés mellett ezek az átfordítást is érintik.

Az alap fordított tolóerő-korlát a motor maximumának 45%-a, stickfüggően;
2–3 rad/s között fokozatosan visszavesszük a teljesítményt. Közel talpon álló
drón nem kap további fordított tolóerőt. Ezek játékbeli hangolási értékek,
nem megmért ESC-/propelleradatok. Később drónkonfigurációból a
`simulation.turtlePowerFraction` értékkel hangolható (0,05–0,6 tartomány).
A mód az Acro/Angle/Horizon választástól független. Multiplayerben az állapot
és a négy motor sebessége együtt terjed; a távoli modellek is fordított
forgást mutatnak. Régi kliens, szünet, elavult állapot vagy reset ezt leállítja.

## Kamera

A **Beállítások → FPV kamera** panelen kiválasztható a drón, majd külön
menthető a kamera dőlése (0–60°) és a látószög (70–140°).
A **Minden drónra** gomb másolja a kiválasztott profil két értékét;
az **Alapértékek** csak a kiválasztott drónt állítja vissza 20° / 100° értékre.

Mentés: `localStorage` → `rotorift.camera-profiles`, drónazonosító szerint.
A régi közös kamerabeállításból az első betöltéskor minden drón örököl,
így a meglévő személyes értékek megmaradnak. A repülés indítása és a
multiplayer-szoba drónjának betöltése automatikusan a megfelelő profilt alkalmazza.
Másik drón profiljának szerkesztése nem változtatja meg az éppen repülő drón
kameráját. A motorhang, műhorizont és analóg effekt továbbra is közös személyes opció.

## Ellenőrzés

- Öt drón × hat roll/pitch kitérés: valódi talajérintkezésből átfordulás,
  majd disarm után stabil talpon maradás. Külön teszt az energia és sérülés megőrzésére.
- Fordított helyi/távoli propellerforgás; AUX kapcsoló on/off és mentés;
  hálózati validálás, szünet/reset/kapcsolatvesztés.
- Kameraprofilok migrációja, elkülönítése, érvénytelen értékek elutasítása.
- Böngészős ellenőrzés: HUD gombok, állapotüzenetek, billentyűs kapcsolás,
  drónváltó és kameramentés újratöltés után.
- Valódi USB rádiós és Android-hardverteszt továbbra is külön ellenőrzés.
