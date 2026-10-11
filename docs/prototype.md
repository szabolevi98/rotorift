# Rotorift 0.1 – első repülési prototípus

2026. október 11. A teljes kiadás követelményeit a `plan.md` tartalmazza;
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
| Pályák         | Liget park és Betonudvar építkezés, saját 3D kapukkal és útvonalakkal                                       |
| Helyi játék    | Szabad repülés, kapus időmérő, elkülönített helyi rekord                                                    |
| Multiplayer    | Szobakód, nyilvános lista, lobby, készenlét, szerveres rajt, 20 Hz-es állapotok és távoli modellek          |
| Verseny        | Háromkörös online verseny, kapusorrend és irányellenőrzés, élő scoreboard, teljes futamidő szerinti befutás |
| Adattárolás    | MySQL/MariaDB profilok, köridők és futameredmények; kategóriánkénti ranglista                               |
| Nyelvek        | EN/HU/DE/FR/ES, mentett választás, dinamikus felület és meta description                                    |
| Arculat        | Rotorift ikon, favicon, saját narancssárga arculat; külön megmaradó showcase                                |

## Ellenőrzések

Az `npm test` a következőket ellenőrzi:

- Actual Rates teljes kitérése, középső meredeksége, expo-ja és előjele.
- Rádiócsatornák kiosztása, kalibrált tartománya, fordítása, holtjátéka és hiányzó csatorna kezelése.
- Mindhárom drón gravitációja, kiegyensúlyozott lebegése, motorválasza és földi ütközése.
- Acro attitűdtartás, Angle/Horizon pitch és roll visszaszintezés; motorhatáron is kiegyensúlyozott semleges állapot.
- Fizikai integráció összevetése 120 és 240 Hz-en.
- Kapu iránya, nyílása, interpolált átlépési ideje, sorrendje és érvénytelen kör kezelése.
- Valódi két WebSocket kliens közös szobája, készenlét, rajt, három szabályos kör, körmentés és futameredmény.
- Ismételt csomag, hibás konfiguráció, megszakítás és hosszú állapotküldési szünet kezelése.
- MariaDB profil és kategóriarekord megőrzése új adatbáziskapcsolaton át, futameredmény idempotens mentése; külön tesztadatbázison.
- Fordításikulcsok egyezése mind az öt nyelven, HTML-lefedettség; statikus fájlok kiszolgálása.

Valódi böngészőben ellenőrzött: mindhárom modell betöltése, billentyűzetes élesítés és
felszállás, menü miatti leállítás, rate-ek másolása, nyelvváltás és metaadatok;
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
