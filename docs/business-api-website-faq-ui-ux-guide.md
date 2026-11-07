# Design handoff: a beautiful, playful Fondeka API FAQ

For the team building the public website page from [the 120-question API FAQ](business-api-website-faq.en.md).

Build an approachable learning hub: visitors can get a direct answer immediately, or follow a short optional path to understand how Fondeka payments work. Give the page the care of a product interface, with readable content, distinctive topic cards, clear controls and small rewards for exploration.

This handoff adapts patterns already used in the Business portal. The proposed search, FAQ journeys, quizzes and badges are website additions to implement; they are not claims about features already available in the portal or backend.

## 1. The experience to aim for

**Visual direction:** a light, spacious canvas; white cards; Fondeka green; restrained violet, blue, amber and teal topic accents; clear typography; soft shadows; and one useful illustration.

**Emotional direction:** “I can understand this and build something.” A student or first-time founder should feel welcome. An experienced developer should reach a specific answer without going through an introduction.

The page should help visitors answer three questions quickly:

1. Is this API suitable for my project?
2. What will access and actual payments cost?
3. How can I test, then prepare for Live?

Make the first screen useful before the visitor clicks anything. Explain the audience and the four payment flows briefly, expose search, and offer clear next steps.

## 2. What to carry over from the portal

| Existing portal pattern                                       | Adaptation for the FAQ                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Strong heading with an icon tile and a short explanation      | A welcoming hero with a specific promise and a small developer illustration.                     |
| Neutral layered cards with fine borders and soft depth        | Readable answer surfaces, topic cards and a clearly framed learning path.                        |
| Different accent colors for API topics                        | Colored topic icons and selected states, while most content stays neutral.                       |
| Numbered steps and explicit reviewed markers                  | An optional six-chapter introduction with progress based on deliberate actions.                  |
| Clear parent navigation, lighter children and framed chevrons | Recognizable topic groups and question accordions with generous click targets.                   |
| Progressive disclosure                                        | A short orientation first; detailed answers, examples and technical links available on demand.   |
| English/French support and comfortable mobile controls        | Equivalent content, flexible layouts and readable text in each language.                         |
| Full-height API Guides navigation                             | The FAQ menu and white content area expand to fit their content and use ordinary page scrolling. |

The broader reference is [Fondeka frontend design and UX guide](fondeka-frontend-design-and-ux-guide.md). Use the website's existing framework, header, footer, typography and theme infrastructure to apply these ideas.

## 3. Recommended page structure

Use one public page with two equally valid ways to explore it: **find an answer** and **follow the introduction**.

Recommended order:

1. Website header and language control.
2. Hero: title, audience, short description and a modest illustration.
3. Prominent question search with example searches.
4. Three intent cards: “Explore the API,” “Understand the costs,” “Solve a problem.”
5. Optional six-chapter learning path, presented as a compact card or expandable panel.
6. Main FAQ area: topic navigation beside the answers on desktop.
7. Related questions and helpful actions beside or after an open answer.
8. A support card and a clear portal/documentation handoff.
9. Review date and the normal website footer.

Keep the hero short enough that search and the first useful choices appear on an ordinary laptop screen. Let the page grow naturally as answers open.

### Desktop composition

```text
Website header                                      EN / FR

API questions? Start here.                 small developer
For students, freelancers and             illustration
businesses building their next idea.

[ Search fees, countries, Sandbox, company documents…     ]
Try: “5% fees”  “No company documents”  “Sandbox vs Live”

[ Explore the API ] [ Understand the costs ] [ Solve a problem ]

[ Your introduction · 2 of 6 chapters reviewed · Continue → ]

┌──────────────────────┬────────────────────────────────────┐
│ Explore by topic     │ Fees and pricing                   │
│                      │ Understand access and operation    │
│ About the API        │ charges before you build.          │
│ Coverage             │                                    │
│ Access & benefits    │ [ What is the average fee?       ∨ ]
│ Fees & pricing       │   Answer + 3% + 2% illustration    │
│ Sandbox & Live       │   “Average; actual fees vary…”     │
│ Setup & keys         │   [Copy link] [Mark reviewed]      │
│ Collections          │                                    │
│ Payouts              │ [ Who pays the fee?              > ]
│ Wallets              │ [ Are payouts priced the same?   > ]
│ Status & webhooks    │                                    │
│ Security             │ [Optional: Check your knowledge]   │
│ Growing your business│                                    │
│ Help                 │ Related questions / next topic     │
└──────────────────────┴────────────────────────────────────┘

[ Still have a question? Contact support. ] [ Open Business portal → ]
```

The progress example is illustrative. A new visitor starts with no reviewed chapters; never seed artificial progress.

### Mobile composition

```text
Fondeka                                        EN / FR

API questions? Start here.
Short description.
[ Search a question…                              ]

[ Explore ] [ Costs ] [ Help ]
[ Optional introduction · Continue →              ]

Topic
[ Fees and pricing                             ∨ ]

Fees and pricing
[ What is the average fee?                      ∨ ]
  Full answer, readable example and explanation.
  [Copy link] [Mark reviewed]

[ Who pays the fee?                             > ]
[ Check your knowledge · Optional                 ]

[ Need help? Contact support.                     ]
```

Use a topic selector or an inline expandable topic list on mobile. Keep primary actions in the page flow. If the website has a fixed header or bottom bar, allow enough space that it cannot cover answers, focus or the last action.

## 4. Visual tokens and spacing

The light values below come from the portal. Map them to the website's semantic tokens instead of introducing a second global theme.

| Role                 | Reference value       | Use                                          |
| -------------------- | --------------------- | -------------------------------------------- |
| Page background      | `#F4F7FB`             | Cool, quiet canvas.                          |
| Main surface         | `#FFFFFF`             | Answers and primary cards.                   |
| Raised surface       | `#F8FAFD`             | Examples, secondary panels and code support. |
| Hover surface        | `#EEF3F9`             | Subtle interaction feedback.                 |
| Main text            | `#142337`             | Titles and question labels.                  |
| Secondary text       | `#425770`             | Answer text and explanations.                |
| Muted text           | `#596E87`             | Counts, review dates and secondary metadata. |
| Border               | `#DCE4EF`             | Card boundaries and separators.              |
| Brand green          | `#267C55`             | Main actions and selection.                  |
| Green surface        | `#E5F4EC`             | Selected cards and small progress areas.     |
| Blue / soft blue     | `#446AC6` / `#E8EFFF` | Technical setup and context.                 |
| Violet / soft violet | `#7953B5` / `#F0EAFA` | Learning and exploration.                    |
| Amber / soft amber   | `#9A641D` / `#FFF4DF` | Sandbox identity and useful cautions.        |
| Teal / soft teal     | `#087E8B` / `#E5F5F7` | Payment methods and outgoing flows.          |
| Rose / soft rose     | `#B34474` / `#FCEBF3` | Getting-started identity.                    |

Use dark-theme equivalents from the shared guide if the website already offers dark mode. In particular, the portal uses `#090E18` for the dark canvas, `#111A29` for main surfaces, `#EDF2FA` for primary text and `#67DDA6` for the brand accent. Preserve the website's existing theme preference.

### Measurements

| Element                      | Starting point                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Desktop content width        | Approximately 1120–1200px, with comfortable outer margins.                       |
| Desktop topic column         | Approximately 230–260px.                                                         |
| Gap between columns          | 24–32px.                                                                         |
| Reading width inside answers | Approximately 65–75 characters per line.                                         |
| Hero title                   | Approximately 36–48px on desktop, 28–34px on mobile; scale with available space. |
| Category title               | 24–28px.                                                                         |
| Question heading             | 16–18px, medium or semibold, with room to wrap.                                  |
| Answer text                  | 16px or equivalent `rem` size, line height around 1.7–1.85.                      |
| Input text                   | At least 16px.                                                                   |
| Secondary metadata           | Approximately 13–14px.                                                           |
| Standard card corners        | 13–18px.                                                                         |
| Larger welcome/path card     | Approximately 20–24px corners.                                                   |
| Card padding                 | 24–28px desktop, 18–20px mobile.                                                 |
| Spacing scale                | 4, 8, 12, 16, 24, 32 and 48px.                                                   |
| Primary touch targets        | Aim for at least 44×44px.                                                        |

Use the website's readable font family. The portal uses Geist Sans for interface text and Geist Mono for code. Keep code typography for technical values, not long explanations.

Suggested surface depth:

```css
/* Scope these through the website's existing FAQ/theme system. */
.api-faq {
  --faq-shadow: 0 1px 3px #182e4c06, 0 5px 16px #182e4c06;
  --faq-shadow-hover: 0 3px 6px #182e4c08, 0 12px 28px #182e4c0d;
}
```

Keep most answer backgrounds white or neutral. Concentrate color in icon tiles, selected states, chapter markers and small educational callouts. This gives the page personality without making 120 questions compete for attention.

## 5. Hero and intent cards

Suggested hero copy:

> **API questions? Start here.**
>
> Understand access, fees and your first payment. Built for students, freelancers, small businesses and startups still preparing their company documents.

Use a small illustration of people building software or connecting payment flows. The portal's [developer illustration](../public/illustrations/api-developer.svg) is a possible reference; keep its [source/license notes](../public/illustrations/README.md) with any reused asset. Prefer approved brand artwork and one consistent icon family; the portal uses Lucide.

Intent-card behavior:

| Card                 | Supporting copy                              | Action                                                           |
| -------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| Explore the API      | “See if Fondeka fits your project.”          | Opens the audience/overview topic or optional introduction.      |
| Understand the costs | “Access price, operation fees and who pays.” | Opens Fees, with links to Access pricing and the 5% explanation. |
| Solve a problem      | “Find help with access, payments or keys.”   | Opens Common problems and places search within easy reach.       |

Make the entire card one clearly labeled action. Use a soft icon tile, a strong title, one short line and a directional cue. Hover can increase border contrast or shadow slightly; keyboard focus must be equally clear.

## 6. Organize the full FAQ into recognizable topics

Keep the complete approved answers. A shorter display label can help navigation without changing the meaning of an answer.

| Website label             | Source questions | Suggested icon  | Accent      |
| ------------------------- | ---------------- | --------------- | ----------- |
| About the API             | 1–10             | `Compass`       | Blue        |
| Countries & currencies    | 11–19            | `Globe2`        | Teal        |
| Access & benefits         | 20–34            | `KeyRound`      | Violet      |
| Fees & pricing            | 35–47            | `Calculator`    | Brand green |
| Sandbox & Live            | 48–60            | `FlaskConical`  | Amber       |
| Setup & API keys          | 61–71            | `Code2`         | Blue        |
| Collect payments          | 72–79            | `ArrowDownLeft` | Brand green |
| Send payouts              | 80–86            | `ArrowUpRight`  | Teal        |
| Wallets & settlement      | 87–92            | `WalletCards`   | Violet      |
| Status & webhooks         | 93–100           | `Webhook`       | Blue        |
| Security & verification   | 101–105          | `ShieldCheck`   | Brand green |
| Growing your business     | 106–109          | `Sprout`        | Rose        |
| Common problems & support | 110–120          | `LifeBuoy`      | Amber       |

Keep the glossary reachable through a quiet “Explain a term” link or a final section. The 13 topics cover all 120 questions; the glossary is supporting content.

On desktop, give parent/topic rows a clear icon frame, label and selected state. Use a modest count such as “13 questions,” not a large progress score. A topic's identity color should not imply that a payment has succeeded or failed.

## 7. Preserve the full-height menu improvement

This is an explicit requirement from the portal work: visitors must be able to reach the bottom of the topic list without discovering a second vertical scrollbar.

- Let the navigation and white container grow with their contents.
- Use normal page scrolling for the main experience.
- Keep long answers at their natural height once expanded.
- Avoid a fixed viewport-height content frame, capped answer panel or scrolling FAQ menu.
- Use top alignment for grid columns so a short answer does not stretch its inner controls.
- At narrower widths, move to the mobile topic control instead of squeezing both columns.

Reference behavior:

```css
.api-faq-layout {
  display: grid;
  grid-template-columns: minmax(230px, 260px) minmax(0, 1fr);
  align-items: start;
  gap: 28px;
}

.api-faq-topics,
.api-faq-content,
.api-faq-answer {
  min-width: 0;
  height: auto;
  max-height: none;
}

.api-faq-topics,
.api-faq-answer {
  overflow: visible;
}

@media (max-width: 960px) {
  .api-faq-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

Treat these selectors as illustrative, scoped guidance. Use the website's actual components and breakpoints. A code example or genuinely wide table may need its own horizontal handling; the question menu and answer body should not become vertical scroll panes.

## 8. Search should be the quickest path to an answer

Use a visible label, such as “Search API questions,” and a helpful placeholder, such as “Fees, countries, Sandbox, company documents…”. Put a clear action inside or beside the input after the visitor has typed.

Search all approved question titles and answer text, with title matches prioritized. Add curated aliases for common language:

| Search terms                                     | Relevant topic/answers                          |
| ------------------------------------------------ | ----------------------------------------------- |
| `5%`, `3%`, `2%`, charges, commission            | Fees, questions 35–47.                          |
| paperwork, company papers, no documents, student | Audience/verification, especially 2, 3 and 101. |
| Congo, DRC, RDC, Congo-Brazza                    | Coverage, especially 11 and 12.                 |
| test money, fake money, sandbox                  | Sandbox, especially 48, 50 and 53.              |
| production, real payments, live disabled         | Live, especially 49, 59 and 111.                |
| paid but locked, activation, access payment      | Access and help, especially 30 and 110.         |
| pending, stuck, timeout, duplicate               | Status/recovery, especially 93, 99 and 100.     |
| callback, notification, signature                | Webhooks/security, especially 66 and 96–98.     |

Preserve accents and original wording when displaying results. Matching can be accent-insensitive and case-insensitive. Use the appropriate language's content and aliases after translation.

Each result should show its category, question and a short relevant excerpt. Selecting it opens the complete answer, with the matching text easy to locate. Keep tables and important qualifications in the full answer.

Design four states: empty query, matching results, no matches and cleared search. “No matches” should offer alternate terms, topic browsing and support. Announce updated result counts without moving focus away from the input. Search and clearing search should preserve useful context rather than resetting reading progress.

## 9. Question and answer component

Each question should feel like a deliberate control:

- A full-width header row with a wrapping question label and framed chevron.
- A fine border and restrained elevation or background change for an open answer.
- A readable answer area with generous paragraph spacing.
- Existing lists, tables and inline technical terms rendered safely.
- A small “Copy link” action outside the accordion's toggle button.
- An optional “Mark reviewed” control, with a clear reviewed state and undo.
- Two or three manually chosen related questions where useful.

Allow more than one answer to remain open so visitors can compare fees, modes and environments. Do not close an answer merely because another is opened. A direct link must open its question and reveal its category before moving it into view.

Use stable, descriptive IDs such as `api-consolidated-fees` or `api-live-availability`. Keep one canonical instance of each answer. Featured cards and search results should link to that instance rather than render inconsistent copies with duplicate IDs.

Retain ordinary paragraph text for long answers. Use code styling for values such as `ACCEPTED`, `X-API-Key` and `EXCLUSIVE`, while explaining them in plain language.

## 10. A six-chapter introduction that feels rewarding

Offer “New to payment APIs? Follow the introduction.” The complete FAQ stays available throughout. A visitor can start anywhere, skip a chapter or stop and return.

The proposed path selects 21 essential answers from the full source:

| Chapter                 | Visitor goal                                           | Source questions   | Completion cue               |
| ----------------------- | ------------------------------------------------------ | ------------------ | ---------------------------- |
| 1. Find your fit        | Understand the audience and company-document context.  | 2, 3               | “Audience reviewed”          |
| 2. Understand the costs | Separate access, transaction fees and fee modes.       | 20, 21, 35, 36, 42 | “Costs reviewed”             |
| 3. Check your coverage  | Understand country and route availability.             | 11, 13, 14         | “Coverage reviewed”          |
| 4. Know your setup      | Learn the first steps and the two secrets.             | 62, 65, 66         | “Setup reviewed”             |
| 5. Explore Sandbox      | Understand virtual funds and testing limits.           | 48, 53, 55, 58     | “Sandbox reviewed”           |
| 6. Prepare for Live     | Distinguish readiness, confirmation and safe recovery. | 59, 60, 79, 100    | “Live requirements reviewed” |

Show six numbered markers, a small progress indicator and the next useful chapter. On mobile, use a vertical path or compact current-chapter card rather than six cramped tiles.

Progress rules:

1. A visitor explicitly marks a chapter reviewed; opening it or scrolling past it does not complete it.
2. The progress count is the number of distinct reviewed chapters out of six.
3. Reviewed questions and reviewed chapters are related but distinct records. Marking one answer must not complete an entire chapter automatically.
4. Provide “Mark not reviewed” and “Reset my progress.”
5. Explain that progress records personal exploration on this device/browser, according to the storage behavior implemented.
6. Labels such as “Live requirements reviewed” describe reading only. They never mean that an account is verified, approved or enabled for real payments.

The portal's current guide progress is explicit and stored in account-scoped session storage. For the public website, a session-only version can work without login. If persistent local progress is added, label it clearly, handle unavailable storage and provide a reset action. Cross-device progress requires a separately designed account feature.

## 11. Add optional knowledge checks

Place a short “Check your understanding” card after an educational chapter. Use a compact radio-card question with **Check answer**, explanatory feedback and **Skip**. A visitor can read the explanation or go back to the source answer without completing the quiz.

Suggested checks:

### Check A: one consolidated fee

**Question:** “When the average aggregator fee is 3% and Fondeka's average fee is 2%, what does the approximately 5% mean?”

- Correct: “One combined operation fee; actual operator pricing can vary.”
- Alternative: “An extra 5% on top of both other charges.”
- Alternative: “The price of API access.”

**Feedback:** “Yes. The average components combine into one approximately 5% operation fee. Your actual route's pricing can be different.” Link to questions 35–38.

### Check B: accepted is not completed

**Question:** “Your server receives HTTP 202. Can you mark the customer's order paid?”

- Correct: “Wait for verified completion and check the settled amount.”
- Alternative: “Yes, 202 confirms that the customer paid.”
- Alternative: “Create another payment to be sure.”

**Feedback:** “The request has been accepted for processing. Save its reference and follow the final result.” Link to questions 79, 93 and 94.

### Check C: virtual money

**Question:** “A Sandbox top-up adds 100 USD. What happens to the real wallet?”

- Correct: “Nothing. The balance is virtual and separate.”
- Alternative: “The real wallet receives 100 USD.”
- Alternative: “It can now fund a Live payout.”

**Feedback:** “Sandbox funds are for testing. They cannot be withdrawn or used for Live payments.” Link to questions 50, 53 and 91.

### Check D: Live readiness

**Question:** “You paid for access and generated a Live key. Are all real payments automatically enabled?”

- Correct: “Live availability, account requirements and supported routes still apply.”
- Alternative: “Yes, the key removes every other requirement.”
- Alternative: “Passing this quiz enables the account.”

**Feedback:** “API access, a credential and permission to accept new Live payments are separate checks.” Link to questions 59 and 60.

For an incorrect answer, explain the distinction and offer another try. Keep the wording respectful. Store distinct passed check IDs if awarding a learning badge; repeated clicks should not add duplicate progress.

## 12. Badges and small rewards

Use a few restrained achievements with explicit conditions:

| Badge/cue                | Earned by                                | Meaning                                                   |
| ------------------------ | ---------------------------------------- | --------------------------------------------------------- |
| “First topic explored”   | Explicitly marking one chapter reviewed. | One reading milestone.                                    |
| “Fee basics checked”     | Correctly answering Check A.             | The visitor answered that educational question correctly. |
| “Payment states checked” | Correctly answering Check B.             | The visitor recognized acceptance versus completion.      |
| “Sandbox basics checked” | Correctly answering Check C.             | The visitor recognized virtual funds.                     |
| “Introduction reviewed”  | Marking all six chapters reviewed.       | The optional reading path is complete.                    |

A small checkmark, an icon tile changing state and a short status message are enough to make progress feel good. Keep achievements private to the visitor's learning experience. Reading badges do not imply developer certification, financial approval or access rights.

Do not give points for paying, generating keys, submitting payouts, contacting support repeatedly or returning every day. Learning rewards should support understanding rather than increase financial activity.

## 13. Make the important explanations visual

### Fee breakdown

Use three connected blocks with large readable numbers:

```text
Aggregator average       Fondeka average        Consolidated average
      ≈ 3%        +            ≈ 2%        =             ≈ 5%

One operation fee. Actual fees vary by operator and route.
```

Keep “average” and the variability explanation beside the numbers on every screen size. The components explain the commercial model; do not suggest the API response exposes a separate fee breakdown.

Show the source's EXCLUSIVE/INCLUSIVE comparison as two simple example cards or a responsive table. Keep the assumption “the returned fee is 5 USD” attached to the example. If using a toggle, switch between these approved examples rather than creating an apparent Live quote calculator.

### Sandbox versus Live

Use two comparison cards. Amber identifies **Sandbox · virtual money**. Green identifies **Live · real money**. Always retain the words; color alone is insufficient. A green Live card describes an environment, not the visitor's approval status.

The public comparison control changes educational content only. It must not switch a signed-in account's environment, create a credential or initiate any payment.

### Payment lifecycle

Use a compact sequence:

```text
ACCEPTED → PROCESSING → COMPLETED or FAILED
```

Pair each state with a short explanation from questions 93–100. Make clear that processing can remain unresolved. An animation must not suggest that every real payment completes within the time taken by the illustration.

### Country coverage

Use the 12-country table as the accessible source of truth. Optional country chips or an illustrative map can make the section welcoming. The map must not imply that every operator or payment direction is available across an entire region. Keep the route-availability explanation visible and provide the full names and currency codes in text.

## 14. Motion and interaction polish

Use short, restrained transitions, around 150–250ms, for chevrons, focus/hover surfaces and learning-state feedback. Reserve a small checkmark animation for an explicit educational completion action.

Answers should remain at their intrinsic height. It is fine for expansion to be immediate while the chevron rotates; fixed-height animation tricks must not clip a long answer or its table. Avoid automatic carousels and moving controls that make the text harder to read.

Respect `prefers-reduced-motion`. In that mode, state changes should remain clear without movement. No persistent floating animation is needed behind the content.

## 15. Mobile, translation and long answers

- Stack the main columns around the point where the reading area becomes cramped; the portal uses a 960px breakpoint for its guide layout.
- Keep the search field and question labels comfortable at approximately 390px width, and test narrower reflow as well.
- Let French labels wrap without shrinking body text or cutting off actions.
- Keep the same question IDs, meaning and capabilities across languages. Translate questions, answers, search aliases, quiz feedback and accessible labels.
- Preserve the selected question or chapter when switching language if its translation exists. If it does not, explain the fallback rather than silently showing a different answer.
- Reflow fee and coverage tables into labeled cards on narrow screens, or provide clearly signaled horizontal table scrolling when needed. Never discard a column or the pricing assumptions.
- Allow more than one answer to stay open on mobile. A compact table of contents can help visitors return to a topic.
- Show “Back to topics” or a quiet back-to-top control after substantial content, without covering the answer.

The actual website header/footer should remain recognizable. Adapt the portal's visual language rather than copying its authenticated sidebar or app bottom navigation onto the public site.

## 16. Accessibility requirements

Use semantic headings, labeled controls, visible focus and full keyboard access. Aim for WCAG 2.2 AA; check text contrast, reflow, focus visibility and unobscured controls. Use 44px touch targets as the design default. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

For a custom accordion, place the toggle button inside its heading, maintain `aria-expanded` and `aria-controls`, and support Enter/Space and normal Tab navigation. Avoid giving 120 panels separate landmark regions. Native disclosure elements are another implementation option. [WAI accordion pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/)

Keep copy-link and review controls outside the toggle. Announce search counts and quiz feedback politely. Preserve focus after resets and direct navigation. Supply text progress alongside graphics, label quiz choices, and ensure information survives reduced motion, zoom and color changes. Review automated findings with keyboard and screen-reader checks.

## 17. Content, URLs and rendering

Use [the FAQ Markdown](business-api-website-faq.en.md) as the editorial source. Parse it into stable topic/question records, or use the website's existing content system. Preserve the complete approved answer, tables, links, important qualifications and review date.

Suggested record shape:

```json
{
  "id": "api-consolidated-fees",
  "categoryId": "fees",
  "sourceQuestionNumber": 35,
  "title": "What is Fondeka's average fee per operation?",
  "answerMarkdown": "Approved answer from the FAQ source",
  "searchAliases": ["5%", "charges", "commission"],
  "relatedQuestionIds": ["api-fee-components", "api-fee-details"]
}
```

The IDs above illustrate the schema; create the complete actual ID map during implementation. Display order and translated wording may change without changing an established question's URL identity.

Give questions shareable URLs on the site's actual FAQ route. A proposed route is `/business/faq`; it is not a claim that this route already exists. A link to a question should load or reveal the correct category, expand the answer and scroll with an offset for the site header. Preserve meaningful Back behavior without adding a browser-history entry for every hover or review toggle.

Render the approved content into accessible HTML rather than loading the entire FAQ only after a client-side search. Provide a readable fallback if JavaScript or storage is unavailable. Keep featured questions, search results and journeys linked to the canonical answer so copy cannot drift between representations.

## 18. Keep learning state separate from account and payment state

The first version can run entirely with public content and local UI state. Reading a question or answering a quiz does not need a payment API call or account login.

For optional persisted learning state, use a versioned record containing only chapter/question/check IDs, such as:

```json
{
  "contentVersion": "2026-11-03",
  "reviewedChapterIds": ["fit", "costs"],
  "reviewedQuestionIds": ["api-consolidated-fees"],
  "passedCheckIds": ["fee-basics"]
}
```

Handle missing, invalid or unavailable storage gracefully. Deduplicate IDs, ignore unknown IDs and migrate/reset progress intentionally if the learning content changes. A reset should clear these records without changing the visitor's theme, language or real account state.

Do not collect credentials, payment references or personal financial information in an FAQ quiz. If analytics are used, track question/category IDs and coarse interactions through the site's existing policy. Avoid recording raw search text, which a visitor could accidentally fill with sensitive information.

## 19. Calls to action and helpful states

Use specific, useful actions:

| Context                                           | Primary next step                  | Secondary option                                                   |
| ------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| Visitor understands the service                   | “Open Business portal”             | “Read the API guides”                                              |
| Visitor is reviewing fees                         | “See how fees work” within the FAQ | “Check current details after access” with an honest portal handoff |
| Visitor completed the introduction                | “Explore the API guides”           | “Review a chapter”                                                 |
| Visitor has a specialized route/document question | “Ask support about my project”     | Return to the relevant topic                                       |
| Search has no results                             | “Browse topics”                    | “Contact support”                                                  |

Keep a clear distinction between learning about activation and actually buying access. A badge, quiz result or comparison card must never submit an activation purchase. The portal remains responsible for its actual offers, access checks, quotes and payment confirmation.

Helpful states to design include:

- New visitor with no progress.
- Returning visitor with valid local progress.
- Search results and no matches.
- A direct question link, including a missing/retired question.
- An answer with a long table, technical value or several links.
- A chapter reviewed, unreviewed or reset.
- A quiz before submission, correct answer, incorrect answer and skipped state.
- Storage unavailable and JavaScript unavailable.
- A requested translation unavailable.
- A support/portal link opening a separate product context.

## 20. Suggested delivery order

### First: a polished, complete FAQ

Deliver the approved content, strong hero, search, 13 topics, accessible accordions, stable answer links, responsive tables, related questions, support and portal CTAs. Apply tokens and verify the full-height page/menu behavior.

### Then: the guided learning layer

Add the six-chapter path, explicit review controls, session/local progress with reset, and a modest completion cue. Test direct browsing and search independently of the path.

### Then: optional knowledge checks

Add the four curated checks and truthful badges. Provide helpful feedback, keyboard support and a way to skip. These additions should make the same information more memorable without slowing visitors who already know what they need.

## 21. Review before handoff

- [ ] All 120 approved questions are represented once, with the glossary accessible.
- [ ] Search finds fees, documents, coverage, Sandbox, Live and pending-payment questions through common terms.
- [ ] Direct links reveal the correct full answer; Back and language switching preserve context.
- [ ] The whole topic menu is reachable through normal page scrolling.
- [ ] Opening a long answer expands the white section without clipping or a second vertical scroll pane.
- [ ] Desktop, approximately 390px mobile, narrow reflow and 200% zoom remain usable.
- [ ] Topic color, icons and chevrons are consistent and do not substitute for labels.
- [ ] The approximate 3% + 2% = 5% explanation retains its average/variability wording.
- [ ] Country coverage is distinct from operator/route availability.
- [ ] Sandbox and Live are labeled with words, and no learning state implies Live approval.
- [ ] Fees, access prices, quote amounts and backend outcomes are not invented by decorative components.
- [ ] Progress changes only after explicit review or the defined quiz action; undo/reset works.
- [ ] All information remains reachable without completing a learning path or quiz.
- [ ] Keyboard, focus, screen-reader feedback, reduced motion and contrast have been checked.
- [ ] Search and learning state do not require secrets or create financial requests.
- [ ] The implementation uses the receiving website's components and preserves its existing navigation and language behavior.

## 22. References for the website team

- [Customer-facing FAQ source](business-api-website-faq.en.md).
- [FAQ publication notes and commercial/technical qualifications](business-api-website-faq-publication-notes.md).
- [Shared Fondeka frontend design and UX guide](fondeka-frontend-design-and-ux-guide.md).
- [Portal theme and guide styles](../src/app/globals.css): semantic tokens, `.guide-learning-layout`, `.guide-path-sidebar`, `.guide-path-nav` and `.guide-menu-group`.
- [Portal guide navigation](../src/components/api-guide-navigation.tsx): topic identity, nested groups and reviewed markers.
- [Portal guide workspace](../src/components/business-api-documentation.tsx): explicit review actions, session progress and focused learning sections.
- [Existing illustration and attribution](../public/illustrations/README.md).
- [WAI accordion pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/) and [WCAG 2.2](https://www.w3.org/TR/WCAG22/) for accessibility implementation and verification.

Prepared 3 November 2026. This document is a design and implementation brief for the public website; the website page itself is not created by this handoff.
