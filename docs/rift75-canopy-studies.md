# Rift 75 – fotók alapján formált canopy

2026-10-13. A felhasználó frontális, felülnézeti és oldalsó Meteor75 Pro
fotói alapján készült burkolat. A korábbi három formajavaslat helyét ugyanazon
modell három nézete veszi át a `showcase/canopy-lab.html` oldalon.

A kamera körül lefelé keskenyedő, enyhén domború fehér orr van, amely eltakarja
a fekete, négyszögletes kameraházat. A lencse kör alakú nyílásban ül.
A szélesebb felső héjból oldalsó rögzítőfülek és hátsó láb futnak ki.
Valódi oldalsó ablakok, felső szellőzőrések és nagy hátsó íves kivágások
nyitják meg az elektronikát körülvevő teret. Az antenna hátrafelé áll,
a két hátsó propeller közötti szabad sávban, külön kivágott hátsó kilépőnyílással.

A kamerapozíció és a 28 fokos dőlés változatlan. A burkolatnak külső és belső
felülete, 0,75 mm-es fala és lezárt nyílásszegélyei vannak; a kamerát belső
billentési támaszok tartják. A váz továbbra is a saját narancsszínű modell.
Ez saját procedurális geometria a fotók formai referenciájával.

A három nézet közeli és teljes drónméretben is megtekinthető, illetve
külön forgatható. A lap és a showroom az `npm run showcase:build` során
ugyanabból a `showcase/whoop75.js` modellből készül. A játék GLB-je ennek
exportja; külön fizikai módosítás nem történt.

## Megtartott motorkábel-javítás

A 65-ös és a 75-ös összes motorpadja és forrasztása az AIO alsó oldalán van.
A három fázisvezeték a váz alatt fut, majd a három motor-merevítő közötti szabad
szektorban emelkedik fel a motor állórészéhez.

A `tests/drone-wiring.test.js` a valódi modellgenerátorok geometriáját ellenőrzi:
12 motorvezeték/drón, alsó bekötés, létező forrasztópont, a kábelközép és
kábelvastagság mintavétele a vázhoz és annak csavarjaihoz képest. A 75-ös
optikai tengelyén a lencse látszik, a környező kameraházat a fehér orr takarja.
Az antenna középvonala és 1,3 mm sugarú keresztmetszete is szabadon áthalad
a saját nyílásán, a héj és a rögzítőgyűrű érintése nélkül.
