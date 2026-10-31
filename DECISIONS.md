# Decisions

Choices made where PLAN.md left things open. Each one aims for the simplest option that is fun for a 9-year-old.

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
