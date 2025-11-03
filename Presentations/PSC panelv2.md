# IATA PSC Panel

## Opener
“Modern Airline Retailing isn’t just Offers & Orders—it’s a **product discipline**. If we standardize *what* a transport product is, *how* we describe it, and *how* we exchange it, then dynamic retailing becomes configuration—not custom IT. **Taxonomy** gives us the language; **supplier catalog exchange** gives us the pipes.

Today, products are modeled from **operations outward** (RBDs, SSRs, fares), so systems try to *discover* value during search. In modern retailing we flip it: define products from the **customer inward**, then run a **pre-offer Retail Readiness** step that filters what’s relevant and buildable **before** pricing. That’s how we improve look-to-book.”

---

## Theme 1 — Product Management in Modern Retailing

**Q1. What does “product management” mean today vs. tomorrow?**  
- **Today (ops-first):** Schedules, booking classes, and codes drive content; value is implicit and discovered late.  
- **Tomorrow (retail-first):** Explicitly define products (transport + services), their **features** and **rules**, publish once in a **catalog**, and let all channels assemble offers consistently. Not “manage inventory,” but “manage value & eligibility.”

**Q2. Evolution with Offers & Orders**  
From fare artifacts to **product building blocks**. Add a **pre-offer** step that filters by intent, rules, and feasibility *before* pricing. Offers assemble selected components; Orders reference those same components end-to-end.

**Q3. Why structure matters for personalization**  
Personalization is **choosing features under rules** (e.g., seat privacy, bag type, Wi-Fi tier). When attributes and constraints are explicit, we compose dynamic bundles safely, explain them clearly, and remove noise that hurts conversion.

---

## Theme 2 — Role of Taxonomy (the common language)

**Q4. Purpose**  
A shared vocabulary (mode, cabin concept, amenities, accessibility, etc.) so everyone describes products the same way—powering search, comparison, compatibility checks, and clean analytics.

**Q5. How it enables configuration**  
Features bind to controlled **reference sets** (often taxonomy enumerations). New variants = **tags + rules**, not new code or schemas.

**Q6. Flexibility examples (non-controversial)**  
- **Bag subtype:** “Sports bag” is a tagged variant of “checked bag”—immediately recognized in all channels.  
- **Lounge access modeling:** Shift from “2 hours” to “time window” by updating allowed values; the product model stays intact.  
- **Multimodal readiness:** “Mode” is just a facet; same product/rule patterns extend to rail or ferry without schema churn.

---

## Theme 3 — Supplier Catalog Data Exchange (no “big book”)

**Q7. How does the exchange help?**  
It’s a **living retail catalog**, not a quarterly PDF. We share **small, effective-dated deltas** for product definitions, features, taxonomy tags, and business rules. Retailers ingest **one consistent shape** across suppliers.

**Q8. What’s exchanged (and what’s not), and why?**  
- **Exchanged (retail product info):**  
  - Product definitions & versions  
  - Feature specs bound to reference sets  
  - Taxonomy/tag assignments  
  - Eligibility / combinability / packaging rules (including price **fences**, not prices)  
  - Descriptions, media, T&Cs, life-cycle states (create/revise/deprecate), effective dating & idempotency  
- **Not exchanged (ops resolved at offer time):**  
  - No schedules, flight numbers/times, rotations, or inventory. These change constantly. The **offer engine** matches the **retail product** to **current operations** at pricing time.

**Q9. How does this support dynamic updates & alignment?**  
Commercial teams change **assortment policies** (tags & rules); retailers refresh their **pre-offer index** automatically. At search, we:  
1) select a **high-probability retail range** (policy + taxonomy), then  
2) join with **current ops** to instantiate only what’s buildable.  
Strategy = configuration deltas; ops volatility = handled at offer time.

**Kill the “big book” myth**  
- “**Supplier catalog ≠ book.** It’s a **menu with chalkboard specials**—publish once, then keep it fresh with small updates.”  
- “We publish **products**, not **rotations**.”

---

## Theme 4 — Interdependencies Across MAR

**Q10. Ties to Offers & Orders**  
Standards + taxonomy give Offers **structured building blocks** and guardrails. **Pre-offer** chooses what’s relevant and feasible first; Orders reference the same components for servicing and settlement—no translation gaps.

**Q11. Collaboration benefits**  
One governed **catalog + taxonomy** becomes shared retail truth. Suppliers publish once; retailers commercialize many times. Fewer mappings, faster onboarding, clearer negotiations (we debate **rules**, not file formats).

**Q12. Future-proofing & customer-centricity**  
You **innovate by configuration**: launch new services, target segments, and A/B test by adding concepts/rules. Tagged data improves relevance. Most importantly, look-to-book improves because we price the **right** things, not **everything**.

---

## “Retail Readiness” examples (simple, pre-offer)

1) **Supplier rules drive smarter offer selection (L2B win)**  

- **Supplier publishes** an eligibility rule: “Family Seating Benefit applies when ≥2 passengers and ≥1 child under 12; POS=DE/AT; routes: FRA↔CDG, MUC↔AMS.”  
- **Retailer ingests** the delta event and updates the **pre-offer index**.  
- **Effect:** Only eligible shoppers see the benefit and related bundles; non-eligible flows don’t trigger price calls for products they can’t receive—**cleaner results, better look-to-book**.

2) **Taxonomy as a pivot to align classifications (e.g., loyalty tiers & labels)**  

- **Supplier taxonomy:** Platinum / Gold / Silver (concept URIs).  
- **Retailer taxonomy:** Elite / Preferred / Member.  
- **Action:** Map both to shared **taxonomy concepts** (e.g., `tax:loyalty/tier/high|mid|base`) and tag products (e.g. priority boarding, fast track, Wi‑Fi credit) to those concepts.  
- **Effect at pre-offer:** Regardless of the partner’s local naming, the retailer can target benefits and visibility based on the **shared concept**, not the label—**frictionless alignment without renegotiating schemas**.


**Plain takeaway:** **Retail Readiness** curates the **retail range** *before* pricing. Small, frequent deltas keep it fresh—no big books, no heavy re-ingestion.

---

## One-liners to reinforce the message
- “We stop selling **inventory in disguise** and start selling **products on purpose**.”  
- “**Pre-offer** is the step before the offer that current NDC flows miss.”  
- “**Price the right things, not everything.**”  
- “**Little-and-often** beats **big-and-late**.”
