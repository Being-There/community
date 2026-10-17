# Being There visual identity — draft 1

The brand idea is **a sunset over mountains, with a winding path connecting the foreground to the horizon**. It represents being together and revisiting familiar places, without showing a particular family, making medical claims, or implying a memory test. The same mark works for any family, volunteer or organization using the app.

## Approved source assets

| Asset | Use | Notes |
| --- | --- | --- |
| [brand-mark.svg](assets/brand-mark.svg) | Organization avatar, app masthead, profile links, documents | Simple vector, safe inside GitHub's circular crop |
| [favicon.svg](assets/favicon.svg) | Browser favicon and 16–32 px applications | Deliberately simplified; don't shrink detailed paintings to 16 px |
| [brand-lockup.svg](assets/brand-lockup.svg) | Headers, letterhead and contributor materials | Text is rendered using familiar system font fallbacks |
| [brand-banner.svg](assets/brand-banner.svg) | GitHub README and website banners | Uses existing project words: “Keep the stories. Share the moments.” |

The application hosts its own exact `/brand-mark.svg` and `/favicon.svg` copy, because the authenticated app is independently self-hostable and cannot depend on a public community website for branding.

## Colors

- Deep pine `#104B40` — icon background
- Dark teal `#143B38` — headings and dark background
- Lake blue `#4E8BA1` — far hills
- Teal `#237478` — foreground mountain layers
- Warm gold `#FFD176` — sunset
- Cream `#FCF4E4` — border and light foreground

Keep text readable against backgrounds; don't use gold text against cream, or rely on color alone to communicate state.

## Using the variants

- **16–32 px**: use the favicon, not a detailed photograph or an icon containing tiny people.
- **48–512 px**: use the primary circular mark. Export a 512×512 PNG for the GitHub organization picture; repository commits **cannot** change the organization avatar. A maintainer sets that in [GitHub organization profile settings](https://github.com/organizations/Being-There/settings/profile).
- **Site/app mastheads**: use the primary mark alongside live HTML text, preserving localization and screen-reader semantics.
- **Marketing, social and presentations**: a richer fictional lakeside illustration may accompany the mark at large sizes. Keep complete figures within safe margins; never use personal family photos or generated composites implying a real person's identity.
- Avoid embedding standalone taglines or clinical claims in the tiny icon. Keep raster art out of code/CI unless provenance and reuse rights are reviewed.

These are synthetic, newly produced design assets. This draft does not modify real user data, change app functionality, alter GitHub organization settings, or declare a registered trademark.
