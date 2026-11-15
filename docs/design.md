# Design plan

Status: plan only. Nothing in this file is built yet.

## Subject, audience, job
- Subject: NASA's microgravity combustion experiments, set against the air a Moon base would use.
- Audience: NASA judges, aerospace researchers and engineers, students.
- Primary job: in ten seconds, show what was tested and what was not. Every number is one click away, with its source.

## What is wrong now
- The dark mode is a navy near-black (#0a0f1e). The animation stage is a tinted near-black (#060a16). The light page is blue-tinted (#f2f5fb).
- Nine rules use rounded corners of 24, 16, 10 and 999 px. Every block is a white bordered card.
- The type is Bricolage Grotesque and Instrument Sans, both taken from the reference file.
- The copy is already clean: no marketing words, no arrows, no middle dots (searched in web/src).

## Direction
Printed flight-experiment documentation. A white page, black text, grey rules. Left-aligned. Headings and white space group the content, not boxes. Colour is only used for meaning. The one dark surface is the flame stage. The map is the largest figure.

I did not use flame photographs. We have no verified image with a credit line, and every claim here needs a source. A NASA photo can be added later with its credit. The stage carries the "flame" job on its own.

## Colour
Six named values. Everything else is one of these at lower opacity (rules are Ink at 15 %, the zone fill is Lunar green at 14 %).

| Name | Hex | Means | Contrast on white |
|---|---|---|---|
| Paper | #FFFFFF | The page. | |
| Ink | #000000 | Text, axes, chart outlines, the stage. Also the filled triangles that mark solid-material tests, the strongest marks on the map. | 21.0 |
| Graphite | #595959 | Secondary text, captions, chart labels. | 7.0 |
| Flame blue | #0B5CAD | A gas or liquid test run in microgravity. Also the 0 g flame label. | 6.7 |
| Amber | #B45F00 | The flame on Earth, or "read with care" (a value from a report, a pressure from the record). | 4.6 |
| Lunar green | #2E7D5B | The lunar zone and nothing else. | 5.0 |

Rules:
- The same colour never carries a second meaning.
- The focus ring is Ink, 2 px, because blue is taken.
- Colour is never the only signal. Shape, area and a direct label say the same thing.
- Colour-blind check (simulated, colour difference, higher is better): blue against amber is at least 81 under every kind. Amber against green falls to 35 (protanopia). Blue against green falls to 15 (tritanopia). So green is only ever a large shaded area with an outline and a label, and the marks inside it are told apart by shape and by being darker than the pale fill.
- The stage is pure Ink. Inside the canvas, the flames use lighter tints of Flame blue and Amber so they show on black. Those tints live in flame.ts only.

## Type
- One family: Public Sans, weights 400 and 700, Latin only, self-hosted.
- Why: it was made for US government documents (the US Web Design System), in the Franklin Gothic tradition of American printed reports. It looks like documentation, it is plain at small sizes, and almost nobody picks it by default. It replaces both current fonts.
- Weight and size do all the work. There is no second family and no monospace.
- Five sizes, nothing else:

| Token | Size | Used for |
|---|---|---|
| text-s | 0.875 rem (14 px) | Captions, chart labels, tables, footer, evidence |
| text-m | 1 rem (16 px) | Body, buttons, inputs |
| text-l | 1.25 rem (20 px) | The plain sentences, sub-headings |
| text-xl | 1.75 rem (28 px) | Section headings |
| text-xxl | 3 rem (48 px) | The page title only |

- Line height 1.5 for body, 1.15 for headings. Text lines are 66 characters at most. Sentence case everywhere. No upper case, no letter-spacing.
- Spacing scale (px): 4, 8, 16, 24, 40, 64. Nothing else.
- Corners: 0 on the stage, the map and rules. 2 px on buttons and inputs only.

## Layout
Content column 1120 px. Text column 66 characters. Figures (stage, map) use the full column.

```
DESKTOP, 1440 px wide

  Flame in Freefall                                  (48 px, bold)
  See which fires NASA tested in space, and how
  close they come to air on the Moon.                (20 px)

  +--------------------------------------------------------+
  |########################################################|
  |####   1 g                        about 0 g   ##########|
  |####   (tall teardrop)            (dim sphere) #########|   pure black,
  |########################################################|   square corners
  +--------------------------------------------------------+
  Illustration, not data.
  On Earth: hot gas rises ...    On the ISS: nothing rises ...
  [Replay the drop]

  The question in three lines                        (28 px)
  ----------------------------------------------------------
  What NASA tested     What we built     Why it matters
  one sentence         one sentence      one sentence
  ----------------------------------------------------------

  Explore the tests
  Choose an atmosphere
  (o) ISS cabin  ( ) Lunar base or rover  ( ) Custom
  [NASA test atmosphere]  [ISS cabin]  [Lunar base or rover]

  What the data says here
  20 tests ran inside the lunar zone.                (20 px)
  All of them were gas flames on a burner.
  > Show the evidence

  [ ] Show the full pressure range
  Oxygen in the air (% by volume)
  60 |
     |  .   .                                   Figure: the map,
  30 |------------------+  full width, light     1120 px wide
     |  Lunar zone      |  gridlines, zone
     |  (30 % or more,  |  labelled inside
  21 |  10.2 psi or     |  the chart
     |  less)           |
     +--------------------------------------------
       0     5     10    15    20   Pressure (psi)
  Click a mark, or press Tab and use the arrow keys, then Enter.
  circle gas   square liquid   triangle solid   diamond report

  (the point card opens here: a heavy rule on top, no box)

  What we know, what we don't
  ----------------------------------------------------------
  What we know                  What we don't know
  one line each                 one line each

  ----------------------------------------------------------
  About the data  (sources, data version, known problems)
```

```
PHONE, 390 px wide, 16 px gutters, one column

  Flame in Freefall                      (title wraps to two lines)
  See which fires NASA tested
  in space, and how close they
  come to air on the Moon.

  +--------------------------+
  |##########################|   stage, full column width
  |####  1 g   about 0 g ####|
  +--------------------------+
  Illustration, not data.
  On Earth: ...
  On the ISS: ...
  [Replay the drop]

  The question in three lines
  What NASA tested
  sentence
  What we built
  sentence
  Why it matters
  sentence

  Explore the tests
  Choose an atmosphere
  (o) ISS cabin
  ( ) Lunar base or rover
  ( ) Custom
  [NASA test atmosphere]
  [ISS cabin]  [Lunar base or rover]

  What the data says here
  sentences
  > Show the evidence

  [ ] Show the full pressure range
  map, taller (4:5), labels still
  14 px, drawn at the real width
  hint, key (one item per line)

  What we know, what we don't
  What we know
  lines
  What we don't know
  lines

  About the data
```

- Section order changes in one place: "What the data says here" moves above the map, so the reader gets the answer, then the figure. This reverses an order that a test pins (see decisions).
- The map is drawn at the real pixel width of its box, so chart labels stay 14 px on a phone. Today the chart is a fixed 960-wide drawing scaled down, which makes labels about 5 px on a phone.

## Interactive things get boxes, nothing else does
- Buttons and inputs: 1 px Ink border, 2 px corners, white fill. On hover the fill goes to Ink at 6 %. A pressed preset is filled Ink with white text.
- The disclosure ("Show the evidence") is plain text with the native marker, underlined.
- The point card is not a box. It has a 2 px Ink rule on top, space, and a Close button.
- Three lines, "What we know", the sentences and the footer have no border. Space does the grouping.
- A grey rule is used only where it separates two different things: the page content from the footer, and the two columns of "What we know, what we don't". It is never a decoration on every section.

## The map, at publication quality
- Axis titles with units: "Oxygen in the air (% by volume)" and "Pressure (psi)".
- Gridlines: Ink at 15 %, 1 px. Ticks and labels in Graphite, 14 px.
- The lunar zone: Lunar green at 14 % with a 1.5 px outline, labelled inside the chart ("Lunar zone: 30 % oxygen or more, 10.2 psi or less"). The numbers come from data/reference/habitats.json.
- The habitat point and the presets are drawn on the chart with a direct label: "ISS cabin", "NASA test atmosphere", "Your target".
- Marks are small (radius 3 to 4 px). Shape carries the fuel: circle gas, square liquid, triangle solid. Gas and liquid marks are Flame blue. Solid marks are filled Ink (black) triangles with no transparency. They are the strongest marks on the map on purpose: the main finding is that solid materials were only tested near 1 atm. Report conditions are Amber diamonds.
- No legend box. One line of text under the chart explains the shapes and the diamond. It still reads as a list of Gas, Liquid, Solid, Report condition and Target zone.

## Rules that keep it from looking generated
- Colour only for meaning, as above. Everything else is black, white or grey.
- No icons, no emoji, no photographs, no illustrations except the flame stage.
- No gradients (the existing test stays), no shadows, no blur, no upper case.
- No entrance or scroll animation. No transitions. Motion is the flame animation, plus the immediate response to a click or key. With reduced motion, the 1 g and 0 g flames show as still frames.
- Hover changes only on buttons and inputs. Marks use the native tooltip.
- Plain verbs on buttons: "Replay the drop", "Show the evidence", "Close", "Show the full pressure range".
- One bold element: the flame stage. It is the only black area on the page. The map is precise, not bold.
- Optional framing for the stage: four small corner ticks inside the canvas, like a camera viewfinder. Nothing else is added to it.

## Review against the signs of a generated page
I checked this plan, and the first draft of it, against your list.

| Sign | In the first draft | What I changed |
|---|---|---|
| Near-black navy with a bright accent | none | Stage is pure #000000. Dark mode removed. |
| Same rounded card everywhere, shadows, gradients | none | Only buttons and inputs get 2 px corners. Cards removed. |
| Upper-case labels, eyebrows, one accented word | Table headings were upper case | Sentence case. "What NASA tested" and the other two are headings in Ink, not small accent labels. |
| Middle dots, monospace labels, arrows | File names in a monospace face | Same family, no monospace. No arrows. |
| Numbered markers on non-sequences | "Figure 1, Figure 2" captions | Removed. Plain captions. |
| Entrance animation, hover on everything | Fade on the point card | Removed. Card appears at once. Hover only on controls. |
| Marketing words | none (searched the source) | A test will keep it that way. |
| Colour used for decoration | Blue for marks, links and focus | Blue is only microgravity. The focus ring is Ink. |

## What will be built at Step 3
- Rewrite styles.css to these tokens. Remove dark mode.
- Replace the two fonts with Public Sans (one new npm package, @fontsource/public-sans, replacing two).
- Rework Hero, ThreeLines, HabitatSelector, DataSaysCard, KnowDontKnow, PointCard, AboutFooter and AtmosphereMap markup to the layout above.
- A test over styles.css that fails on: any gradient, box-shadow, text-shadow, text-transform: uppercase, any font size outside the five tokens, any border-radius other than 0 or 2px, any dark-mode block, and any hex colour not in the six.
- A test over the shipped copy for the marketing words, arrows and middle dots.
- Screenshots at 1440 and 390 px with Playwright (dev tool only, not in the test suite), kept in a git-ignored folder.

## Existing tests that must change
- styles.page.test.ts: the six "changes ... in dark mode" cases and the font-name case. I will rewrite them and show the diff.
- App.summary.test.tsx, "puts the card inside the explorer, after the map", if you accept the new order.

## Decisions (answered)
1. The plain sentences go above the map.
2. No photographs.
3. Public Sans 400 and 700, from a local npm package (@fontsource/public-sans). No Google Fonts request in the built site.
4. Subtle viewfinder corner ticks on the flame stage.
5. The map is drawn at its real width. If that takes more than about 45 minutes, keep the fixed drawing with horizontal scrolling on narrow screens.
6. The dark-mode and font-name cases in styles.page.test.ts are rewritten, with the diff shown.

## Font check
Public Sans has tabular figures. Both weights carry the tnum feature, and with it every digit is 1400 units wide. The default digits are proportional (the digit 1 is 814 units, the digit 8 is 1295). So tables and chart labels set font-variant-numeric: tabular-nums, and numbers then line up.

## As built
Where the build differs from the plan above, after looking at screenshots at 1440 and 390 px:
- The y-axis title stays "Oxygen (% by volume)". It already carries its unit, and a test pins it.
- The zone label sits at the bottom left of the zone, because no test sits there. On a phone the limits wrap into short lines so the label fits the narrow zone.
- Solid triangles are drawn last and larger than the other marks (they were hidden under blue squares at 14.7 psi). The ISS and preset labels are drawn above the marks so no mark hides them. A custom target that sits on a preset is named once, with the preset's name.
- The checkbox is "Show the full pressure range".
- The key under the chart is one wrapping line of swatches and words, with no box.
- Marks that sit exactly on top of each other (nine solid tests near 1 atm) cannot all be clicked with a mouse. The keyboard reaches each one.
