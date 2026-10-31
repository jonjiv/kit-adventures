# Decisions

Choices made where PLAN.md left things open. Each one aims for the simplest option that is fun for a 9-year-old.

## Phase 1: Foundation

- **Level JSON format.** `size` [x, y, z], a `palette` of block names (`palette[0]` is always `"air"`), `blocks` as run-length pairs `[paletteIndex, count, ...]` over cells in x, then z, then y order, and an `objects` list (`type`, `pos`, optional `to` and `yaw`). Blocks are stored by name, so adding new block types later never breaks old levels. Run-length encoding keeps files small: the test level is 3 KB.
- **Levels are built in code.** `scripts/build-levels.ts` builds the JSON files with `fill`/`set` helpers (`npm run levels`). That is easier to change than hand-editing JSON. The editor will save the same format.
- **Biggest loadable level is 128 × 64 × 128.** The editor keeps its own 64 × 32 × 64 limit from the plan. Built-in levels may need a bit more room.
- **Block textures are drawn in code** as a 16×16-pixel atlas (`src/world/textures.ts`), so there are no image files and no copyright questions. Faces get soft corner shading (ambient occlusion) so edges and steps are easy to read.
- **Extra block: leaves**, for the Backyard tree. More blocks can be added the same way when the levels need them.
- **Water and lava** draw a little lower than a full block. Glass is see-through with a frame. Lava glows (unaffected by shadows) so it reads as dangerous.
- **Themes.** House is warm indoor light with no clouds, Backyard is a sunny blue sky with clouds, and City is a purple-orange sunset with clouds. All three are in `src/world/themes.ts`.
- **Phase 1 explore mode.** There is no cat yet, so the test level opens with a free-fly camera: click to lock the mouse, WASD to fly, Space up, Shift down. The level editor will reuse this camera.
- **FPS counter** in the bottom-left corner so we can check the 60 fps goal. F3 hides or shows it.
- **Physics runs at a fixed 60 steps per second** whatever the screen's refresh rate. Drawing happens every screen frame, so 120 Hz screens look smooth too.
- **The built game must be served, not double-clicked.** `npm run build` makes a `dist/` folder with relative paths that works on any static host (or with `npm run preview`). Browsers block loading game code straight from a `file://` page.
- **Node.js 26 LTS** was installed with winget, because the computer didn't have Node.
