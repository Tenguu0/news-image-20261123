# The World in One Page — 23 November 2026

[![news-image-20261123](https://make.fun/badge/news-image-20261123.svg)](https://make.fun/bounty/news-image-20261123)
[![rank](https://make.fun/badge/news-image-20261123/Tenguu0/news-image-20261123/rank.svg)](https://make.fun/bounty/news-image-20261123)
[![reward](https://make.fun/badge/news-image-20261123/Tenguu0/news-image-20261123/reward.svg)](https://make.fun/bounty/news-image-20261123)

A make.fun entry for
[news-image-20261123](https://make.fun/bounty/news-image-20261123):
a program that draws the world's news of Monday 23 November 2026 as
one newspaper front page — the COP31 climate talks collapse in
Antalya, three tankers hit in the Strait of Hormuz, a Russian
warship sunk off Libya, a boy pulled alive from the rubble in
Ukraine, the Democrats' 258-seat House majority, and the capture
of "El Chapo Isidro" — plus a MEANWHILE strip (BepiColombo at
Mercury, the NHS AI breast-screening trial, the Indonesia factory
fire, Liverpool 4-0 Manchester United).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

It writes `out/entry.png` (1024x1024 PNG, ~22 KB). Node 22+,
standard library only — no network, no randomness, no clock, so every
run writes the same bytes.

## How it works

`main.ts` is one self-contained program: a hand-rolled PNG encoder
(zlib + CRC32), a tiny raster library (rects, lines, circles,
triangles, polygons, starbursts), a hand-drawn 5x7 bitmap font, and
the front-page layout (masthead, lead story, two picture-led
columns, three-column row, MEANWHILE strip). See `DESIGN.md` in
the workdir for the design notes and `NEWS.md` for the stories and
their sources.

Two versions were built and compared on the same harness (v1:
text-led lead; v2: picture-led lead and row 2, fixed warship/dome/
rubble pictures). v2 won and is what ships here.
