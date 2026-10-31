# Kit Adventures — Build Plan for Claude Code

Oct 31, 2026 · @Jon

## Overview

Kit Adventures is a blocky, Minecraft-style 3D platformer that runs in a web browser. The player's cat parkours through 3 levels (House, Backyard, City) and reaches a rainbow portal at the end of each one. Gideon (age 9) designed it, so it should be fun, forgiving and easy to read on screen.

**How to use this plan:** make a new empty folder, open Claude Code in it, and paste the kickoff prompt from the last section. Claude Code builds one phase at a time and stops after each so Gideon can playtest. Save this doc as `PLAN.md` in the folder so Claude Code can come back to it.

**Design rules for every phase:**

- Forgiving over hard: generous jump timing, checkpoints placed often, no game over.
- Kid-readable: big text, simple words, bright colors, clear icons.
- No internet needed to play, no accounts, no ads, no outside links.
- Everything Gideon chose here is a requirement. Anything this plan leaves open is Claude Code's call, as long as it keeps the game simple.

## Tech stack and project structure

The game is built with TypeScript, Three.js and Vite. Run it with `npm run dev`, and `npm run build` makes a folder that can be opened or hosted anywhere.

| Piece | Choice | Why |
| --- | --- | --- |
| 3D rendering | Three.js | Standard, well documented, handles blocky worlds easily |
| Build tool | Vite + TypeScript | Instant reload while Gideon watches changes |
| Physics | Custom box (AABB) collision against the block grid | Tight parkour feel; wall runs and ledge grabs are easier to tune than with a physics engine |
| World format | JSON level files: a block grid plus a list of objects | The same format powers the level editor |
| Saving | Browser localStorage | No accounts or server |
| Sound | Web Audio API; sound effects generated in code, music made in code or CC0 tracks | No licensing problems |
| Models | Cat, enemies and props built from boxes in code | Matches the blocky style, no model files to manage |

**Folder layout:**

- `src/main.ts`: starts the game and switches screens
- `src/engine/`: renderer, input, camera, game loop (fixed 60 Hz physics step)
- `src/world/`: block types, chunk meshing, level loader
- `src/player/`: cat model, movement state machine, parkour moves
- `src/entities/`: yarn balls, checkpoints, portal, moving platforms, enemies, hazards
- `src/ui/`: start screen, HUD, skins shop, pause menu, level select
- `src/editor/`: level editor
- `src/audio/`: sound effects and music
- `src/save.ts`: save and load progress
- `public/levels/`: `house.json`, `backyard.json`, `city.json`
- `tests/`: unit tests (Vitest) for movement math, collision and save data

World unit: 1 block = 1 meter. The cat is about 0.6 blocks wide and 0.8 tall, so it fits through 1-block gaps the way a cat should.

## Controls, camera and parkour moves

The camera follows behind the cat, the mouse turns it, and WASD moves the cat relative to where the camera faces.

| Action | Key |
| --- | --- |
| Move | W A S D (arrow keys also work) |
| Look / turn camera | Mouse (click the game to lock the pointer; Esc to free it) |
| Jump / double jump | Space |
| Dash / pounce | Shift |
| Pause | Esc or P |
| Zoom camera | Mouse wheel |

**Camera:** third-person, about 5 blocks behind and 2 above the cat. It pulls in closer when a wall blocks the view, so the cat is never hidden. Limit the up/down tilt so the camera never flips.

**Parkour moves** (the cat's movement is a state machine: ground, air, wall-run, ledge-hang, dash):

1. **Run and jump:** quick acceleration, a little air control. Coyote time of 0.12 s (jump just after leaving a ledge) and a jump buffer of 0.12 s (press jump just before landing) so it feels fair.
2. **Double jump:** one extra jump in the air with a small sparkle puff. Resets on landing, wall contact or ledge grab.
3. **Wall run:** jump at a wall while holding forward at an angle, and the cat runs along it for up to about 1 second, slowly dropping. Paw-print particles on the wall.
4. **Wall jump:** press Space during a wall run or while touching a wall in the air. The cat kicks off away from the wall. Chains between two facing walls are allowed.
5. **Ledge grab and climb:** if the cat's paws reach a ledge edge while falling, it grabs and hangs. Space or W climbs up; S drops down. Climbing walls of 1 block happens automatically while running.
6. **Dash / pounce:** a fast burst forward in the direction the cat faces, once per jump in the air (unlimited on the ground with a 0.5 s cooldown). Dashing into an enemy from above bonks it.

Put all movement numbers (speeds, gravity, timings) in one `tuning.ts` file so they are easy to tweak while Gideon playtests.

## Touch controls (iPad and phone)

When the game opens on a touch screen, on-screen controls appear automatically and every move works without a keyboard. Detect touch with the first `touchstart` or `pointerType === "touch"` event, not screen size. If a keyboard or mouse is used later, hide the touch controls again.

| Action | Touch control |
| --- | --- |
| Move | Virtual joystick on the left: it appears wherever the left thumb lands in the left half of the screen |
| Look / turn camera | Drag anywhere on the right half of the screen |
| Jump / double jump | Big round Jump button, bottom right (tap again in the air to double jump) |
| Wall run / wall jump | Same as keyboard: hold the joystick toward the wall while jumping, then tap Jump to kick off |
| Ledge climb / drop | Tap Jump to climb; pull the joystick down to drop |
| Dash / pounce | Smaller Dash button just above and left of Jump |
| Pause | Pause icon, top right |
| Zoom camera | Two-finger pinch on the right half |

**Layout and feel:**

- Buttons at least 72 px across (Jump about 96 px), semi-transparent, and placed within easy thumb reach.
- Multi-touch: moving, looking and pressing buttons all work at the same time.
- Touch camera turns a bit slower than the mouse and auto-follows behind the cat when the player isn't dragging, so younger players don't have to steer the camera all the time.
- Slightly more forgiving timings on touch: coyote time and jump buffer go up to 0.18 s, and wall runs grab from a wider angle.
- Settings adds: touch control size (small, medium, large), left-handed mode (swap sides), and camera drag speed.

**Phones and tablets:**

- Landscape only; in portrait, show a friendly "Turn your device sideways" screen with a rotating-phone picture.
- Use the full screen, respect the notch and home-bar safe areas, and turn off pinch-zoom, double-tap zoom, text selection and pull-to-refresh on the page.
- Add a web app manifest so the game can be added to the iPad home screen and opened full screen like an app.
- Sound starts after the first tap, because iPads and phones block audio until the player touches the screen.
- Performance: on phones and tablets, lower the render resolution (pixel ratio capped at 1.5), shorten the view distance, and simplify particles to keep 60 fps (at least 30 fps on older devices).

**Menus and the level editor on touch:**

- All menus, the cat maker and the skins shop are tap-friendly with big buttons; the name box opens the on-screen keyboard.
- Editor: left joystick flies, right-side drag looks, Up and Down buttons change height, tap places the selected block, a Place / Remove toggle switches what a tap does, and a tap on the hotbar picks a block. Undo and Redo buttons are on screen.

## Levels, portals, checkpoints and dangers

There are 3 levels that get harder in order. The player unlocks each one by going through the rainbow portal at the end of the one before. Each level should take a 9-year-old about 3 to 6 minutes.

| Level | Setting (cat-sized world) | Moves it teaches | Dangers | Yarn balls |
| --- | --- | --- | --- | --- |
| 1. House | Giant furniture: couch cushions, bookshelves, kitchen counters, a ceiling fan | Run, jump, double jump, ledge grab | Water in a sink and bathtub, a spinning ceiling fan platform, a slow robot vacuum | 20 |
| 2. Backyard | Fences, a tree, a shed roof, a swing set, flower beds | Wall run, wall jump, dash | Pond water, swinging and sliding platforms, a patrolling dog | 25 |
| 3. City | Rooftops, chimneys, fire escapes, AC units, billboards | All moves chained together | Lava-orange hot roofs and vents, moving window-washer platforms, dogs and security robots | 30 |

**Rainbow portal:** a tall swirling ring that cycles through rainbow colors (animated shader or color-shifting blocks) with sparkle particles. Walking into it plays a whoosh, shows "Level complete!" with yarn collected and time, then loads the next level. After the City level, the portal shows a "You beat Kit Adventures!" screen.

**Checkpoints:** flags placed about every 30 to 60 seconds of play, and always before a hard part. Touching one waves the flag and plays a chime. Falling off the world, touching water or lava, or getting caught by an enemy sends the cat back to the last flag with a quick fade, no penalty. Collected yarn stays collected.

**Moving platforms:** they slide, spin, or tip and fall (respawning after 3 seconds). The cat rides along with a platform it is standing on.

**Enemies:** they never kill the cat; they just send it back to the checkpoint.

- Dog: patrols a path, runs at the cat when it is within 6 blocks, gives up after 4 seconds. A bark warns the player first.
- Robot vacuum (House) and security robot (City): follow a fixed route with a visible warning light.
- Pouncing or dashing onto an enemy from above stuns it for 5 seconds (it shows stars) and gives the cat a bounce.

## Start screen, yarn balls, skins and saving

The player names the cat and picks its colors at the start, then spends yarn balls on new looks.

**Start screen:** the Kit Adventures title in big blocky letters with the cat spinning beside it. Buttons: Play, Level Select, Skins, Level Editor, Settings.

**Make your cat** (shown the first time, and available later from Skins):

- Name box: up to 12 letters, used on the HUD ("Go, Whiskers!") and the win screen. If it's left blank, the default is "Kit".
- Fur color: 8 swatches (orange, black, white, gray, brown, cream, blue, pink).
- Pattern: plain, stripes, spots or socks (white paws), plus a second color for the pattern.
- Eye color: 4 choices.

**Yarn balls:** small spinning yarn balls that bob up and down and play a pop when collected. Some are hidden on harder routes as a reward for good parkour. The HUD shows the count. Each level remembers the most yarn ever collected there, so replaying a level can't farm yarn forever. Only new yarn balls count toward spending.

| Unlock | Cost (yarn) |
| --- | --- |
| Hats: party hat, crown, pirate hat, wizard hat | 10 each |
| Rainbow collar or cape | 15 each |
| Rainbow-trail effect when dashing | 25 |
| Special skins: robot cat, zombie cat, galaxy cat | 30 each |

The 3 levels hold 75 yarn in total and everything together costs 185, so a first playthrough buys a few favorites. Levels made in the editor (up to 10 yarn balls each) earn the rest.

**Saving:** saved automatically to localStorage after each checkpoint, purchase and level complete. It stores the cat's name and looks, unlocked levels, yarn per level, yarn to spend, owned items, best times and editor levels. Settings has a "Start over" button that asks for confirmation before erasing the save.

## Level editor

Gideon builds his own levels by placing blocks and objects, then presses Play to test them right away. The editor uses the same JSON format as the built-in levels.

**How it works:**

- A free-fly camera: WASD to move, mouse to look, Space and Shift to go up and down.
- A hotbar at the bottom, like Minecraft, with keys 1 to 9 and mouse-wheel scrolling: blocks (grass, dirt, wood, stone, brick, glass, carpet, roof tile), water, lava, and objects (start point, checkpoint flag, yarn ball, rainbow portal, moving platform, dog, robot).
- Left click places, right click removes, and a ghost preview shows where the block will go. Ctrl+Z undoes and Ctrl+Y redoes.
- Moving platforms and enemies: after placing one, click a second spot to set where it travels or patrols.
- Theme picker: House, Backyard or City sky and lighting.
- Build area limit: 64 × 32 × 64 blocks, so levels stay fast.

**Buttons:** Play test (starts at the start point; Esc returns to the editor exactly where you were), Save, My Levels, New, and Export / Import (downloads or loads a `.json` file so levels can be shared with a sibling or friend).

**Rules before a level can be saved as finished:** it needs exactly one start point and at least one portal. The editor shows a friendly message if either is missing. Editor levels show up under Level Select → My Levels.

**Bonus:** open the 3 built-in levels in the editor as copies, so Gideon can remix them without breaking the originals.

## Sound, music and screens

Every action gets a short, cheerful sound, and each level has its own looping tune. Settings has separate volume sliders for music and sound effects.

**Sound effects:** jump (boing), double jump (higher boing), dash (whoosh), wall run (soft paw taps), ledge grab (scrabble), land (thump), yarn pop, checkpoint chime, portal whoosh, splash and sizzle when respawning, dog bark, robot beep, enemy bonk, button clicks, and a meow when the cat is idle or when the player presses M.

**Music:** a calm, bouncy tune for the House, a sunny upbeat one for the Backyard, and a faster, funky one for the City. Generate them in code (simple chiptune loops) or use CC0-licensed tracks with the license noted in `CREDITS.md`.

**HUD (on screen while playing):** yarn count with icon (top left), level name and the cat's name (top center), small reminders of the controls for the first 30 seconds of level 1, and a pause button.

**Pause menu:** Resume, Restart from checkpoint, Restart level, Settings, Quit to title.

**Settings:** music volume, sound effects volume, mouse sensitivity, invert camera up/down, and Start over.

**Kid-friendly UI:** chunky buttons with icons, fonts at least 20 px, short words, and nothing that needs reading fast.

## Build phases

Claude Code builds in 8 phases and stops after each one for a Gideon playtest. A phase is done only when its checks pass, `npm run build` succeeds, and the tests pass.

1. **Foundation:** Vite + TypeScript + Three.js project, game loop, block world loaded from JSON, a flat test level with sky and lighting.
   - Check: the browser shows a blocky test area at a steady 60 fps.
2. **The cat moves:** box-built cat with a simple run and jump animation, camera behind the cat with mouse look, WASD, jump, double jump, collision with blocks.
   - Check: the cat can't walk through walls or fall through floors; the camera never ends up inside a wall.
3. **Parkour:** wall run, wall jump, ledge grab and climb, dash/pounce, coyote time, jump buffer, all values in `tuning.ts`. Build a "parkour gym" test level with one station per move.
   - Check: Gideon can do every move on purpose. Tune until he says it feels good.
4. **Level pieces:** checkpoints and respawn, water and lava, moving platforms, yarn balls, rainbow portal, dog and robot enemies with stomp/pounce stun.
   - Check: every danger sends the cat to the last flag; the portal loads the next level.
5. **The 3 levels:** build House, Backyard and City as JSON files following the level table, with the right yarn counts, plus the level-complete and win screens.
   - Check: all 3 can be finished; each takes about 3 to 6 minutes; yarn counts are 20, 25 and 30.
6. **Start screen, cat maker, skins shop, saving, sound and music:** title screen, name and color picker, shop with prices, localStorage save, HUD, pause menu, settings, all sounds and the 3 music loops.
   - Check: reload the page and everything is still there, including the name, look, purchases and unlocked levels.
7. **Level editor:** everything in the editor section, including play test, save, export and import, and remixing built-in levels.
   - Check: Gideon builds a small level from scratch, plays it, saves it, and it appears under My Levels.

8) **Touch controls:** everything in the touch controls section: joystick, look-drag, Jump and Dash buttons, landscape lock, home-screen manifest, mobile performance settings, and touch support in menus and the editor. Run `npm run dev -- --host` to test on a real iPad or phone on the home Wi-Fi.
   - Check: Gideon finishes the House level on an iPad using only touch, and the touch controls disappear when a keyboard is used.

After phase 8: a polish pass (particles, screen fade, small bugs from Gideon's list), then update `README.md` with how to run the game and the controls.

## Kickoff prompt for Claude Code

Export this doc as Markdown, save it as `PLAN.md` in an empty folder, open Claude Code there, and paste:

```
We're building Kit Adventures, a blocky 3D cat parkour platformer that runs in the web browser on computers, iPads and phones (with touch controls), designed by Gideon, age 9. The full spec is in PLAN.md. Read it all before starting.

How to work:
- Build one phase at a time from the "Build phases" section, in order.
- At the end of each phase: run the tests and npm run build, start the dev server, tell me the URL, and list what to try. Then STOP and wait for our playtest feedback before starting the next phase.
- Keep every requirement in PLAN.md. When the plan leaves something open, choose the simplest option that is fun for a 9-year-old, and note your choice in DECISIONS.md.
- Put every movement and feel number in src/player/tuning.ts.
- Use only code you write plus npm packages; no copyrighted characters, music or art. Sounds are generated in code or CC0.
- Use git and commit at the end of every phase with a clear message.

Start with Phase 1.
```

After each phase, Gideon plays and tells Claude Code what to change in plain words, for example "the wall run is too short" or "make the dog slower". Claude Code adjusts `tuning.ts` or the level files and goes on only when he's happy.
