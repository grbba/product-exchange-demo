IATA PSC Panel discussion V1
30–60s opener
“Modern Airline Retailing isn’t just Offers & Orders—it’s a product discipline. Suppose we standardise what a transport product is, how we describe it, and how we exchange it. In that case, dynamic retailing becomes a configuration problem rather than a bespoke IT project. Taxonomy gives us the language; supplier catalogue exchange gives us the pipes.”
“Airlines don’t have a shopping problem; we have a product problem. Today’s products are modelled from operations outward—RBDs, SSRs, and fares—so our systems have to discover value at search time. In modern retailing, we flip it: define products from the customer inward, with a taxonomy and rules that pre-select what’s relevant and producible before pricing. That ‘pre-offer’ discipline is what collapses look-to-book.”
Theme 1 — Product Management in Modern Retailing
Q1. What does “product management” mean for airlines today?
–> today
Today’s products are modelled from operations outward—RBDs, SSRs, and fares—so our systems have to discover value at search time.
–> in the future
A cross-functional lifecycle for defining, governing, and evolving sellable products (transport + services), with explicit attributes, rules, and dependencies. Think catalogue first: clear product definitions, reusable features, and attachable rules that downstream systems can honour consistently.
A retail-first discipline: explicitly define transport and services (features, benefits, terms), govern them, and publish them as a catalogue others can safely assemble into offers. It’s not “manage inventory”; it’s “manage value and eligibility” so channels can sell consistently.
Q2. How is it evolving with Offers & Orders?
We’re moving from fare-centric artefacts to productised building blocks: product definitions → classes → instances generated/synchronised from operational sources (e.g., schedules for Right-to-Fly) and governed by rules. That structure lets Offer systems assemble, personalise, and price without hardwiring logic per channel.
From fare artefacts to productised building blocks. We add a pre-offer Retail Readiness step that filters by intent, rules, and constructibility before asking pricing to compute. Offers become assembly/selection; Orders reference those explicit components end-to-end.
Q3. Why is a structured approach essential for personalisation & dynamic offers?
Because personalisation selects and composes attributes under rules. Suppose seat, bag, lounge, Wi-Fi, etc., are modelled with consistent attributes and dependencies. In that case, dynamic bundles and upsell logic are safe to automate and easy to explain to customers and regulators.
Personalisation chooses among features under rules. Suppose attributes (e.g., seat privacy, bag type, Wi-Fi tier) and constraints (POS, aircraft, time, profile) are explicit. In that case, we can compose dynamic bundles safely and explainably—and we slash noise that kills look-to-book.
Theme 2 — Role of Taxonomy
Q4. Purpose of taxonomy in airline retailing?
A shared vocabulary of concepts (e.g., Mode of Transport, Service Classes, Accessibility) that tags products and features so retailers and suppliers mean the same thing, enabling search, filtering, compatibility checks, and analytics across partners.
A shared language that tags products and features with agreed concepts (e.g., mode, cabin concept, amenities, accessibility). It powers findability, comparability, compatibility checks, and clean analytics across partners.
Q5. How does taxonomy enable configuration?
Features/values are bound to reference systems—often enumerations from the taxonomy—so product variants are configured by tagging rather than custom coding. Example: meal “Allergens” or Wi-Fi “Bandwidth” are values from controlled sets, making rules and UI consistent everywhere.
Features bind to reference systems (often enumerations from the taxonomy). Configuration becomes tagging + rules instead of code changes. New variants = new concepts/values, not new schemas.
Q6. Flexibility/extensibility examples?
Transport add-ons: Checked bag vs. Sport equipment reuse the same modelled restrictions (type/qualifier/value/unit) and differ only by tagged subtype - easy to extend to “Surfboard” without schema changes.
Lounge access: Switch between “Duration” and “TimeRange” models while keeping the same taxonomy links and rules.
Both patterns show how new offers are introduced by adding concepts/values, not replatforming.
Sport equipment bag: reuse “checked bag” with a subtype tag “Surfboard”—eligibility and pricing fences apply instantly.
Lounge access: switch from fixed duration to time-range access by changing the value set; the product and downstream rules remain intact.
Multimodal: Mode is a facet; the same product/rule patterns apply to rail or ferry without model churn.
Theme 3 — Supplier Catalogue Data Exchange
Q7. How does the standard facilitate communication between retailers and suppliers?
By exchanging product definitions/classes/instances, along with rules and transition data, in a consistent structure, each party can ingest, validate, and retail the same product consistently. It reduces mapping spaghetti and preserves meaning end-to-end.
It standardises what we publish: product definitions, features with reference systems, taxonomy tags, and rules/constraints. Retailers ingest a single consistent shape rather than mapping bespoke feeds per supplier.
By providing a living, retail-first catalogue - products, features, T&Cs, media, taxonomy tags, and governing rules - shared as small, effective-dated deltas rather than a “big book.” Retailers ingest a consistent shape; suppliers publish once and stream changes - no operational data in the catalogue.
Q8. What information is exchanged, and why does it matter? ( and not exchanged )
Exchanged: 
Product definitions & versions, feature specs bound to reference systems, taxonomy/tag assignments
Eligibility/combinability/packaging rules, price fences (not prices), distribution/targeting policies
Media, descriptive copy, T&Cs, lifecycle states (create/revise/deprecate), effective dating & idempotency
Not exchanged (ops; resolved at offer time):
No schedules, no flight numbers/leg times, no inventory/availability, no aircraft rotations.
Reason: these change constantly and aren’t retail-friendly. The offer engine resolves the product to an operational instance using airline systems, guided by the product’s capability predicates (e.g., “requires seat power”) and the retailer’s context.
Product attributes & features (with reference systems) / Product definitions/classes, feature specs, media, and T&Cs
Dependencies (e.g., “DependsOn Right-to-Fly on leg/date/cabin”)
Management rules (combination, distribution, bundling, retailing criteria)
Transition/PSS bridging data when needed.
Versioning, effective-dating, and deprecation
This keeps offer construction, servicing, and accounting coherent across systems and removes ambiguity, aligns retail and ops, and gives Offer/Order systems clean inputs.
Q9. How does it support dynamic updates & alignment?
Commercial teams update assortment policies and product/rule tags as deltas; retailers auto-refresh their Retail Readiness index. At search, the engine:
Uses context to select a high-probability retail range (policy + taxonomy), then
joins with operational data internally to instantiate only producible options.
Strategy shifts → configuration deltas; ops variability → handled at offer time, not baked into the catalogue.
Rules and taxonomy tags drive availability/eligibility by context (POS, dates, cabin, aircraft). Retailers pick up changes without bespoke mappings each time. Event-driven updates for changes impacting the retail view of the products feed the catalogue; Retail Readiness re-curates the “retail range” automatically for each context. Commercial strategy shifts (new bundle, new fence) are configuration changes—propagated without channel-specific rebuilds.
Key points
“Catalogue ≠ schedule. The catalogue says what we sell; the offer step decides which flights can deliver it.”
“We publish products, not rotations. Ops are resolved at offer time against the airline’s own sources.”
“Think menu vs. kitchen timetable: the menu is stable and versioned; the kitchen timing changes minute-to-minute.”
Possible challenges:
“Where do constructibility checks happen if schedules aren’t in the catalogue?”
“In the offer engine. Products carry capability predicates (e.g., ‘requires aircraft with power outlets’); at offer time, we match those to current ops. That keeps the catalogue clean and retail-focused while still preventing dead-end offers.”
Theme 4 — Interdependencies Across MAR
Q10. How do standards & taxonomy tie into Offers/Orders?
They give Offer systems stable, machine-readable products and constraints; Orders then reference product instances and terms unambiguously. Without standard product and taxonomy layers, Offers/Orders devolve into free-text and custom rule forks.
They give Offers structured building blocks and guardrails; the pre-offer layer decides relevance/feasibility first, then pricing operates on a small, valid set. Orders then reference those same product components for servicing and settlement—no translation gaps.
Q11. How does product management improve collaboration?
Shared product templates, governed rule sets, and tagged features cut negotiation time and remove ambiguity. Suppliers publish once; retailers commercialise many times with confidence. It also clarifies where ATPCO-style content ends and catalog-native products begin.
A governed, shared catalogue + taxonomy becomes the single source of retail truth. Suppliers “publish once”; retailers “commercialise many times.” Fewer mappings, fewer test cycles, more transparent negotiations (we’re arguing about business rules, not data shapes).
Q12. How does this position airlines for future innovation?
A catalog+taxonomy foundation lets you pilot new services (e.g., micro-bundled Wi-Fi tiers, time-bounded lounge access, sustainability attributes) by configuration. It accelerates A/B tests, supports accessibility/regulatory disclosures, and scales to multimodal transport without schema churn.
They let you innovate through configuration: launch, target, and A/B-test new services by adding concepts/rules, not by rewriting systems. The tagged data improves relevance models. Most importantly, look-to-book improves because you price the right things, not everything.
Soundbites:
“We stop selling inventory in disguise and start selling products on purpose.”
“Retail Readiness is the step before the offer that NDC flows are missing.”
“Price the right things, not everything.”
The BOOK perception
15-second headline (use twice: opener + Theme 3)
“Supplier catalogue ≠ is a PDF we ship. It’s a living product feed. We onboard with a snapshot, then exchange small, frequent deltas across the lifecycle—so a tag tweak or rule change doesn’t trigger a full resend.”
Where to land it in the panel
Opener (1 sentence): “Modern retailing needs a living catalogue -continuous, evented updates -not a quarterly book.”
Theme 3 (Q7–Q9): Emphasise how the exchange works: snapshot for onboarding; then deltas and signals, tied to effective dates.
Theme 4 (Q10–Q12): Link to Offers/Orders: deltas flow into the pre-offer Retail Readiness index, so we price only what’s relevant—this is a big reason L2B improves.
One analogy the room will remember
“It’s Git for products, not a PDF. You clone once; after that, you pull commits—small changes with timestamps, versions, and intent.”
Simple operating model (say it slowly)
Three lanes, not one book:
Snapshot (rare): initial onboarding or re-baseline.
Delta events (routine): create/revise/deprecate / end-of-product definitions, features, rules, and taxonomy tags.
Signals (frequent, lightweight): toggles like temporary availability, embargo windows, promo flags - fast on/off without touching the core definition.
Soundbite: “Little-and-often beats big-and-late.”
What actually changes—and what we send (use as examples)
Taxonomy tag added (e.g., “Seat privacy: High”) → send TagAssignment event with product ID, concept ID, action=ADD, effective_from=… (no full product).
Rule tweak (e.g., lounge access time window) → send RuleRevision event referencing the rule ID and diff; clients re-evaluate eligibility.
Constructibility change (e.g., aircraft swap removes power outlets) → send FeasibilityUpdate for affected legs/dates; Retail Readiness drops invalid combos before pricing.
Price fence change (e.g., POS=DE excluded) → RuleRevision; no media or feature resend.
New service variant (e.g., “Wi-Fi Premium”) → Definition: Create for the new service + its rules; everything else is referenced, not copied.
Panel-friendly phrasing to kill the “big book” myth
“We publish once, then stream changes. Most updates are under 2 KB—think add tag, tweak rule, flip availability.”
“Delta payloads carry version, effective date, and an idempotency key so partners can sync safely.”
“Retailers can subscribe by topic (transport, ancillaries, rules, media, taxonomy bindings) and pull since-watermark—no flood, no guesswork.”
How this helps look-to-book (tie back to pre-offer)
Continuous deltas keep the Retail Readiness index fresh: irrelevant or non-constructible options are filtered before pricing.
Signals (e.g., aircraft feature loss) remove dead ends fast → fewer “price then fail” cycles → fewer calls, better conversion.
Because we’re not re-ingesting a book, latency to relevance drops from days to minutes.