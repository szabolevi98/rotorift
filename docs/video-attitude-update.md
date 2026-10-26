# Rotorift – javított dróndőlés a videókban

2026-10-26. A legújabb változatok a **49 másodperces trailer V4** és a
**28 másodperces Shorts V3**, mindkettő 60 fps. A jelenetek, kameraútvonalak,
autószínek és időzítések megmaradtak. A módosítás a filmrenderben van.

## Letöltés és reprodukció

| Videó | Formátum | Archívum |
| --- | --- | --- |
| Trailer V4 | 1920×1080, 49 s, 2940 képkocka | [ZIP](../media/rotorift-trailer-v4-2026-10-26.zip) |
| Shorts V3 | 1080×1920, 28 s, 1680 képkocka | [ZIP](../media/rotorift-shorts-v3-2026-10-26.zip) |

Közvetlen GitHub-letöltés:
[Trailer V4](https://github.com/szabolevi98/rotorift/raw/refs/heads/main/media/rotorift-trailer-v4-2026-10-26.zip),
[Shorts V3](https://github.com/szabolevi98/rotorift/raw/refs/heads/main/media/rotorift-shorts-v3-2026-10-26.zip).

Mindkét ZIP önálló: a kész MP4, a teljes renderforrás, a rögzített függőségek,
az eredeti hang, a tesztek és a részletes magyar `README.md` is benne van.
A gyors visszaállításhoz a kibontott gyökérben:

```powershell
python -m pip install imageio-ffmpeg==0.6.0
python finalize.py
```

Ez bájtpontosan másolja a mestert, és teljes kép-/hangdekódolással,
fájllenyomattal és H.264/AAC streamlenyomatokkal ellenőrzi. A teljes új
GPU-render leírása és parancsai a ZIP `README.md` fájljában vannak.

## A javítás

A legújabb kiadásban a **Rift 65 további 12°-os filmes előredőlést** kapott.
A külső közeli nézetben kb. 23° a dőlése, a teljes tornatermi útvonalon
18,8–25,2°. A rásegítés 0–3 m/s között simán lép be, álló lebegésnél és
hátradőlő fékezésnél nem aktív. Ez szándékos képi beállítás. Csak a gym klip
készült újra; minden más kódolt jelenet és a hang az előző kiadásból maradt.
A játék változatlan.

A fix 6,3°-os dőlés helyett a sebességből, gyorsulásból, tömegből és a
katalógus légellenállási adataiból becsült bólintás vezérli a drón testét.
A lágy filmes szögkorlát és a 0,25 s-os simítás megőrzi a közeli kamerák
olvashatóságát. Ez továbbra is tervezett kamerás animáció, fizikai adatokkal
indokolt közelítéssel; nem ténylegesen végigjátszott repülés.

| Drón | Mért bólintás a teljes forrásjelenetben |
| --- | --- |
| X5 | 42,25–52,06° |
| C3 | 20,79–34,07° |
| Rift 65 | 18,78–25,18° |
| R5 | 47,27–52,76° |

A legnagyobb bólintásváltozás kb. 0,202°/képkocka. A kód erős fékezésnél
hátradőlést is számol; ezekben a jelenetekben a drónok végig előredőlnek.
A repülő és a kameramozgás forrása változatlan. A hosszú változat közvetlen
PNG → BT.709, CRF 17 kódolást kapott a korábbi kétlépcsős kódolás helyett.
A két változat eredeti AAC hangja streamszinten azonos az előző kiadásokéval.
A hosszú trailer záróképének mind a 240 dekódolt képkockája azonos a V2-vel;
a Shorts záróklipje bájtra azonos. A propellerelmosás korábbi javítása megmaradt.

## Ellenőrzés és lenyomatok

- Teljes, hibát megállító dekódolás: 2940 + 1680 képkocka, 60 fps,
  megfelelő képméret, 48 kHz stereo hang és pontos 49/28 s időtartam.
- Az új dőlés és a sebesség/gyorsulás mintavételezése és a 65-ös rásegítése: 4 teszt.
- Meglévő propellerellenőrzések: 10 teszt; Shorts vágási időzítése: 2 teszt.
- Előnézeti képellenőrzés és a kész MP4-ek mintaképei: a ZIP-ben.
- ZIP CRC és minden megőrzött fájl SHA-256 ellenőrizve.
- A kibontott archívumokból a kész videók bájtpontos visszaállítása és
  teljes dekódolása is ellenőrizve.

Trailer ZIP: **76 267 997 bájt**. SHA-256:
`a75501949355944de80db59f44b99bff45f1ef91a1c2b65569a24c72ec0b702c`.

Shorts ZIP: **35 914 542 bájt**. SHA-256:
`d3f73c78c52bf087f39194e131e20973baf51e3a0aa2c53d726338f8cdc7b9b3`.

A korábbi [V2 trailer és OG-borító](trailer-archive.md), valamint az
[első Shorts](shorts-trailer.md) archívuma történeti változatként megmaradt.
