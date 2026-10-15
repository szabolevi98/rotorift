# Map presentation and hangar pickers

Map identity and display text are separate. `shared/catalog/maps.js` maps the
existing persistent IDs to English presentation codes:

| Persistent ID | Code / translation key | Audience |
| --- | --- | --- |
| `liget` | `grove` / `map.grove` | `standard` |
| `betonudvar` | `construction-yard` / `map.construction-yard` | `standard` |
| `jatszoter` | `playground` / `map.playground` | `micro` |

The catalog sorts maps in this order and includes `code`, `nameKey` and
`audienceKey`. Each of the five dictionaries translates the name and size
recommendation. Menu, HUD, rooms, results, loading screens and records use
the same name resolver; the standalone showcase uses the English dictionary.

Do not rename existing persistent IDs or route folders just to translate a
name: saved preferences, leaderboards, routes, rooms and collision assets
reference them. A new map can use an English ID directly or supply `code` and
`droneClass` in its JSON; add its translation key to all five dictionaries.
Add its preferred position to the catalog ordering when needed.

`web/catalog-select.js` supplies the shared searchable drone/map picker.
It handles accent-insensitive search, arrows, Enter, Escape, outside clicks,
selection state, and a scrollable popup bounded to the viewport. The hangar
controls move between solo and multiplayer without duplicating picker state.
