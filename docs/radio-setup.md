# RadioMaster / EdgeTX bemenet

Az automatikus eszközválasztás előnyben részesíti a név szerint felismert
RadioMaster/EdgeTX rádiót más gamepadokkal szemben. Konkrét eszköz is választható.
A profil készülék, böngészős kiosztás és tengelyszám szerint mentődik, így a
telefon és a PC eltérő USB-sorrendje nem írja felül egymás kalibrációját.

## Ajánlott profilok

A 3D távirányító karjai csatlakoztatott rádiónál a tényleges, kalibrált bemenetet
követik, beleértve az invertálást és a botfelismerés közben megtalált tengelyeket.
Külön mozgó pont nincs. A narancs kiemelés és a nyilak az útmutatást mutatják;
USB rádió nélkül maguk a karok mutatják be a kiválasztott mozdulatot.
A négyszögletes tartókeret, a csapágyak és a ház fixek; csak a bot szára és
feje fordul a gömbcsukló középpontja körül. A teljes botút tesztje a fix
alkatrészek mozdulatlanságát is ellenőrzi.

A meglévő rádiómodell az első választás; külön SIM modell nem általános feltétel.
A botfelismerő a kisebb (például mix vagy rate miatt csökkentett) analóg kitérést
is felismeri és végpontokra skálázza. A felismerési lépés élő jelzése megkülönbözteti
a hiányzó mozgást, kapcsolójelet, már felismert tengelyt és túl kis kitérést.
A nyers USB-listában az aktuális érték és az adott lépés min/max értéke látszik;
az A1, A2… számozás böngészős tengely, nem a rádió CH-kiosztása.

- **AETR**: EdgeTX Classic USB, CH1 roll, CH2 pitch, CH3 throttle, CH4 yaw.
  Desktopon a böngészős tengelyek 0, 1, 2, 3. Alapirányok módosíthatók.
- **Android USB**: az újabb Chromium-bemenet X/Y/Rx/Ry/Z/Rz sorrendjében
  a roll/pitch 0/1, yaw 2, throttle 4. A kapcsolókat nem használjuk yaw/gáz helyett.
- **Mode 2 gamepad**: bal bot yaw/gáz, jobb bot roll/pitch.
- **Egyéni**: a Botok felismerése négy irányított mozdulatból elmenti a
  csatornákat, előjeleket, középértékeket és a gáz végpontjait. Kétállású kapcsolót
  nem fogad el analóg botként. Csak a teljes folyamat végén cseréli a profilt.

A pitch invertálása a nyers FPV rádiós profilokban alapból **kikapcsolt**,
a szabványos gamepad-profilban **bekapcsolt**, a két USB-tengelyelőjelhez igazodva.
A cél mindkettőnél bot előre → drón orra le. Az érintetlen régi presetek
átveszik az új alapértéket; az egyéni invertálás, csatornakiosztás, kalibráció,
gombhozzárendelések és holtjáték megmaradnak. A botfelismerő továbbra is a tényleges
mozdulatból tanulja meg az előjelet, a rádió saját mixeitől függetlenül.

Egyéni repülési modell, invertált mix vagy Advanced USB esetén a névből nem
derül ki a rádió tényleges csatornasorrendje. Erre való a botfelismerő.
Egy Xbox név mögé rejtett virtuális rádiót nem lehet biztosan RadioMasterként
azonosítani; ilyenkor kézzel kiválasztható profil vagy használható a felismerő.

## Régebbi Android: ténylegesen elvesző csatorna

Az Android/Chromium régi ismeretlen-gamepad kezelése a Z és Rx, illetve Ry és Rz
csatornákat összevonhatja, csak négy tengelyt adva a weboldalnak. Classic AETR
esetén a Z gázcsatorna elveszhet, a másik bottengelyre pedig AUX kerülhet.
Ezt a weboldal a már elveszett értékből nem tudja visszaállítani.
A nem igazolt automatikus kiosztást jelezzük, semleges bemenetet adunk és ARM-ot tiltunk.
A négy böngészős tengely önmagában még nem bizonyít csatornavesztést: egy teljes,
botfelismeréssel ellenőrzött négytengelyes kiosztás ugyanúgy használható.

Egy külön, **csak szimulátoros** rádiómodell Classic USB-vel is kerülőút lehet:

| Kimenet | Forrás |
| --- | --- |
| CH1 | Ail / roll |
| CH2 | Ele / pitch |
| CH3 és CH4 | Thr / gáz |
| CH5 és CH6 | Rud / yaw |

Ehhez válaszd a **RadioMaster · Android SIM modell** játékprofilt.
A megkettőzött analóg jelekből az Android régi és új kiosztása is megtartja
mind a négy repülési vezérlőt. Desktopon ugyanez a profil CH3 gázt és CH6 yaw-t használ.
A tényleges repülési rádiómodell maradjon külön.

Ha a rádió firmware-ében elérhető Advanced USB, az Ail/Ele/Thr/Rud → X/Y/Z/Rz
kiosztás is használható az AETR játékprofillal. Advanced USB nem minden Pocket
firmware-verzióban érhető el; ezért nem erre alapozzuk az egyetlen megoldást.

## Ellenőrzés

- Szimulált USB-sorrendek, zajos AUX kapcsolók, részleges bemenet,
  profilváltás, régi profil migrációja és négyirányú botfelismerés tesztelve.
- Fizikai Pocket/TX15 és valódi Android USB-változatok még hardveres próbát igényelnek.
- A preset nem tudja felülírni a rádió saját mixeit vagy az operációs rendszer
  által eldobott HID-adatot. Nem állítjuk, hogy minden rádiómodell módosítás nélkül működik.

Elsődleges források:

- [EdgeTX Classic USB és csatornakiosztás](https://manual.edgetx.org/v2.9/edgetx-user-manual/user-manual-for-color-screen-radios/model-settings/model-setup/usb-joystick)
- [EdgeTX firmware USB-jelentése](https://github.com/EdgeTX/edgetx/blob/main/radio/src/usb_joystick.cpp)
- [Chromium Android gamepad-leképezés](https://github.com/chromium/chromium/blob/main/device/gamepad/android/java/src/org/chromium/device/gamepad/GamepadMappings.java)
- [EdgeTX joystick-kompatibilitás és Advanced korlátok](https://manual.edgetx.org/edgetx-how-to/configure-advanced-joystick-with-edgetx)
