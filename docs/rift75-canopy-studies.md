# Rift 75 canopy-változatok

2026-10-13. Három forgatható 3D terv ugyanazon a vázon, azonos kamerapozícióval,
motorokkal és akkumulátorral. A választásig egyik sem cseréli le a játék canopyját.

A `showcase/canopy-lab.html` önálló, hálózat nélkül is megnyitható összehasonlító
lap. A közeli nézet és a teljes drón között lehet váltani, illetve elölről,
oldalról, felülről és hátulról is meg lehet nézni mindegyik formát.
A generált lapot az `npm run showcase:build` állítja elő a sablonból és a
`showcase/canopy-studies.js` geometriáiból.

- **A — Zárt, lekerekített héj.** Kör alakú, keskeny lencsenyílás, sima
  domború test, oldalanként három szellőzőrés, hátul elkeskenyedő forma.
  Ezt javasoljuk a 75-ös saját karakterének: jobban elkülönül a 65-ös nyitott
  canopyjától, a kamera körüli korábbi szögletes keretet is elhagyja.
- **B — Nyitott bordaváz.** Vékony íves bordák, külön kameragyűrű, két felső
  keresztmerevítés; jól látható elektronika és nyitott oldalak.
- **C — Alacsony versenyburkolat.** Rövid, hátrafelé nyúló tető, kompakt
  kamerakeret, nyitott hátsó rész és kis narancsszínű díszítés.

A tervek formaválasztáshoz készültek. Kiválasztás után a burkolat csatlakozásait,
falvastagságát és a kamera körüli hézagokat külön véglegesítjük.

## Motorkábelek

A 65-ös és a 75-ös összes motorpadja és forrasztása az AIO alsó oldalára került.
A három fázisvezeték a váz alatt fut, majd a három motor-merevítő közötti szabad
szektorban emelkedik fel a motor állórészéhez. A vezetékek végpontja az alsó
forrasztással találkozik; nem a PCB-n keresztül indul.

A `tests/drone-wiring.test.js` a valódi modellgenerátorok geometriáját ellenőrzi:
12 motorvezeték/drón, alsó bekötés, létező forrasztópont, kábelközép és a
kábelvastagság hatoldali mintavétele a vázhoz és annak csavarjaihoz képest.
A javítás a két showroom- és a két játékbeli GLB-exportban is szerepel.
