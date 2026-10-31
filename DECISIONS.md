# Decisions

Choices made where PLAN.md left things open. Each one aims for the simplest option that is fun for a 9-year-old.

## Flicker fix (after Phase 3)

Feedback: "two textures on top of each other flicker" ("z-fighting": two surfaces on the exact same plane).

- **The main cause was a bug in `PathBuilder.floor()`.** Each path floor is dirt with a 0.4 m top layer (grass, wood, stone or brick). The top layer was meant to sit on the dirt, but it stretched all the way down to the ground (`Math.min` instead of `Math.max`). So every raised floor's sides had dirt and the top layer drawn on the same surface. Now they only touch.
- **Pit sides.** The ground's cut edge and the hedge lay on the same plane. Holes in the ground now reach under the hedges and are 2 cm wider than the pits, so the hedge is always in front.
- **Pit water** sits 3 cm inside the hole and above the bottom, so it never touches the walls, posts or floor exactly.
- **Sign words** float 2 cm in front of the board (it was 5 mm), and the depth test is nudged toward the camera.
- **The camera's near distance went from 0.1 m to 0.15 m** and the far distance from 1000 m to 700 m. That gives the depth test more precision far away. Both are in `tuning.ts`.
- **Rule for future levels and the editor:** two *different* surfaces must never lie on the same plane facing the same way. `src/world/overlaps.ts` finds any that do, and a test runs it on every level. Faces pressed flat against another solid, and the same surface overlapping itself (which looks identical), don't count.

## Phase 2 playtest and Phase 3: parkour

Feedback: "make the cat more cute; make levels longer with triple the obstacles; they can curve and turn; add the rest of the moves like wall jump."

**Cuter cat**
- Big-head proportions: the head is now as wide as the body. There are big sparkly eyes set low and wide (a dark pupil with a colored rim and two shines), pink blush, a little "w" mouth, a pale chest, short chubby legs, bigger pink ears and a fluffy ball on the tail tip.
- New idle touches: ear twitches and a slow, curious head tilt.

**Parkour moves** (all numbers in `src/player/tuning.ts`)
- **Wall run.** Jump at a wall while holding toward it at an angle. It starts near the top of the jump, so the run happens high on the wall. It runs at 9 m/s (faster than running, which feels like a boost) for up to 1.2 s, slowly dropping, and leaves paw prints on the wall.
- **Wall jump.** Press Space during a wall run, while sliding down a wall, or when touching a wall from the side. The cat kicks away and up with a twirl. Steering is weaker for 0.2 s afterwards so the kick isn't cancelled. Chimneys can be climbed by wall-jumping back and forth.
- **Head-on rule.** If you're pushing *straight into* a wall and still have your double jump, Space double jumps instead of kicking off. Without this, double-jumping at a cliff threw kids backwards off it. Tests caught it.
- **Double jump refills** on landing, a wall run, a wall jump or a ledge grab, but not just from touching a wall. Otherwise the cat could climb any wall by double-jumping forever.
- **Wall slide.** Holding toward a wall while falling slows the fall to 3 m/s, which makes wall jumps easier to time. The plan doesn't ask for this; I added it to be forgiving.
- **Ledge grab.** Grabs automatically when falling with paws near a ledge edge (up to 0.4 m above the head), as long as there's room to climb up. Space or holding toward the wall climbs; pulling away drops.
- **Auto-climb.** Walls up to 1.05 m are climbed automatically when running into them.
- **Dash / pounce.** Shift: a quick 15 m/s burst for 0.16 s with a rainbow streak. It works once per jump in the air (refilled like the double jump) and has a 0.5 s cooldown on the ground. Pressing jump during a ground dash jumps as soon as it ends.
- **Grip.** Only brick, stone, wood and other hard surfaces can be wall-run, wall-jumped or grabbed. Bushy hedges, bushes and invisible barriers can't. This keeps levels un-skippable: you can't wall-run past a gap along the hedge. The wall-jump chimney's back is a hedge plug, so holding forward in the slot can't kick you out.

**Levels**
- **Built by a path builder** (`scripts/pathBuilder.ts`). It lays straight segments and 90° left/right corners. Big round hedge pillars soften each corner so it reads as a curve. It stops with an error if the path would run into itself.
- **Garden Path** (replaces Test Path): 18 obstacles (three times as many as before) and five turns. It uses every move: hurdles, step up, gap, stumps, double-jump ledge, plank bridge, double-jump gap, wall-run pit, ledge-grab cliff, rising zig-zag platforms, dash gap, wall-jump chimney, stepping stones down, the double wall run (run, wall-jump across, run), a ledge-grab tower, big-gap stumps, an island hop and a crate staircase to the golden pad.
- **Parkour Gym**: one station per move, each with a sign explaining it and a checkpoint in front of it.
- **Level picker.** The "Click to play" panel has a big button for each level. Level Select comes properly in Phase 6.
- **Pits** are holes down to water 10 m below. Falling sends you back to the last checkpoint.
- **Obstacle sizes live in `scripts/obstacles.ts`.** Tests check that each size *needs* its move and that the move is *enough*. For example, the 12 m wall-run pit is beyond the longest possible jump (9.75 m with double jump and dash) but within a wall run (14.25 m). If a tuning change breaks an obstacle, a test says which one.
- **The no-skipping test** flood-fills each level from the start and fails if any scenery outside the hedges is reachable. Another test confirms the check really does find leaks when the barriers are removed.

**Pulled forward from Phase 4**
- **Checkpoint flags.** With 18 obstacles, falling back to the very start would be miserable, so basic flags are in now. Touching one waves it in rainbow colors and makes it the respawn point. Phase 4 adds the chime and fade.

## Phase 1 playtest: new look and forced paths

Feedback: "too on-the-nose Minecraft; more realistic, less blocky, rounded, N64 style; maps must force one path." PLAN.md now has a section recording this.

- **Pieces instead of a block grid.** Levels are lists of rounded boxes, cylinders, props, pools and barriers (`src/world/levelFormat.ts`, version 2). A grid always looks blocky, while pieces can be any size (couch cushions, fences, stumps).
- **Collision is still simple boxes.** Each piece makes one axis-aligned box (`src/world/colliders.ts`). The rounding is only visual and small, so it never feels unfair. Cylinders collide as a square a little smaller than the circle. Props only turn in 90° steps so their boxes stay lined up.
- **N64 look.** The textures are 64×64 pixels, painted in code and blurred by smooth filtering. They're tiled by world position, so every surface has the same texture size. Shading is smooth, bushes and treetops are low-poly blobs, and clouds are puffy blobs. Real sun shadows stay on the scenery because they help judge depth.
- **Round "blob" shadow under the cat**, straight down, like classic N64 games. It's the easiest way for a kid to see where a jump will land. The cat doesn't cast a sun shadow, so it never has two shadows.
- **Forcing the path.** `LevelBuilder.wall()` builds a visible wall plus an invisible barrier on top of it up to 60 m. Without that, wall-jumping between two facing walls (Phase 3) could climb out. Invisible barriers don't push the camera, so the view stays steady. The edges of every level also get invisible walls. A test checks the Test Path walls for gaps at every height.
- **"Can it be finished?" test.** A scripted bot plays the Test Path using only run, jump and double jump. If a level change makes the course impossible, the test fails.
- **Falling out of the level** (below −10 m) sends the cat back to the start. Phase 4 changes this to the last checkpoint.

## Phase 2: the cat moves

- **Cat model.** Built in code from rounded shapes: rounded-box body, round head, cone ears, big eyes with pupils and a shine, muzzle, nose, whiskers, capsule legs and a 6-piece tail. It supports all the cat-maker options already (fur color, plain/stripes/spots/socks, pattern color, eye color). For now it uses the default look: an orange tabby with green eyes.
- **Animations** are made in code: breathing, blinking, looking around, a gallop that speeds up with running speed, a tail that sways when idle and streams back when running, and stretched-out and tucked jump poses. The double jump does a **front flip** with a sparkle puff, and landing squashes the cat, with a dust puff after big falls.
- **Jump feel.** A full jump is 1.7 m and the double jump adds 1.3 m. Letting go of Space early makes a smaller hop. Falling is a bit faster than rising, so jumps feel snappy. All of these numbers are in `src/player/tuning.ts`.
- **Coyote time and jump buffer (0.12 s) are in already**, though the plan lists them in Phase 3. They're part of a fair jump, and the plan's first rule is "forgiving over hard".
- **Small steps (up to 0.3 m) are walked up automatically.** Taller ones need a jump. Auto-climbing 1 m walls comes with ledge grabs in Phase 3.
- **Camera.** 5.4 m away, angled 22° down (about 5 back and 2 up), with tilt limited between −15° and 65°. The wheel zooms from 2.5 to 9 m. It snaps in closer when a wall is in the way and eases back out. It smooths the cat's up-and-down movement so jumps don't shake the view.
- **Controls reminder** shows at the bottom for the first 30 seconds of play, then fades.
- **Dev helper.** In `npm run dev` only, `window.kit` gives the browser console the play scene and camera, for testing.

## Phase 1: Foundation (still true)

- **Levels are built in code** by `scripts/build-levels.ts` (`npm run levels`), which writes `public/levels/*.json`. The editor will save the same format.
- **Themes.** House is warm indoor light with no clouds, Backyard is a sunny blue sky with clouds, and City is a purple-orange sunset with clouds (`src/world/themes.ts`).
- **FPS counter** in the bottom-left; F3 hides it.
- **Physics runs at a fixed 60 steps per second**, and drawing smooths between steps, so 120 Hz screens look smooth too.
- **The built game must be served, not double-clicked.** `npm run build` makes `dist/` with relative paths for any static host (or `npm run preview`).
- **Node.js 26 LTS** was installed with winget, because the computer didn't have Node.
