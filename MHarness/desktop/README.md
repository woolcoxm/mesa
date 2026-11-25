# Mesa desktop shell (experimental)

An [Electron](https://www.electronjs.org) window around Mesa: it starts `app/scripts/serve.mjs` itself (so the real shell, notebook execution and the ACP bridge work exactly as in the browser) and loads the built app. No browser tab, no dev server to remember, native window controls, links open in your system browser.

```bash
cd app && pnpm build        # the shell serves app/dist
cd ../desktop
pnpm install                # downloads the Electron binary (~100 MB) once
pnpm start                  # opens Mesa in its own window
pnpm smoke                  # loads the window headlessly, prints the document title, exits 0/1
```

Environment: `MESA_DESKTOP_PORT` (default `5173`). The window uses the same `mesa.config.json` as the server.

**Status:** experimental. It could not be launched from the automated environment this was built in (Electron crashes when started inside that sandbox), so `pnpm smoke` is the first thing to run on your machine — if it prints `✓ desktop window loads Mesa — …`, the shell is good; please report either way on [issue #6](https://github.com/woolcoxm/mesa/issues/6). Native PTY terminals (instead of the server-side shell) are the next step.
