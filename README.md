# Flipdot Dashboard

A simulated 56 × 32 flip-disc display for a wall tablet or spare screen: clock, current weather and a 3-day forecast, with per-disc flip animation and synthesised flip sounds.

**Live:** https://arliber.github.io/flipdot-dashboard/

Designed in Claude Design (`Flipdot Dashboard v2`) and implemented here in Vite + TypeScript, no framework.

## Use

- **Tap** the display to go to the next page. The first tap also enables sound, keeps the screen awake and enters fullscreen.
- **Double-tap** to open settings: disc shape, size and colour, page transition, auto-rotate interval, flip sound and volume, 24-hour clock, blinking colon, worn discs, grid measurements and weather location.

**Disc size** sets the resolution. Standard is the original 56 × 32 board. Large and Extra large make each disc 1.33× and 2× bigger, so the screen holds fewer of them (about 42 × 24 and 28 × 16 on a 16:9 screen), and every page re-lays itself out for that grid, picking the largest fonts and icons that fit.

Settings are saved in `localStorage`.

## Pages

1. **Clock**: time plus day, date and month.
2. **Now**: weather icon and temperature, alternating between the condition and today's high/low.
3. **Forecast**: the next three days with icon, high and low.

Weather comes from [Open-Meteo](https://open-meteo.com/) (free, no API key) and refreshes every 15 minutes. The location can be a city name, `lat, lon`, or blank to use the device's geolocation.

## Develop

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## Layout

| File | Role |
| --- | --- |
| `src/main.ts` | App controller: pages, ticking, input, settings changes |
| `src/board.ts` | Canvas board: disc sprites, flip scheduling and animation |
| `src/pages.ts` | Page renderers: original layouts at 56 × 32, fitted layouts for other grids |
| `src/fonts.ts` | Bitmap fonts and frame drawing helpers |
| `src/icons.ts` | Procedural weather icons, WMO code mapping |
| `src/weather.ts` | Open-Meteo fetch and geocoding |
| `src/sound.ts` | Web Audio flip clicks |
| `src/panel.ts`, `src/style.css` | Settings panel |
