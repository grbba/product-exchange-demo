Build a single-page demo web app (React + Vite + Tailwind + shadcn/ui, no backend) that demonstrates supplier→retailer product information exchange.

## Goals
- Let me paste or upload supplier product JSON.
- Validate against schema + business rules.
- Map supplier fields/values to retailer taxonomy (with auto-suggestions + manual override).
- Normalize/enrich and show a before/after diff.
- Approve and export a retailer-ready JSON payload (download + copy).
- Demonstrate the creation of a new product as well as the update of an existing product and how this update is communicated towards the retailer 

## Product Mode


## Data & Samples
Use these exact samples unless I replace them:

### Supplier catalog (JSON)
[PASTE small catalog with 3–6 products. Include a few intentional issues.]

### Retailer taxonomy (JSON)
[PASTE concepts/collections; keep 6–8 concepts with example values.]

### ClassificationProfiles (JSON)
[PASTE 1–2 profiles, with required_min_tags and recommended_tags.]

### Synonyms / normalization (JSON)
[PASTE table like { "blu":"Blue", "navy":"Blue", "bt":"Bluetooth" }]

## Validation Rules (implement)
- price > 0; currency in ISO4217 list (hardcode a short allowlist).
- For product_class "Shoes": require size and size_unit ∈ {EU, US, UK}.
- For product_class "Headphones": require connectivity ∈ {Bluetooth, Wired}.
- If gtin present, perform a simple checksum/length check (allow 8, 12, 13, 14).
- Image URLs match `^https?://`.

## Mapping Behavior
- Auto-suggest mapping for Brand, Color, Size, Category using synonyms.
- Confidence score: 1.0 for exact match; 0.7 for synonym; 0.4 otherwise.
- Editable dropdowns to override concept/value; updates re-run transform.

## UI Requirements
- Use google material design 3 for UI
- Left: Supplier JSON editor with “Load sample” and “Upload file”.
- Center tabs: Issues | Mapping | Transform (side-by-side diff).
- Right: Retailer JSON (read-only) + “Copy JSON” + “Download JSON” + “Approve”.
- Status badges for Errors, Warnings, Passed; per-product chips.
- Keep it mobile-friendly and accessible.

## Non-functional
- All logic client-side; no external calls.
- Code in as few files as practical; include comments where helpful.
- Provide a small rules engine with a clear interface (validate(), map(), transform()).

## Deliverables
- Complete, runnable code (Vite project) with instructions.
- Seed data embedded so it works out of the box.

## Nice-to-haves (if time/space allows)
- Toggle to show/hide audit metadata.
- “Introduce common errors” switch to demo validation quickly.

Name the main component “RetailerSupplierDemo”.
