# Rotorift Shorts – megőrzött videó és renderforrás

[Archív ZIP](../media/rotorift-shorts-28s-2026-10-25.zip) ·
[Közvetlen GitHub-letöltés](https://github.com/szabolevi98/rotorift/raw/refs/heads/main/media/rotorift-shorts-28s-2026-10-25.zip)

Méret: **35 194 468 bájt**. SHA-256:
`0ed35f9ea06add37f7354d2c0857cb32a87eccfa36fdf4c68aa8ff12ffb99d83`.

A ZIP minden elemének CRC- és SHA-256-ellenőrzése sikeres volt. A kibontott
csomag gyors visszaállítása és az eredmény teljes, 1680 képkockás dekódolása
ellenőrizve. A hosszú V2 trailer archívuma: [trailer-archive.md](trailer-archive.md).

---

# Rotorift – 28 másodperces YouTube Shorts

Készült: 2026-10-25. Angol, álló változat az öt pályás V2 trailerből.
**28 s · 1080×1920 · 9:16 · 60 fps · 1680 képkocka.**

A ZIP a kész MP4-et, az eredeti WAV-ot, az összes filmrender-forrást és a
függőségek verzióit tartalmazza. A kész videó egy példányban szerepel az
`approved/` mappában. Képkockák, node_modules és ideiglenes videók nincsenek benne.

## Visszaállítás újrakódolás nélkül

A ZIP kibontott gyökérmappájából, Python 3.10 vagy újabb verzióval:

```powershell
python -m pip install imageio-ffmpeg==0.6.0
python finalize.py
```

Eredmény: `generated/Rotorift-Shorts-English-28s-1080x1920-60fps.mp4`.
A program bájtra másolja a megőrzött mestert, majd a teljes kép- és hangsávot
dekódolja. Ellenőrzi az 1680 képkockát, a képméretet, a képfrissítést, valamint
az MP4 és a kódolt H.264/AAC tartalom SHA-256 értékét a manifest alapján.
Ehhez játék, Chrome és adatbázis nem kell.

## Új render a játékból

Ez a változat **közvetlenül álló méretben renderelt** film, nem a fekvő MP4
közepének levágása. A valódi játékpályákat és modelleket használja, tervezett
repülési útvonallal és kamerával; nem kézzel végigjátszott fizikai repülés,
és nem generatív videó. A forrás a hosszú V2 film továbbalakítása.

A rögzített játékrepo: `https://github.com/szabolevi98/rotorift.git`.
Az ehhez a renderhez ténylegesen használt HEAD:
`6673c7d09759d574858e68377f3de02541d507b6`.
A játék geometriája tartalmazza a korlát-, daru- és látótávolság-javításokat.
A meglévő helyi `showcase/canopy-lab.html` módosítás nem része a filmnek.

Egy külön könyvtárba készítsd a rögzített játékverziót. A checkout parancsot
ne meglévő, saját módosításokat tartalmazó munkamappán futtasd.

```powershell
git clone https://github.com/szabolevi98/rotorift.git D:\rotorift-short-source
git -C D:\rotorift-short-source checkout 6673c7d09759d574858e68377f3de02541d507b6
Push-Location D:\rotorift-short-source
npm ci
Pop-Location

# Innen a kibontott Shorts-forrás mappájában dolgozz.
npm ci
python -m pip install -r requirements.txt
node --test test-timeline.mjs
$env:ROTORIFT_ROOT = 'D:\rotorift-short-source'
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node server.mjs
```

A helyi szerver maradjon futva. Második PowerShell ablakban, ugyanabban a
Shorts-forrás mappában:

```powershell
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:FILM_FFMPEG = python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"
node render.mjs --preview
node render.mjs
python finalize.py --fresh
```

A mentett `score.wav` az eredeti keverés. `python score.py` újra szintetizálja,
ha a hangot is módosítani szeretnéd; alapból nem szükséges újragenerálni.
A szerver csak localhoston, a 3199-es porton fut, a filmhez nem kell
adatbázis vagy az éles szolgáltatás. Leállítás: Ctrl+C.

A render hat külön videórészt állít elő a `media/` alatt. Áramszünet esetén
a kész részek és a PNG-k a lemezen maradnak; a `node render.mjs` az összes
részt újra előállítja. A végső összeállítás a képet újrakódolás nélkül másolja.
A friss render GPU-, driver-, Chrome- és kódolóverziótól függően eltérhet;
a bájtpontos visszaállítást az `approved/` mester és az alap finalize biztosítja.

## Pontos vágási terv

Az időket a `timeline.mjs` vezérli. Minden pálya első 1,5 másodperce külső
nézet, utána 3,5 másodperc FPV; a nézetváltás direkt vágás. A táblázat jobb
oldali idői az eredeti, pályánként kilenc másodperces film helyi idői.
Az intervallumok kezdete benne van, végük nincs benne a vágásban.

| Shorts idő | Pálya / modell | Külső forrásidő | FPV forrásidő |
| --- | --- | --- | --- |
| 0–5 s | Apex Circuit / Rift X5 | 0,65–2,15 | 4,70–8,20 |
| 5–10 s | Grove (Liget) / Rift C3 | 0,90–2,40 | 4,10–7,60 |
| 10–15 s | Skyline / Rift Aero 150, 1500 mm | 0,80–2,30 | 4,70–8,20 |
| 15–20 s | Gymnasium / Rift 65 | 0,65–2,15 | 4,70–8,20 |
| 20–25 s | Harbor / Rift R5 | 0,05–1,55 | 5,00–8,50 |
| 25–28 s | Önálló, álló zárókép | – | – |

Az Apexben a követett autó kék, az előtte levő narancsszínű. A repülő a
1500 mm-es modell, nem a 400-as. A kamera függőleges látószöge az eredeti
64–90° helyett 72–98°. A simított útvonal és a testek takaráshelyes
megjelenítése a V2 filmé maradt. A külső nézetek mintaképein a modellek
teljes befoglaló téglalapja a 1080×1920-as képen belül volt.

A kvadok elmosása a modell lapáthosszához becsült fordulatszámon, 1/120 s
expozícióval készül. A repülőlégcsavar 32 mintás, 1/2000 s expozíciójú, így
látható lapátívei maradnak; a motoragy, védők és test nem halványulnak el.
Ez filmrender-beállítás, a játék forrását ez a csomag nem írja át.

## Feliratok és hang

- CHASE THE THRILL. / FIND YOUR LINE. / TAKE TO THE SKIES.
- SMALL DRONE. BIG PLAYGROUND. / BUILT FOR SPEED.
- Zárókép: ROTORIFT. · FPV. ON THE GO. · FLY FREE.
- Play in your browser. · Desktop + mobile. · fpv.levente.net
- More drones. More maps. – az öt jelenet csak válogatás a játékból.

A feliratok saját álló elrendezést kaptak. Az alsó információs sáv a kép
1378–1550 px közötti tartományában van. A záróképet helyben rajzolja a kód,
rögzített zajjal finoman ditherelt sötét háttérrel; nincs felnagyított JPEG.

A `score.py` eredeti szintetizált zenét, motorhangokat és rövid átvezető
suhintásokat készít. 120 BPM, rögzített véletlenmag: 198. A suhintások az
5, 10, 15, 20 és 25 másodperces vágásoknál vannak, halkabb, 0,4 s-os
változatban. A hangsáv 48 kHz stereo, a végső AAC 192 kbit/s; normalizálási
cél: -16 LUFS, -1 dBTP, LRA 9. A végén 0,35 s-os hangkifutás van.

## Kódolás és környezet

- Windows, Node 24.19.0, Python 3.10.11, Chrome 156.0.8078.47, D3D11/WebGL.
- Playwright Core 1.64.1; játék: Three.js 0.169.0.
- NumPy 2.2.6, Pillow 12.3.0, imageio-ffmpeg 0.6.0 / FFmpeg 7.1.
- PNG képkockák, libx264 medium, CRF 17 a repüléseknél.
- Zárókép: CRF 12 és tune grain a sötét átmenet megőrzéséhez.
- H.264 High Level 4.2, yuv420p, BT.709, korlátozott jeltartomány,
  négyzetes pixel, 60 fps, MP4 faststart.
- A képméretek és időzítés tesztje: `node --test test-timeline.mjs`.
- A teljes videó és hang szigorú dekódolása: `finalize.py`.
- A végleges H.264-fejléc BT.709 primaries/transfer/matrix értékeit a
  `h264_metadata` bitstream-szűrő is rögzíti, képi újrakódolás nélkül.
- A kész AAC mért hangossága -16,07 LUFS, valódi csúcsa -1,40 dBTP.
- Fájlok és streamlenyomatok: `manifest.json`, kész MP4 ellenőrzése:
  `approved/*.verification.json`. Előnézeti adatok: `preview-checks.json`.

A forrás és a kész videó a repó külön Shorts ZIP-jében marad meg. A
hosszú trailer és az OG-borító korábbi archívuma változatlanul megmarad.
