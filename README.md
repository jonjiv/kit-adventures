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
| Sound on/off | M, or the speaker button in the top corner |
| Show/hide fps | F3 |

Every level starts with a 3, 2, 1, GO! countdown. Reach the golden pad at the end as fast as you can, then type your name for the leaderboard.

On an iPad or phone, touch controls appear after the first touch (hold it sideways):

| Action | Touch |
| --- | --- |
| Run | Put your left thumb down anywhere on the left half: a joystick appears under it |
| Look | Drag on the right half (the camera also swings behind the cat by itself) |
| Jump / double jump | JUMP button, bottom right |
| Dash / pounce | DASH button, above JUMP |
| Wall run, wall jump, ledges | Same as the keyboard: hold the joystick toward the wall, tap JUMP |
| Sound on/off | Speaker button, left of Pause |
| Pause | Pause button, top right. The pause panel has Settings: button size, camera speed and left-handed mode |

To try it on a real iPad or phone on the same Wi-Fi: `npm run dev -- --host`, then open the "Network" address it prints. You can also add the game to the home screen (Share > Add to Home Screen) to open it full screen like an app.

## Global leaderboard

Until it's set up, times are saved on each device. To share them with everyone (free, about 5 minutes):

1. Make a free account at https://supabase.com and create a new project (any name, any region).
2. In the project, open **SQL Editor**, paste in all of `supabase/scores.sql`, and press **Run**.
3. Open **Project Settings > API Keys** (or **Data API**). Copy the **Project URL** and the **publishable** key (the `anon public` key on older projects). Never use the `secret` / `service_role` key: it can delete everything.
4. Put them in `src/leaderboard/config.ts`, then commit and push. The publishable key is safe to be public.

To remove a time, open **Table Editor > scores** in Supabase and delete the row.

## Play online

https://jonjiv.github.io/kit-adventures/ (rebuilt automatically by `.github/workflows/deploy.yml` on every push to `master`; tests must pass first).
