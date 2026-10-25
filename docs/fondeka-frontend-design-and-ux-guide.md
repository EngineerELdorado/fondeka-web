# Fondeka frontend design and UX guide

**A shared direction for frontend projects adopting the Fondeka Business portal’s look and feel.**

Make complex work feel approachable through focused tasks, polished controls, calm surfaces, selective color, and clear progress. The experience should feel like a thoughtfully designed mobile app that also makes good use of a desktop screen.

This guide is portable. Apply it through the receiving project’s framework, component library, and design tokens. It does not require Next.js, React, a new backend, or a rewrite of existing services.

## 1. Preserve the product’s core logic

Improve presentation and interaction while retaining the existing business rules and contracts.

| Area           | Preserve                                                                | Presentation improvements                                         |
| -------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| APIs           | Endpoints, methods, payloads, required headers, response handling       | Clear request states, field explanations, local errors            |
| Business rules | Eligibility, permissions, pricing, validation, lifecycle restrictions   | Explain availability and guide the customer through valid choices |
| Transactions   | Quotes, confirmation requirements, idempotency, reconciliation, refunds | Readable totals, review cards, processing and recovery states     |
| Authentication | Login method, device approval, session and security policies            | A polished sign-in card and understandable progress               |
| Navigation     | Required destinations, return context, deep links                       | Clear hierarchy, useful grouping, consistent Back behavior        |
| Data           | Source values, identifiers, media order, privacy boundaries             | Localized labels, formatting, previews and appropriate truncation |

A visual redesign must not change a backend enum, invent a capability, bypass authorization, issue a new mutation on step navigation, or report an unconfirmed action as successful. Identify existing behavior before changing a screen, then verify that the same customer intent produces the same backend operation.

If a proposed UX needs a business-rule or API change, describe that dependency separately. Keep it outside the presentation change until it is explicitly agreed.

## 2. The character of the interface

Use these principles together:

1. **Focused:** one dominant task or decision at a time.
2. **Premium:** careful spacing, strong typography, precise alignment and subtle depth.
3. **Friendly:** useful icons, clear explanations, approachable language and welcoming empty states.
4. **Lightly playful:** numbered paths, expressive icon tiles and meaningful completion feedback.
5. **Calm:** neutral content surfaces with color concentrated on navigation, identity and important states.
6. **Familiar:** the same controls, vocabulary and decision sequence across devices.
7. **Responsive:** preserve the customer’s context and keep the current screen usable during asynchronous work.
8. **Truthful:** progress, availability, amounts and statuses come from the actual workflow.

A useful page hierarchy is:

```text
Identity          icon or small illustration + clear title
Orientation       one short sentence, only when useful
Primary action    a specific action in a predictable position
Main content      focused card, purposeful collection or working area
Context           secondary information revealed when relevant
Feedback          loading, errors, progress and confirmation near the action
```

## 3. Forms: a core design requirement

**Creation, onboarding, configuration with many decisions, and financially meaningful actions should use progressive steps. Do not open them as a long form showing every available field.**

Grouping the same long form into one oversized card does not satisfy this principle. Each step should answer one clear question. Two or three tightly related fields can belong together when they form the same decision.

### The standard form experience

Every substantial guided form should have:

- A clear task title, such as **Create a store**.
- A localized **Step X of Y** label and a visible progress bar.
- One focused card containing the current decision.
- A useful step heading, persistent field labels and short helper text.
- Inline validation for the current step after the customer tries to continue.
- Stable **Back** and **Next** actions.
- A concise review with small **Edit** actions for the corresponding steps.
- A specific final CTA, such as **Create store**, **Invite member** or **Save configuration**.
- A success state that opens the created object or offers the most useful next action.

Example:

```text
Create a store                              Step 2 of 3
[Back]             ━━━━━━━━━━━━━━━━━━━──────────────

        ┌────────────────────────────────────────┐
        │ What does your business offer?         │
        │ Help customers understand your store.  │
        │                                        │
        │ Business description                   │
        │ ┌────────────────────────────────────┐ │
        │ │                                    │ │
        │ │                                    │ │
        │ └────────────────────────────────────┘ │
        └────────────────────────────────────────┘

                              [Back] [Next →]
```

### Decide the steps before styling them

| Task                     | Useful sequence                                                                |
| ------------------------ | ------------------------------------------------------------------------------ |
| Create a store           | Name → Description → Review                                                    |
| Add a product            | Name → Price → Media → Description → Type → Relevant details → Preview         |
| Invite a colleague       | Identity → Permissions → Review                                                |
| Configure an integration | Name → Connection details → Review                                             |
| Make a payment           | Identity/amount → Required details → Method → Quote/review → Confirm → Outcome |

These are examples of grouping. Preserve the receiving product’s actual requirements, supported branches and required server interactions. Where a mobile counterpart exists, match its vocabulary, defaults and sequence.

Branch after the relevant decision. A physical product can reveal stock; a digital product can reveal fulfillment. Keep compatible values when switching branches. Hide unrelated fields and revalidate the newly relevant requirements.

Very small tasks can remain one compact dialog. Editing an existing object can use ordered sections, tabs or accordions so a customer can change one field quickly. Keep one primary Save action and a visible unsaved state. Creation and editing should share the same visual components.

### Design input fields as first-class components

Fields should feel deliberate and comfortable to use:

| Element         | Design and behavior                                                                        |
| --------------- | ------------------------------------------------------------------------------------------ |
| Field group     | Label → control → optional helper or error, with consistent spacing                        |
| Label           | Persistent, readable, descriptive; optional/required state expressed clearly               |
| Text input      | Comfortable height, generous horizontal padding, visible border and subtle surface depth   |
| Focus           | Strong border plus a restrained ring; preserve a visible keyboard focus state              |
| Textarea        | Enough height to write comfortably; multiline Enter remains available                      |
| Amount          | Larger type, explicit currency and stable decimal formatting; keep fees and total distinct |
| Select          | A styled chevron in a small frame; preserve native or equivalent keyboard behavior         |
| Choice cards    | Icon, title, one-line explanation and a real radio/checkbox state                          |
| Phone/email/URL | Appropriate input type, autocomplete and keyboard hints                                    |
| Upload          | Local preview, clear Add/Replace/Remove controls, progress, Cancel and recoverable error   |
| Error           | Message beside its field, associated programmatically; preserve the entered value          |
| Disabled state  | Explain the blocking reason when it is not obvious                                         |

Use approximately **48px** control height in guided tasks, with **12–14px** corners and **16px** input text. Keep small utility controls compact where appropriate. Preserve the same readable input text size on mobile.

Icons inside fields should identify a useful concept. Keep the text and label primary. A small amount of depth can come from a fine border, a soft inset highlight and a focused ring; controls do not need heavy gradients or glowing outlines.

Avoid placeholder-only labels, large grids of unrelated fields, several competing focus colors, and future-step errors appearing before the customer reaches them.

### Navigation, review and submission

- Keep values in flow state while individual step inputs are hidden.
- Back returns to the previous step; Back on the first step returns to the originating context.
- Browser Back/Forward should restore safe step state without repeating a mutation.
- Validate the current step on Next and focus the first invalid field. Revalidate all required values before final confirmation.
- Use local step changes for local decisions. Preserve required backend uploads, quotes, OTP checks or draft operations where the existing protocol needs them.
- Protect final confirmation from duplicate submissions. Show progress in the CTA and prevent conflicting navigation while necessary.
- Keep values after server or network errors. Offer a clear retry using the existing recovery rules.
- Preserve safe drafts when appropriate, scoped to the authenticated account. Keep secrets, payment credentials and uncertain submissions out of persisted drafts.
- Clear drafts after confirmed completion, explicit cancellation or account change.
- Account for sticky headers, action bars and safe areas so titles, progress, focused fields and errors remain visible.

The review is a grouped summary, with prominent amounts and relevant media. It should not become another editable mega-form.

## 4. Give ordinary pages the same care

List, detail, settings and dashboard pages should also have a recognizable composition. A plain title above a wall of identical rectangles loses the character of the product.

### List and dashboard pages

- Begin with an icon tile, strong title and a specific primary action.
- Use a brief description only when it helps someone understand what to do.
- Group related information into cards or sections with clear headings.
- Give values such as balances, counts or totals a clear typographic hierarchy.
- Add breathing room between headings, dividers, filters and the first row of content.
- Keep repeated data cards mostly neutral. Use small identity accents, logos, flags or badges to help scanning.
- Make the card’s main action predictable. Give secondary actions their own accessible controls.
- Use purposeful empty states: a small illustration or icon scene, a clear explanation and the next useful action.

Wallets are a good example: recognizable currency imagery, a prominent balance, restrained environment/status metadata and at most four cards per desktop row. Avoid a bright color stripe across every card.

### Detail and management pages

Use a compact identity area, a stable action row and ordered content sections. Put related link, QR, copy and share actions together. Long descriptions can use a two-line excerpt with **Read more** opening a focused dialog containing the full text.

For owner or operational screens, prioritize management actions. Keep promotional videos and storefront presentation in their appropriate contexts. Public pages can give media more visual priority.

### Operational workspaces

Use desktop space for useful context: a product catalog beside a cart, an editor beside an outline, or a request beside its response. Preserve the logical mobile sequence and readable DOM order.

A product catalog may use a masonry-like grid when media proportions benefit from it. Keep names, prices, quantity states and actions easy to locate. Do not let visual placement scramble keyboard or screen-reader order.

### Navigation and accordions

Make the whole parent row clickable, including its label and icon. Give parent groups a stronger frame, solid icon tile or modest elevation; use lighter treatment for children. Rotate a well-styled chevron to communicate expansion and expose the actual expanded state to assistive technology.

Keep one primary workspace hierarchy. Put shared language/environment controls in the shell rather than repeating switch panels on every page. Show switches only when the underlying product supports meaningful choices.

## 5. Visual foundations

### Reference palette

These values come from the portal’s theme. Adopt the semantic roles; retain another product’s established brand accent when necessary.

| Role            | Light     | Dark      |
| --------------- | --------- | --------- |
| Page background | `#F4F7FB` | `#090E18` |
| Main surface    | `#FFFFFF` | `#111A29` |
| Raised surface  | `#F8FAFD` | `#172235` |
| Hover surface   | `#EEF3F9` | `#1A273A` |
| Primary text    | `#142337` | `#EDF2FA` |
| Secondary text  | `#425770` | `#BDC7D8` |
| Muted text      | `#596E87` | `#8A9BB5` |
| Border          | `#DCE4EF` | `#243147` |
| Brand accent    | `#267C55` | `#67DDA6` |
| Accent surface  | `#E5F4EC` | `#163B2F` |
| Blue            | `#446AC6` | `#91AFFF` |
| Violet          | `#7953B5` | `#BEA4FF` |
| Amber           | `#9A641D` | `#E8BD75` |
| Teal            | `#087E8B` | `#71D5E5` |
| Rose            | `#B34474` | `#F1A0C4` |
| Error           | `#B64D48` | `#F7A69E` |

Assign color deliberately:

- Brand accent: the main action and selected state.
- Secondary colors: section identity, navigation tiles and educational content.
- Semantic colors: actual success, warning and failure states.
- Neutral surfaces: the majority of working content.

Keep section identity distinct from status. A purple section is not a payment outcome. Use text and icons alongside status color. Check contrast in the actual foreground/background combination and in both themes.

### Typography, spacing and shape

The portal uses Geist Sans for interface text and Geist Mono for code. Equivalent readable families are acceptable in another project; preserve the hierarchy and avoid unnecessary font downloads.

| Element                   | Suggested starting point                            |
| ------------------------- | --------------------------------------------------- |
| Page title                | 28–32px, medium/semibold, compact line height       |
| Guided step title         | 22–26px, semibold                                   |
| Section title             | 18–20px, medium/semibold                            |
| Body and helper text      | 16px body, 14–16px helpers, comfortable line height |
| Secondary metadata        | 13–14px                                             |
| Important amount          | 28–36px, semibold, stable number alignment          |
| Spacing scale             | 4, 8, 12, 16, 24, 32, 48px                          |
| Standard card corners     | 13–18px                                             |
| Focused task card corners | 20–24px                                             |
| Standard card padding     | 20–28px; around 32px for desktop guided cards       |

These are adoption defaults, not an instruction to replace every existing measurement. Keep dense tools readable and accommodate translated text without shrinking it excessively.

Design for comfortable reading at **100% browser zoom**. Use relative font tokens based on the browser’s default text size: 16px body and input text, 15–16px primary controls, and 13–14px secondary metadata. Reserve smaller text for decorative artwork. Reflow columns, wrap actions and enlarge controls when space is tight. Verify that the page also remains usable at 200% zoom; avoid using CSS zoom or transforms to compensate for an undersized type scale.

### Surfaces and depth

Build depth with a small set of layers: a cool page background, a distinct card surface, a fine border, a soft shadow and an occasional inset highlight. Reserve stronger elevation for a primary task, parent navigation group, floating control or dialog.

Reference light-theme shadows:

```css
--ui-shadow: 0 1px 3px #182e4c06, 0 5px 16px #182e4c06;
--ui-shadow-hover: 0 3px 6px #182e4c08, 0 12px 28px #182e4c0d;
```

Use subtle gradients in icon tiles, brand panels and selected visual features. Keep data and form surfaces calm. Small decorative dots, orbit lines or layered shapes can add character in a hero or empty state; they should not compete with the task or intercept input.

### Icons and imagery

Use one coherent icon family; the portal uses Lucide. Keep stroke weight and sizing consistent. Useful starting sizes are 16–20px for navigation/actions and 22–28px inside larger identity tiles.

Use opposite directions for related incoming/outgoing actions. Give parent and child navigation different visual weight. Frame dropdown chevrons with a small rounded surface and rotate them on expansion.

Prefer returned provider logos, product images and store branding. Use consistent fallbacks for missing or broken media. Currency flags can help recognition where appropriate; retain the currency code and amount. Avoid autoplay and eager video loading in lists. Product galleries preserve their source image order.

### Themes

Use semantic theme tokens rather than hard-coded light surfaces throughout components. Dark mode should preserve hierarchy through differentiated surfaces, readable text, appropriate borders and restrained shadows.

The portal’s login has a dark brand/story panel on the left and a light, plain sign-in card on the right. Keep the form direct: a heading, labeled inputs, one primary action and a quiet step label. Put language selection in the card header. Use the available viewport height for a taller sign-in card and larger tool illustration. Scale the illustration through full, medium and compact layouts as the viewport gets shorter, keeping sign-in and registration controls within laptop screens. On narrow screens, use a compact brand header above the form. Keep input text readable and allow content to remain reachable when zoom, a keyboard or an unusually small viewport requires scrolling. It does not need a theme switch.

Treat that as a useful authentication recipe. Keep the receiving project’s actual authentication method, branding and required steps.

## 6. Friendly gamification with a purpose

Use small visual rewards for understanding and completing a real task.

| Pattern                  | Good use                                                  |
| ------------------------ | --------------------------------------------------------- |
| Numbered path            | Explain a genuine sequence of decisions                   |
| Progress bar             | Show actual completion or current step                    |
| Completion check         | Mark an action or lesson that was actually completed      |
| Colorful icon tile       | Identify a tool or topic quickly                          |
| Small illustration       | Welcome someone, explain an empty state or orient a guide |
| Optional knowledge check | Help someone confirm understanding in educational content |
| Specific success state   | Confirm the result and offer the next useful action       |

Keep operational and financial work calm. Avoid fabricated points, arbitrary streaks, pressure countdowns, confetti around payments, bouncing controls and automatic task-completion claims. Keep optional exploration separate from actual product permissions or payment state.

A page usually needs one expressive area: its heading, an illustration, a path or a distinctive card. Repeating all of them in every section creates noise.

### Developer guides and technical learning

Use a visual navigation path, short lessons and diagrams where they clarify direction or sequence. Show the concrete endpoint, real request payload, complete relevant response, documented HTTP outcomes and actual error codes. Explain every displayed field, including nested objects, with detail available on demand.

Keep examples specific to the current topic. A mobile-money page should explain the phone field in that context; a crypto-payout page should explain the destination address. Show how the API works without requiring someone to perform an arbitrary real transaction.

Distinguish an outgoing request from an incoming webhook. Distinguish an HTTP request outcome from the business operation’s state. Keep examples aligned with the receiving project’s current contract rather than copying another project’s statuses or payloads.

## 7. The experience should feel fast

Perceived speed is part of the design:

- Bootstrap the session and shared dependencies once at the appropriate shell boundary.
- Reuse safe, account-scoped reads and coalesce concurrent requests.
- Revalidate in the background when safe, keeping useful content visible.
- Invalidate only affected data after a mutation.
- Use a skeleton for an initial dependency load and local progress for an action already in progress.
- Keep input values, filters, pagination, cart contents and the originating context during ordinary navigation.
- Resolve required routing decisions before rendering an unrelated intermediate page.
- Respect confirmed access changes and server denials immediately.

Reuse existing data and authentication infrastructure. Preserve freshness requirements for balances, permissions, paid content and sensitive operations. Keep secrets and short-lived capabilities out of persistent or shared caches.

## 8. Complete the states, copy and accessibility

Design the whole interaction, including initial loading, empty content, focused/selected controls, invalid input, uploading, cancellation, submission, pending outcomes, authorization recovery, errors and success.

Keep feedback near its cause. A failing upload belongs inside its media control. An invalid amount belongs beside the amount field. A list refresh should not erase the surrounding workspace. Explain what happened, what remains intact and what the customer can do next.

Use action-specific language: **Add product**, **Invite member**, **Create API key**, **View store**, **Continue learning**. Helpers should explain why a choice matters. Remove repeated introductory prose, redundant labels and raw implementation details that do not help the customer decide.

Localize visible labels, helpers, errors, accessible names, dates and amounts. Keep backend identifiers and payload values stable. For example, `TRAINING` can display as **Training** or **Formation** while the payload remains unchanged. Respect approved labels that remain untranslated, such as **Business ID**. Verify that French and English have the same functionality and can accommodate different text lengths.

Accessibility is part of every component:

- Persistent labels, correct input types, keyboard operation and visible focus.
- Text indicators alongside progress and status color.
- Focus and announcement of the new step; focus on the first invalid field after validation.
- Proper dialog focus containment, Escape behavior and focus return to the trigger.
- Keyboard-operable navigation, accordions, tabs, media galleries and file controls.
- Touch targets of approximately 44×44px or larger for primary touch interaction.
- Layout that remains usable with zoom, long text, narrow widths and on-screen keyboards.
- Restrained 150–250ms transitions for state changes, with reduced-motion support.
- No accidental financial submission through Enter and no multiline field losing its normal Enter behavior.

## 9. Adopt the system incrementally

1. **Record the existing behavior.** Identify entry points, permissions, required fields, branching, mutations, quotes, outcomes and destinations. Preserve representative successful and failure cases.
2. **Map the design tokens.** Add semantic colors, typography, spacing, borders and elevation through the existing theme system. Scope new styles to avoid unintended global resets.
3. **Build shared primitives.** Start with page headings, surfaces, buttons, input fields, choice cards, badges, chevrons, dialogs and feedback states.
4. **Build one shared flow shell.** Centralize progress, navigation, focus, validation presentation, safe draft lifecycle and submission locking. Features keep ownership of their business fields, validation and payloads.
5. **Apply it to a representative form.** Choose a real flow with branching or review so the pattern is tested beyond a visual mockup.
6. **Apply it to a list and detail page.** Carry the same identity, depth and action hierarchy into everyday views.
7. **Verify the complete experience.** Check desktop and approximately 390px mobile width, both supported languages, themes, keyboard behavior and real asynchronous states.
8. **Roll out by feature.** Keep changes reviewable, compare behavior against the original contract and reuse the shared components on subsequent screens.

Prefer the receiving project’s existing dependencies and infrastructure. Separate any necessary logic fix from a visual change so reviewers can understand both.

## 10. Review checklist

- [ ] Creation and onboarding use focused steps wherever multiple decisions are involved.
- [ ] Each step has a clear question, polished fields, helper text and stable actions.
- [ ] Back preserves values; validation is local and accessible; final confirmation is explicit.
- [ ] Review and success states provide a useful next action.
- [ ] Lists, details, settings and empty states have an intentional visual hierarchy.
- [ ] Primary actions stand out; repeated content stays calm and readable.
- [ ] Color and icons improve recognition without replacing labels or implying false states.
- [ ] Parent navigation, dropdown chevrons and selection states are clear and keyboard accessible.
- [ ] Mobile preserves the decision sequence and remains usable above fixed navigation and keyboards.
- [ ] Loading and errors retain context; progress is local; ordinary navigation avoids unnecessary blocking reloads.
- [ ] Supported languages and themes provide equivalent behavior.
- [ ] Existing API calls, business validation, permissions, payment handling and payload values remain compatible.
- [ ] Sensitive data, private media and one-time secrets retain their existing protection.

## 11. Copyable brief for another frontend team or coding agent

> Adopt the Fondeka Business portal’s visual style and UX principles in this project. Preserve existing APIs, business rules, permissions, authentication, transaction semantics and core workflows.
>
> Make creation and onboarding progressive: one coherent decision per step, a clear title, Step X of Y, progress, a focused card, polished labeled inputs, local validation, stable Back/Next actions, review, a specific final CTA and a useful success destination. Keep values when navigating or recovering from errors. Preserve required server interactions and prevent duplicate submissions.
>
> Give everyday views the same care. Use strong page identity, purposeful cards, clear action rows, readable values, expressive icon tiles, useful empty states and thoughtful media fallbacks. Use layered neutral surfaces, soft borders and shadows, consistent rounded corners and selective color. Make parent navigation and chevrons feel deliberate. Include small, meaningful moments of progress and completion.
>
> Carry the same hierarchy across desktop and mobile. Respect accessibility, localization, reduced motion, data privacy and the existing project’s design infrastructure. Keep ordinary navigation smooth through the established caching and loading model. Use backend-confirmed states and documented examples.
>
> Start with shared tokens and primitives, then redesign one real form plus a list/detail pair. Verify behavior against the original contracts before expanding to other features. Identify any backend or business-rule dependency separately.

## Reference implementation

In the originating `fondeka-web` project, useful implementation references are:

| Concern                                         | Source                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| Theme, typography, depth and responsive recipes | `src/app/globals.css`                                                             |
| Shared headings, badges, dialogs and feedback   | `src/components/ui.tsx`                                                           |
| Progressive form shell                          | `src/components/guided-flow.tsx`                                                  |
| Form branching and review                       | `src/components/product-create-flow.tsx`                                          |
| Authentication composition                      | `src/app/login/page.tsx`, `src/components/login-toolkit.tsx`                      |
| Visual technical guides                         | `src/components/integration-guide.tsx`, `src/components/api-guide-navigation.tsx` |
| Grouped choice tiles and provider identity      | `src/components/payment-method-picker.tsx`                                        |
| Desktop/mobile navigation                       | `src/components/app-shell.tsx`, `src/components/mobile-navigation.tsx`            |
| Inline media progress and recovery              | `src/components/media-upload.tsx`                                                 |

These references illustrate the design. The guide remains usable when shared on its own; another project should adapt the patterns through its own architecture.
