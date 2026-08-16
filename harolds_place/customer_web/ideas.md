# THE HAROLD'S PLACE Ordering — Design Direction

## Three possible directions

### 1. Courtyard Service Ledger
**Very Brief Intro:** A warm, editorial ordering experience inspired by a contemporary Nigerian hospitality house and a waiter’s handwritten service ledger. It feels assured, local, and practical rather than ornamental.

**Probability:** 0.07

### 2. Quiet Maroon Hospitality
**Very Brief Intro:** A refined, light-toned ordering interface that takes a restrained cue from the public profile’s maroon-and-cream identity, pairing it with strong menu hierarchy and status clarity.

**Probability:** 0.04

### 3. Market Evening Dispatch
**Very Brief Intro:** A richer, dusk-led food-ordering environment with expressive regional color, dense information blocks, and a strong delivery-status language.

**Probability:** 0.08

## Chosen direction: Quiet Maroon Hospitality

### Design Movement
Contemporary African hospitality editorial design: calm cream surfaces, wine-colored moments of emphasis, tactile paper-like detail, and clear service information. The mood is a restaurant ordering product, not a generic lifestyle campaign.

### Core Principles
1. **Ordering comes first.** Every prominent element should improve choosing food, understanding availability, or getting to checkout.
2. **Specific, not speculative.** Verified restaurant facts may appear; every unverified business detail remains visibly configurable or absent.
3. **Warm restraint.** Use a concise palette, quietly layered surfaces, and photography-free visual assets so the interface feels welcoming without inventing a restaurant experience.
4. **Status with dignity.** Availability, restaurant state, and order progression use plain-language labels and high-contrast signals, never decorative badges.

### Color Philosophy
Deep oxblood is the ownable signature color and conveys the hospitality richness already suggested by the restaurant’s public social identity. Cream and warm grey make menus readable on small screens; a restrained foliage green is reserved for live/open and successful order states. The palette must never imitate a luxury-tech dark UI.

### Layout Paradigm
Use a **service-counter flow** rather than a centered marketing grid. The header behaves like a concise order counter; category navigation slides horizontally at thumb level; the main menu runs as a measured editorial list; cart summary is a persistent, mobile-first bottom rail. On desktop, the cart rail becomes a right-hand receipt column rather than a floating modal.

### Signature Elements
1. A small **arched service window** framing the hero’s replaceable identity art and “ordering configuration” state.
2. **Receipt-rule separators** and dotted tabular prices that make menu and order information easy to scan.
3. A **status ribbon** that articulates restaurant availability and the order state without assuming unverified business hours.

### Interaction Philosophy
Interactions should feel like quick, competent service. Add-to-cart, quantity adjustment, and filtering provide immediate feedback; selection state uses color and copy instead of surprise motion. Disabled or unavailable actions state why, and configuration-dependent interactions explain what staff need to set up.

### Animation
Use a 140–220ms ease-out transition for buttons, menu item expansion, cart updates, and sheets. Quantity changes may briefly highlight the cart count; no ambient loops, parallax, decorative arrows, or loading theatrics. All optional motion must respect `prefers-reduced-motion`.

### Typography System
`DM Serif Display` provides the restaurant-facing display voice in short, carefully set headlines. `Manrope` handles menu names, forms, prices, and status information for compact mobile readability. Headings use moderate line height and avoid all-caps body copy; labels may use tracked uppercase sparingly for status and receipt metadata.

### Brand Essence
**A mobile-first ordering desk for THE HAROLD'S PLACE, built for guests who need a quick, clear path from menu to confirmed order while staff retain control over the live menu.**

Personality: **assured, warm, precise**.

### Brand Voice
Headlines are compact and service-oriented; CTAs are direct and explain the next action. Avoid promotional superlatives, invented claims, and generic account language.

> “Choose what you need. We’ll keep the order clear.”

> “Menu details are being confirmed by the restaurant.”

### Wordmark & Logo
Use a compact bespoke monogram built from two offset doorway arches: a simple **H / P** suggestion formed by negative space, not a default text glyph. Pair it with the restaurant name in a small, tracked wordmark. The mark is explicitly temporary and replaceable with owner-approved brand files.

### Signature Brand Color
**Harold Maroon — `#6F2028`**. This is used for primary action, key navigation state, and the temporary monogram only.

## Implementation guardrails

No real menu items, prices, delivery fees, operating hours, ratings, reviews, testimonials, customer metrics, or payment success states will be invented. The product will use clear configurable/empty states until confirmed restaurant data is supplied through the connected staff system.

## Style Decisions

- The receipt/ledger system is mandatory on every route: service facts, setup steps, cart totals, and menu states use ruled separators, tabular alignment, and restrained Harold Maroon markers.
- Empty states must still read as an operational ordering desk through menu-list scaffolding, service-status language, and configuration logic rather than generic blank cards.
- Harold Maroon `#6F2028` remains the sole dominant accent for primary actions, active status/navigation, and the temporary HP arch monogram.
