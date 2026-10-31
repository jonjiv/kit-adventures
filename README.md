# Kit Adventures

A blocky 3D cat parkour platformer for the web browser, designed by Gideon (age 9). See `PLAN.md` for the full design and `DECISIONS.md` for choices made along the way.

## Run it

```bash
npm install
npm run dev        # play at the URL it prints
npm test           # unit tests
npm run build      # makes dist/ for hosting
npm run levels     # rebuilds public/levels/*.json from scripts/build-levels.ts
```

Movement and feel numbers live in `src/player/tuning.ts`.
