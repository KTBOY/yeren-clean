# Caveman vs Wild: Feature Ideas

These ideas fit the approved scope: an offline, single-player game with no taming, capture or companions. I checked each one against the current code, and none of them exists yet. Effort is a rough estimate for this codebase: **S** is under a day, **M** is 1–3 days, **L** is more than 3 days.

## Recommended next five

| # | Feature | Why it's fun | Effort |
|---|---|---|---|
| 1 | **Hearth cooking and meals** | Before a hunt, cook carved meat and plants at the camp hearth. Each meal gives a buff for the whole hunt, such as +25 max stamina, heat resistance, or faster tool swings. It turns spare creature parts into planning decisions, and the hearth already exists. | M |
| 2 | **Crafted traps and throwables** | A vine snare (holds a beast for 4 s), a pitfall (topples it) and a glowcap flash pod (stuns fliers and cancels a roar). They give you tactical choices beyond "dodge and hit", and they reward reading the telegraphs because a trap timed into a charge lands a free punish. | M |
| 3 | **Weapon classes with distinct movesets** | Club (fast three-hit combo), stone maul (charged overhead), bone spear (long reach, counter-thrust on a well-timed dodge) and sling (ranged, uses stone as ammo). Crafting becomes "which weapon suits this beast", not just "the next tier". | L |
| 4 | **Tracking and ecology** | Beasts leave footprints, scratch marks and dung that you inspect; each clue raises a tracking meter until the map pins the beast. Herbivores flee predators, and a Dunestalker may ambush a Tuskhog. The island feels alive and the hunt has a build-up. | M |
| 5 | **Hunter's journal (bestiary)** | Each species gets a page that fills in as you hunt it: weak spots, breakable parts, which attacks it telegraphs and how, drop rates, and your best hunt time. Hunting a species several times rewards you with its knowledge. It reuses the existing species data. | S |

## Combat depth

- **Mount-and-stab finisher:** leap off a ledge onto a staggered beast, climb on and stab its weak spot while it thrashes, then topple it for a big punish window. This is climbing onto a beast, not taming it. (L)
- **Weak-point wounds:** repeated hits on one part open a glowing wound that takes bonus damage and can be popped for a stagger. Breaking the Ruinhorn's crest removes its charge attack. (M)
- **Exhaustion and sleep:** beasts that fight too long start drooling and slowing down, then limp back to a nest to sleep. Sneaking up for a sleeping heavy hit does triple damage. (M)
- **Apex variants (new game plus):** after victory, tougher versions of every species appear with one new attack each, a darker palette, and rare parts for a fifth gear tier. (M)
- **Perfect-dodge counter:** a dodge timed into the last 0.12 s of a windup triggers a short slow-motion and a free counter-strike. The game already detects perfect dodges and plays a sound for them, so this builds on existing timing. (S)

## World and exploration

- **Day/night cycle:** night-only creatures, fireflies and glowcaps, torches in camp, and a "rest until dawn" option at the hearth. The warm/cool lighting shift would make the scenery much richer. (M)
- **Weather events:** tropical downpours make the ground muddy and dodges slower, and ash storms in the caldera cut visibility but make embers glow. (M)
- **Vines and a leaf glider:** climbable vine walls and a crafted leaf glider, so cliffs become shortcuts. (L)
- **Lava-tube cave:** a small hidden cave with a mini-boss and obsidian veins you can only mine with the flint pick. (M)
- **Signal-cairn fast travel:** light stone cairns you find to unlock fast travel between regions. (S)
- **Fishing at the coast:** a timing mini-game that gives fish for meals and rare pearls for trinkets. (M)

## Camp and progression

- **Trophy wall:** the first time you hunt a species, a skull or horn trophy appears in camp. It's a visible record of progress that fits the three camp stages. (S)
- **Hunt board:** optional offline bounties, such as "Hunt 2 Mudsnappers without taking damage" or "Topple the Ruinhorn with a snare", with material rewards. (S)
- **Trinkets:** rare parts craft into one passive trinket slot, for example +10% part-break damage, or regaining stamina on perfect dodges. (M)
- **Multiple save slots and a run timer:** three expedition slots in local storage, plus a speed-run timer on the victory screen. (S)

## Feel and accessibility

- **Photo mode:** free camera, hidden HUD, and a few filters. It shows off the scenery, which is the game's first priority. (S)
- **Difficulty options:** Explorer (bigger dodge window, slower telegraphs), Hunter (default) and Apex. (S)
- **Accessibility:** colour-blind telegraph palettes, toggle-or-hold sprint, key rebinding, and subtitles for audio cues. (M)
- **Touch controls:** a virtual stick, attack and dodge buttons, and camera swipe for tablets. (M)
- **Dev FPS overlay (F3):** FPS, draw calls, triangles and the current quality tier, backed by the new `Scenery.debug` render groups. It lets you check performance on real hardware. (S)

## Suggested order

1. **Hunter's journal**, **trophy wall** and **dev FPS overlay**: quick wins that build on existing data.
2. **Hearth cooking**, then **traps and throwables**: they deepen the core hunt loop.
3. **Day/night cycle**: the biggest improvement to the scenery.
4. **Weapon classes**, **tracking and ecology**, **mount-and-stab**: the large features that change how the game plays.
