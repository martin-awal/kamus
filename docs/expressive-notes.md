# Material 3 Expressive in Kamus: what is followed and what is interpreted

Google publishes Material 3 Expressive mainly for Android (Compose) and as design guidance; the official web components are not being
developed further and do not ship the Expressive set. There is no web specification to test compliance against, so Kamus cannot claim to
follow it "strictly". This file records what was taken directly from Material guidance and what is an interpretation.

## Followed directly (documented Material 3 guidance)
- Window size classes: compact < 600, medium 600-839, expanded 840-1199, large >= 1200, extra-large >= 1600.
- Navigation: navigation bar on compact, navigation rail from medium up.
- Canonical layouts: supporting pane (History beside the dictionary from expanded), list-detail (Anki cards from expanded).
- Minimum touch target 48x48 on touch devices.
- Colour roles and tonal surfaces (already in place; the tonal palette generator is Kamus' own approximation, see theme.js).

## Interpreted (the Expressive ideas, applied with plain CSS)
| Expressive idea | What Kamus does | Why it is an interpretation |
|---|---|---|
| Emphasised typography | Page titles and section headings use weight 700; the headword stays large at weight 500 | The emphasised type scale is defined for Android type tokens; the weights were chosen by eye with the Roboto weights the page loads (400, 500, 700) |
| Shape variety and shape morphing | Wider radius range; buttons become squarer while pressed; the speaker button changes shape while playing; selected chips turn into pills | The official shape library (35 shapes) and morph specs target Compose; CSS can only morph corner radii here (the loading indicator already morphs between shapes in JS) |
| Spring motion | One easing token `--motion-spatial` built with CSS `linear()` to imitate a damped spring; colour/opacity use a non-overshooting curve | The web has no spring primitive; the curve and durations are approximations, not the published spring tokens |
| Stronger selection | Active navigation indicator is wider and filled, the label is bold | Indicator sizes follow the rail/bar specs loosely (64x32) |
| Reduced motion | All animation and transitions are removed under `prefers-reduced-motion` | Standard web practice; Material's guidance is platform-level |

## Not done
- The Expressive component set (split buttons, button groups, FAB menu, flexible toolbars, new progress indicators beyond the loading indicator).
- Variable-font axes for emphasis (Roboto Flex): the page loads static Roboto weights.
- Any claim of certification. Visual acceptance is by the owner looking at the screenshots (CI artifacts) and by the usability sessions.
