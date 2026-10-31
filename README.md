# Kit Adventures

A blocky 3D cat parkour platformer for the web browser, designed by Gideon (age 9). See `PLAN.md` for the full design and `DECISIONS.md` for choices made along the way.

## Run it

```bash
npm install
npm run dev        # play at the URL it prints
npm test           # unit tests
npm run build      # makes dist/ for hosting
npm run levels     # rebuilds public/levels/*.json from scripts/build-levels.ts (obstacle sizes: scripts/obstacles.ts)
```

Movement and feel numbers live in `src/player/tuning.ts`.

## Controls (so far)

| Action | Key |
| --- | --- |
| Run | W A S D or arrow keys |
| Look | Mouse (click the game first; Esc frees the mouse) |
| Jump / double jump | Space (tap for a small hop, hold for a big jump) |
| Wall run | Jump at a brick, stone or wood wall while holding toward it at an angle |
| Wall jump | Space while wall-running or touching a wall |
| Ledge grab | Automatic when falling near a ledge; Space or forward climbs, back drops |
| Dash / pounce | Shift (once per jump in the air) |
| Zoom | Mouse wheel |
| Show/hide fps | F3 |

## Play online

https://jonjiv.github.io/kit-adventures/ (rebuilt automatically by `.github/workflows/deploy.yml` on every push to `master`; tests must pass first).
