# UI rules against generic patterns

Catalog of interface patterns not to be used in this project and what to do instead. It should be read before touching the HUD, panels, control guide, location cards, or startup and error screens. Every time Luca discards a pattern, a voice is added: so it doesn't come back.

Adapted from `UI_ANTI_SLOP.md` by Soso Mart (`C:\Projects\GitHub\3dcombinisimulator\docs\`), keeping only what applies to an isometric map with a driving mode. `AGENTS.md` rules take precedence.

The common cause of discarded patterns is always the same: dashboard habits (cards, titles, explaining subtitles, double indicators) applied to a game. The game screen must look like part of the model, show only what is needed at that moment and say everything only once.

## Principles

1. **One fact, one indicator.** If a value is already on the screen (coins, time, direction of the car) it is not repeated as text, second bar or label.
2. **Teach with objects, not sentences.** The regular game and the first game work with icons, numbers, movement and touch response. No instruction sentences. Accessible names (`aria-label`, region `role="status"`), short recovery errors and place names, which are contained, remain valid.
3. **No internal narration.** Which data is being loaded or which sector is arriving goes on the console, not on the screen. Only what the player can use goes on the screen.
4. **No tabs around full-screen states.** Startup, error, and context loss take up the screen; they are not rounded panels with a shadow over a gradient.
5. **No redundant titles.** A screen whose identity is already given by the scene, icon or context does not have a text title.
6. **Losing focus is not pausing.** Switching tabs or windows does not place a "Paused" panel over the game. You cancel the touches in progress and that's it. A pause requested by the player with a command is another thing.
7. **Icons drawn, one stroke.** Own SVG in `index.html` sprite, stroke 2, rounded ends, `currentColor`. No emojis or Unicode glyphs instead of icons.
8. **The scene remains visible.** No interface element covers the car, the next coins or the nearest patrol. See [contratto di camera](CAMERA_FRAMING.md).
9. **Feedback answers a question.** Each effect says one precise thing: I took the coin, I bumped, I'm in danger, I've arrived. Two signals for the same thing are noise: one is removed.

## Catalogue

### Map: location profile (Luca, 24 November 2026)

The pill with just the name becomes a card for the places that have a `card` block in the catalog: photo, number and neighborhood, name, Spanish text of 400–600 characters, an external link with the domain written next to it. Panel on the left on wide screens and on the phone in landscape (where the menu already opens), sheet from the bottom on the phone in portrait. Places without `card` hold the pill.

Rules established with Luca: neat and animated, but without superfluous elements. For this reason, no decorative icons, labels, solid buttons or multiple shadows: an ivory surface, a photo, a title in Georgia such as the names of the neighborhoods, a thread above the link. The work is in the movement, in a single coordinated gesture: the panel enters, the photo is revealed from above as it comes back from the zoom, the name rises word by word from behind a mask, text and links follow. One curve for everything. No GSAP: native browser animations are enough (`element.animate`), without dependencies.

On the phone the sheet folds into the pill when you drag the photo down or move the map, and reopens with a touch. The tab does not appear in Conducir. Photo credit (author and license, with link to source page) is always on the photo.

### Guide: change of view

The button uses an eye to indicate the change of point of view. The camera looked like a snapshot.

### Guide: street and neighborhood

The name of the street and the title of the neighborhood are directly on the model. The dark outline follows the letters and makes them legible on light roofs.

### Guide: Texts in the HUD (Luca, November 21, 2026)

The first version showed «12 monedas · 23.4 s · Récord 30», «→ Teatro Pérez Galdós», a one-line suggestion (“Toca izquierda o derecha…”) and a panel «¡Atrapado!» with two text buttons. Discarded: Too much to read while driving.

In their place: pills with icon and number; two tactile zones that pulsate and light up when touched; the location number on a chip pointing to the finish line; the points that pop up where they are earned. The names go to the region for screen readers.

### Guide: location number on the card (Luca, November 23, 2026)

The destination card was a yellow circle with the location number in the menu ("01") and a little arrow broken off. It wasn't clear: the number requires you to remember the menu, the circle looked like a button and the yellow was that of coins. Now it is a turquoise drop, a color used only by her and the light beam, whose tip indicates the place (downwards, on the beam, when it is framed). Inside there is the distance as the crow flies, «4.3km» and below 995 m «850m» in steps of 10 m. A distance along the roads was tried and discarded: it jumped by more than a kilometer when the car approached another road. At each new destination the drop leaves the car and flies to its place.

### Help: Screen capture

«ATRAPADO» is the only writing on the result. The three icons with coin, time and record values ​​are in a row under the title, while the driving HUD disappears. The icon buttons to try again and return to the map are under the car. Title and controls are placed directly on the scene, which remains visible in slow motion and in black and white.

### Driving: tactile brake indicator (Luca, November 22, 2026)

Removed the central button with the brake symbol and the related educational animation. Braking remains active by holding down both sides, or with Down Arrow. Since 26 November 2026 Space fires the car's gun (Luca's request), as F does.

### Help: Emoji icon on button (November 21, 2026)

The button to enter help used 🚗. Emojis change appearance from one system to another and do not follow the lines of other icons. Replaced by its own SVG icon.

### Guide: Red alarm and siren border in the final panel (Luca, November 21, 2026)

The edge of the screen pulsed red with a nearby patrol, and the capture panel showed a flashing siren. Both removed: the patrol can already be seen on scene with its flashing lights, and the siren repeated what the panel says with its mere appearance (principle 1).

### Guide: records always on screen (Luca, 21 November 2026)

The cup with the record stood next to coins and time during the game. Now it only appears at the end of the game: while driving it is of no use in making any decisions.

### Guidance: directionless halo (Luca, November 21, 2026)

The part of the car covered by a building appears yellow on its surface. When the center of the cabin also disappears, the arrow follows the nose during the slide.

## Before delivering an interface

- Can you understand without reading? Cover the lyrics and try.
- Does each value appear only once?
- At 390×844 and in compact landscape, cars, next coins and closest patrol remain uncovered?
- Do icon-only commands have an accessible name, and does the outcome (destination, capture) reach the `role="status"` region?
- Touch areas of at least 40 px, contrast of text and numbers of at least 4.5:1 on the real background.
- During loading the footer shows only the current phase; the attributions appear with the map open, on the first view, up to the first command. Afterwards, they can be consulted in «Licencias de Datos» in the places menu. The launch bar does not reappear while browsing, driving, or fetching WebGL.
- Taps on the map and guide do not select text, open context menus, or drag the page. The location menu remains scrollable.

## Not decided

- No open entries.
