# Ryoku team profile

A GitHub profile for people working on Ryoku. Your part goes on top and the
Ryoku project goes underneath, in the look of ryoku.dev. It is a few SVG files
and a README, rebuilt every night so the numbers stay current.

## Make your own

1. Create a public repository named exactly like your GitHub username. GitHub
   shows its README on your profile.
2. Copy `profile/` and `.github/workflows/profile.yml` from
   [neur0map/neur0map](https://github.com/neur0map/neur0map) into it.
3. Edit `profile/profile.json` (see below). Leave `profile/ryoku.json` alone.
4. Delete `profile/data.json` and push. The workflow builds your sheets and
   README on that push, after any later edit, and again every night.

To build on your own machine instead, run `node profile/build.mjs` (Node 22).
Putting `GITHUB_TOKEN=$(gh auth token)` in front of it avoids the API rate
limit. `--local` writes a README that points at the files on disk, which is
handy for checking a change in a browser before you push.

## profile.json

| Field | What it holds |
|---|---|
| `user` | Your GitHub username. It is also the big name on the cover. |
| `branch` | The branch your README is served from, usually `main`. If yours is different, change it in `.github/workflows/profile.yml` too. |
| `sun` | One character of your name to print in the sun colour, or `""` for none. |
| `portrait` | The figure on the cover: `hero` (the bust), `power` or `forge`. |
| `rows` | Up to four cover rows, each `["LABEL", "value"]`. The value `@commits` prints your live commit count on Ryoku. |
| `now` | `@release` shows the current Ryoku release. Any other text is printed as written. Leave it out for no plate. |
| `bio` | A few plain sentences about you. |
| `focus` | Up to three cells under the bio. Each has a `title`, a `text` and a `glyph`: `tiles`, `install`, `seal` or `radar`. |
| `work` | Your Ryoku projects. Each has a `repo`, a `desc` and an `art`: `bars`, `terminal`, `ssh`, `grid`, `player` or `docs`. Leave the list empty to skip the section. |
| `workTitle` | The heading over `work`. Defaults to "What I maintain". |
| `links` | Up to five chips at the bottom, each with a `label`, a `value` and an `href`. |

Each art takes a few extra fields: `rows` for `bars` (each `["name", count]`),
`cmd` and `out` for `terminal`, `host` and `items` for `ssh`, `labels` for
`grid`, `providers` for `player`, `lines` for `docs`. neur0map's file has
working examples of `bars`, `grid`, `terminal` and `player`.

## ryoku.json

The part every team profile shares: what Ryoku is, the editions, the desktop
shots and how to install it. When it changes, copy the new file from
neur0map/neur0map instead of editing yours, so every profile on the team says
the same thing.

## Where things come from

The colours, fonts and figures are the ones on ryoku.dev. `fonts/make.sh`
rebuilds the font subsets from a ryoku-site checkout. `art/` holds the 1-bit
masks cut from the site's bone art, the Ryoku mark and the showroom shots.
