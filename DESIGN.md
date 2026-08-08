# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-08-02
- Primary product surfaces: minimal landing page, updates with category filters, link-only About page, long-form and scrollytelling articles.
- Evidence reviewed: the public `zuzuka28/quarto-scrolly-slides` extension, its examples, responsive rules, and visual tokens.

## Brand
- Personality: calm, official, technically precise, approachable without decorative informality.
- Trust signals: direct GitHub links, restrained typography, and reproducible source structure.
- Avoid: saturated rainbow accents, warm coral/green palettes, decorative serif or script-like fonts, heavy shadows, dense dashboard chrome, and excessive animation.

## Product goals
- Goals: keep work easy to publish and connect; give technical articles a calm reading surface; keep publishing friction low.
- Non-goals: comments, accounts, newsletters, analytics, or a full CMS in the initial version.
- Success signals: every visible link is intentional, and new posts can be connected without restructuring the project.

## Personas and jobs
- Primary personas: technical readers, data/storytelling practitioners, and the author maintaining the site.
- User jobs: scan recent work; find writing by topic; read long-form material comfortably; inspect a project or source repository.
- Key contexts of use: desktop deep reading, mobile discovery, shared article links.

## Information architecture
- Primary navigation: Home, Updates, About, GitHub.
- Core routes/screens: `/`, `/updates.html`, `/about.html`, `/posts/<slug>/`.
- Content hierarchy: statement and section links on the landing page; chronological updates with category filtering; GitHub links only on About.

## Design principles
- Restrained precision: white and silver surfaces, neutral typography, thin borders, and a small stable set of blue/violet accents.
- Technical clarity: compact metadata, stable content widths, visible focus states, code and diagrams treated as first-class content.
- Progressive richness: the article remains useful without the slide deck; interaction enhances rather than gates the text.
- Tradeoffs: prefer locally available system fonts and SVG artwork over external font/image requests.

## Visual language
- Color: white/silver light surfaces and dark-gray dark surfaces; shared violet `#786bea` and blue `#4c85d9` accents in both modes; neon red `#ff3b4f` is reserved for the landing statement.
- Typography: neutral system sans-serif for interface, headings, and body copy; no decorative serif, calligraphic, or strongly curved display faces.
- Spacing/layout rhythm: 4/8px base with generous 24–72px section gaps; maximum reading width around 72ch.
- Shape/radius/elevation: restrained 10–18px radii, one-pixel silver borders, minimal low-opacity shadows.
- Motion: only subtle functional hover feedback; disabled when reduced motion is requested; no decorative blinking or looping motion.
- Imagery/iconography: the current GitHub profile image for the profile cover and browser favicon; otherwise no decorative imagery.

## Components
- Existing components to reuse: Quarto navbar, listings, category metadata, search, code tools, Reveal output, Scrolly Slides controls.
- New/changed components: landing statement, section links, link-only profile cover, section shell, update feed treatment.
- Variants and states: primary/secondary buttons; active/hover/focus category filters; desktop/mobile listing layouts.
- Token/component ownership: `styles.scss` owns site tokens; extension tokens are overridden only at `.scrolly-slides` boundaries.

## Accessibility
- Target standard: WCAG 2.2 AA where applicable.
- Keyboard/focus behavior: all links and controls retain prominent `:focus-visible` outlines.
- Contrast/readability: body text stays near-black on white/silver surfaces and near-white on dark-gray surfaces; shared accents meet readable contrast; line length is constrained.
- Screen-reader semantics: landmarks, real headings, lists, descriptive link copy, and useful alternative text.
- Reduced motion and sensory considerations: hover transforms and smooth scrolling are removed under `prefers-reduced-motion`.

## Responsive behavior
- Supported breakpoints/devices: modern browsers from 360px phones through wide desktop monitors.
- Layout adaptations: hero and home grid collapse below 900px; category sidebar becomes a normal flow section; listing thumbnails stack below 640px.
- Touch/hover differences: no interaction depends on hover; tap targets remain at least 40px where controls are custom.

## Interaction states
- Loading: static-first pages; no custom loading state required.
- Empty: listings preserve their layout without fabricating content when no documents match.
- Error: deployment and local checks fail loudly; broken interactive decks display the extension's error state.
- Success: current content is visible immediately after static generation.
- Disabled: not used outside native extension controls.
- Offline/slow network: core typography, SVGs, CSS, and JS are served from the built site without third-party runtime requests.

## Content voice
- Tone: minimal and direct; no placeholder prose.
- Terminology: keep established technical terms such as Quarto, Reveal, scrollytelling, and open source; explain them on first use.
- Microcopy rules: short labels, active verbs, no hype, no forced exclamation marks.

## Implementation constraints
- Framework/styling system: Quarto website with native light/dark theme toggle, Bootstrap-compatible SCSS, vendored Quarto extension.
- Design-token constraints: both modes share the same violet/blue accents; only surface, text, border, and shadow tokens change by mode.
- Performance constraints: no client framework, no external font CDN, and no mandatory analytics scripts.
- Compatibility constraints: Quarto 1.9 stable in CI; modern evergreen browsers for Scrolly Slides.
- Test/screenshot expectations: `make check` must render and validate required outputs; `make previews` refreshes tracked desktop/mobile PNG references.

## Open questions
- [ ] Add a custom domain later if needed / owner / affects `site-url`, DNS, and GitHub Pages settings.
