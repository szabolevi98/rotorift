# Gymnasium

Added 2026-10-23. An original indoor micro-drone map, inspired by the feel of
flying a whoop around a school gym rather than a copy of another game's layout.

The enclosed hall measures **24 × 40 m**, with a **9 m ceiling**. The catalogue
ID is `gym`, kind `gym`, presentation key `map.gymnasium` (Hungarian: Tornaterem).
Its square 40 m catalogue boundary encloses the rectangular hall; physical walls
keep flight inside the actual room. The launch bay is at the near end of the
court and clears all eight multiplayer drone launch slots.

Equipment includes wall bars, stacked landing mats, a sectional vault and
springboard, parallel bars, oversized suspended training hoops, a foam arch,
benches, a balance beam, slalom cones, foam steps, bleachers, basketball baskets,
handball goals and a ball trolley. Bars, arches, hoops, goal frames and the roof
trusses have actual openings and contact geometry. Fixed-wing solo selection is
excluded, following the existing Playground policy; 65/75 whoops are recommended.

Two quadrotor routes are included:

| Route | Gates | Difficulty | Line |
| --- | --- | --- | --- |
| Warm-up Circuit | 9 | Easy | Roomy court loop with 2 × 1.6 m gates |
| Apparatus Run | 16 | Medium | Foam arch, vault, parallel bars and a training hoop |

The smallest race gate is 0.6 × 0.6 m inside the training hoop. Both whoops are
checked physically through the hoop and the parallel bars with prop damage on.
Every saved guide completes an ordered lap, clears the apparatus with a 0.18 m
radius envelope and clears the physical gate rails with a 0.12 m radius envelope.
Free flight removes all race gates and guide lines, preserving the equipment.

`shared/world/gym-layout.js` holds reference dimensions and equipment anchors;
`web/game/gym.js` builds the shared visual/collision source. Most repeated parts
are instanced. Parquet grain and court paint share one procedural texture to
avoid overlapping paint surfaces. Lighting uses diffuse indoor illumination,
four fixed fill lamps and one bounded overhead shadow map instead of outdoor
sun cascades. No distant landscape is generated behind the closed hall.

Prepared collision geometry is baked through the normal collision pipeline and
used by both browser and authoritative server physics. Rebuild after equipment
changes with `npm run collisions:build`. Run `node scripts/author-gym-races.mjs`
to reauthor the two bundled routes after intentional layout edits; their frames
and saved guides are checked before writing. Increment route versions when
changing an already-published route. Rebuild the standalone showcase while
preserving unrelated local edits to generated study pages.

Validation: `node --test tests/gym.test.js` checks the source and prepared shell,
real openings, launch positions, race frames/lines, lap completion, resource
cleanup and the two whoop fly-throughs.
