# Rotorift – javított dróndőlés a videókban

2026-10-26. A legújabb változatok a **49 másodperces trailer V3** és a
**28 másodperces Shorts V2**, mindkettő 60 fps. A jelenetek, kameraútvonalak,
autószínek és időzítések megmaradtak. A módosítás a filmrenderben van.

## Letöltés és reprodukció

| Videó | Formátum | Archívum |
| --- | --- | --- |
| Trailer V3 | 1920×1080, 49 s, 2940 képkocka | [ZIP](../media/rotorift-trailer-v3-2026-10-26.zip) |
| Shorts V2 | 1080×1920, 28 s, 1680 képkocka | [ZIP](../media/rotorift-shorts-v2-2026-10-26.zip) |

Közvetlen GitHub-letöltés:
[Trailer V3](https://github.com/szabolevi98/rotorift/raw/refs/heads/main/media/rotorift-trailer-v3-2026-10-26.zip),
[Shorts V2](https://github.com/szabolevi98/rotorift/raw/refs/heads/main/media/rotorift-shorts-v2-2026-10-26.zip).

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

A fix 6,3°-os dőlés helyett a sebességből, gyorsulásból, tömegből és a
katalógus légellenállási adataiból becsült bólintás vezérli a drón testét.
A lágy filmes szögkorlát és a 0,25 s-os simítás megőrzi a közeli kamerák
olvashatóságát. Ez továbbra is tervezett kamerás animáció, fizikai adatokkal
indokolt közelítéssel; nem ténylegesen végigjátszott repülés.

| Drón | Mért bólintás a teljes forrásjelenetben |
| --- | --- |
| X5 | 42,25–52,06° |
| C3 | 20,79–34,07° |
| Rift 65 | 6,78–13,18° |
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
- Az új dőlés és a sebesség/gyorsulás mintavételezése: 3 teszt.
- Meglévő propellerellenőrzések: 10 teszt; Shorts vágási időzítése: 2 teszt.
- Előnézeti képellenőrzés és a kész MP4-ek mintaképei: a ZIP-ben.
- ZIP CRC és minden megőrzött fájl SHA-256 ellenőrizve.
- A kibontott archívumokból a kész videók bájtpontos visszaállítása és
  teljes dekódolása is ellenőrizve.

Trailer ZIP: **76 630 186 bájt**. SHA-256:
`7106912e22bb469ebecf72069165a6229ead97c38117381bfb4a4217ff80e21e`.

Shorts ZIP: **35 983 460 bájt**. SHA-256:
`0874a60a7233ca945802390bd206071aa9131e75af3dc103260d8261060fc572`.

A korábbi [V2 trailer és OG-borító](trailer-archive.md), valamint az
[első Shorts](shorts-trailer.md) archívuma történeti változatként megmaradt.
