# Visual spec — <migration name>

Captured <date> from the DEPLOYED apps (Phase 0 intake). This file — not the source code —
is the visual ground truth every prompt, fix, and review compares against.

- Old app (parity target): <URL, e.g. https://test-....com/...>
- Migration (current state, if deployed): <URL>
- Screenshots stored at: references/screenshots/
- Measured tokens (colors/spacing/typography/radii): references/design-map.md + .json —
  captured via Claude-in-Chrome using the /taste methodology (screenshots + injected-JS DOM
  measurement) in the human's authed browser. This file covers the BEHAVIOR layer tokens
  can't: what controls are, what they do, and when.

Capture BOTH apps side-by-side per page. Record what the old app RENDERS, not what its code
suggests. Where the two apps differ, the entry below is the old app unless the decision
record explicitly overrides it (note the override inline).

## Page: <name> (<route>)

Screenshot: <file> (old) / <file> (migration)

- Layout: <regions, order, alignment>
- Grid: <column order and headers, exact value formatting per column (dates, counts, chips),
  row action buttons (variant, placement, order), header controls, options/tool panel look,
  empty + loading states>
- Controls: <exact widget type per control — checkbox size/style, radio vs segmented bar,
  multiselect chip behavior (min-width, overflow, "Multiple Selected" style), search inputs>
- Buttons: <variant, color, size, casing per button — Add/Edit/Delete/Export/Reactivate>
- Modals: <width (and what sets it — content vs container), padding, header, footer buttons>
- Forms: <field order, labels, asterisks/required markers, error placement and when errors
  surface (on submit? on blur?), accordion/section headers and their error badges>
- Colors/typography: <tokens or hex where they deviate from the target theme defaults>
- States: <loading overlays and their labels, disabled looks, empty text>

## Page: <next page>

...

## Known old-app defects (do NOT reproduce)

List anything the human explicitly marked as a bug in the old app — parity stops here;
the decision record entry that supersedes it is linked per item.
