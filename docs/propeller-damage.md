# Propellersérülés

Drónoknál a sérülés külön-külön érinti a négy rotort és azok három lapátját. Nincs közös
életerő vagy sérülési százalék. A lapát állapota ép, hajlott, csorbult vagy letört;
három letört lapáttal a propeller tönkrement, és nem termel tolóerőt.

A Rapier érintkezési pontja, impulzusa és az ütközés előtti relatív sebesség
választja ki az érintett rotort. A kontaktus helye és a rotor forgásfázisa adja az
érintett lapátot. A forgó lapát oldalirányú akadályérintése is számít; a CCD által
lefogott gyors ütközés bejövő sebességét a következő fizikai lépés megőrzi.
Azonos kontaktus nem okoz 240 sérülést másodpercenként. Nagy erejű találat a
rotor minden lapátját eltörheti. Álló motorral is törhet a lapát erős ütésnél.

A hajlott lapát kevesebb tolóerőt termel, a csorbult még kevesebbet, a hiányzó
semmit. A lapátok közötti eltérés kiegyensúlyozatlanságot és rezgési nyomatékot
ad. A vezérlő a megmaradt motorokkal próbál korrigálni; egy teljesen elvesztett
rotor után a semleges botállás nem tartja a drónt egyenes lebegésben.

A 65 és C3 védőgyűrűit üreges, konvex ívekből álló fizikai keret képviseli.
Oldalról a keret felfogja a koccanást; a gyűrű belsejébe jutó keskeny akadály
eléri a propellert. A keret rugalmasságának, repedésének és motortengely-sérülésnek
még nincs külön modellje. A törési küszöbök és hatásfokok becsült játékfizikai
értékek, fizikai anyagvizsgálattal nem kalibráltak.

A GLB lapátok külön kezelhetők. A hajlás és a csorbulás megváltoztatja a
geometriát, a letört lapát eltűnik; a kerékagy és tengelyrögzítés megmarad.
A teljesen tönkrement rotor nagy ütközési tárcsája kerékagyméretre csökken.
Csak a sérült példány kap új geometriát: a menü és más játékos ép drónja megmarad.

A HUD felülnézeti elrendezésben négy háromlapátos ikont mutat, saját állapottal.
Nem százalékot ír ki. A multiplayer ugyanazt a kapcsolót használja a szoba
tulajdonosától; a lapátállapotok ellenőrzött 4×3 tömbként jutnak a többi klienshez.
Ez látvány- és állapotszinkron, nem szerveroldali törésfizika vagy csalásvédelem.
Reset és új futam ép propellereket ad. Az újracsatlakozás jelenlegi rajthelyre
visszaállítása szintén új propellereket ad, miközben a futam előrehaladása megmarad.

A drón JSON `simulation.propeller` részében a hajlás, csorbulás és törés
sebességküszöbei, a forgó lapát becsült csúcssebessége és a védőgyűrű méretei
állíthatók. A sérülés bevezetésekor a három eredeti drón konfigurációja 6-os
verziót kapott. Ez történeti verziószám, nem közös flottaverzió; a jelenlegi
értékeket a gépenkénti `data/drones/*.json` fájlok tartalmazzák.

Ellenőrzések: négy rotor függetlensége; gyenge ütközés és álló, ép drón;
valódi, egyetlen rotort érő akadály; védőgyűrű és nyitott belső tér; teljes
rotorvesztés miatti tényleges forgás; sérülés utáni ütközési méret; reset;
multiplayer továbbítás és hibás állapot elutasítása; a három tényleges GLB
lapátjainak alakváltozása és az ép modellgyorsítótár megőrzése.

Az érintkezési API: [Rapier ContactManifold](https://rapier.rs/javascript3d/classes/TempContactManifold.html).

## Repülők — 2026-10-19

Mindhárom Aero ugyanazt a külön bekapcsolható propellersérülés kapcsolót használja.
A saját, kétlapátos állapot nem a drón 4×3 tömbjét másolja. Az orron lévő, illetve
a hátsó tolólégcsavar helyén vékony, forgástengelyre merőleges ütközési tárcsa van;
kikapcsolva ez nem vesz részt az ütközésekben. A valódi kontaktus, bejövő sebesség
és forgásfázis választ lapátot. A küszöbök ugyanúgy becsült játékfizikai értékek.

A hajlás/csorbulás/letörés csökkenti a tolóerőt, az eltérő lapátok rezgést okoznak.
Mindkét lapát elvesztésével a motor nem ad hajtóerőt, de a gép tovább siklik.
A sérült geometria és a forgási elmosás is követi az állapotot; hiányzó lapátból
nem lesz újra ép forgó tárcsa. A hang érdesebb, a HUD egy kétlapátos ikont mutat.
Az erős becsapódás miatti crash és motorleállítás megmarad.

A szerver ellenőrzött `animation.propeller: [0..3, 0..3]` állapotot továbbít,
csak bekapcsolt szobaszabály mellett. A leálló/kilépő játékos sérülése látható marad;
a reset, új futam és a rajthelyre visszaállító újracsatlakozás ép légcsavart ad.
A távoli ütközési tárcsa mérete is követi a sérülést. Ez továbbra is kliensoldali
fizika és állapotszinkron. Bekapcsolt sérüléssel az eredmények a kapcsoló szokásos
szimulációs kategóriájába kerülnek; az alapbeállítás kikapcsolva marad.

A célzott tesztek mindhárom gép tényleges propellerkontaktusát, kikapcsolt állapotát,
tolóerővesztését, siklását, resetjét, lapátgeometriáját, elmosását, távoli ütközési
méretét, valamint a nyolcklienses továbbítást és hibás adatok elutasítását ellenőrzik.
