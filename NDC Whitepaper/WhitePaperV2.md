# Beyond Legacy Constraints: The Future of Airline Commerce Architecture
## Why NDC's Current Approach Creates More Problems Than It Solves

*A White Paper for Business Stakeholders and Enterprise Architects*
Gregor Baues Director Business Entereprise Architecture Air France/KLM

---

## Executive Summary

The airline industry’s adoption of IATA’s New Distribution Capability (NDC) promised richer product differentiation, direct retailer connections, and an improved customer experience through modern, API-driven commerce. The vision was to revolutionize how airlines sell by enabling personalized offers and seamless digital retailing. In practice, however, many airlines — including ours — are facing significant operational challenges: look-to-book ratios have surged compared to traditional GDS distribution, and the new architecture has introduced problems that are both more expensive and less efficient than the systems it aimed to replace.

This is not simply a result of retailer behavior. Rather, it stems from structural design characteristics within NDC itself. Current implementations inadvertently encourage "dumb shopping"—high-volume, low-precision search requests—due to a lack of pre-shopping product intelligence available to retailers, aggregators, and OTAs. Without sufficient data to narrow down options before making live offer requests, intermediaries are forced to send broad, repeated, and speculative queries, leading to:

- High system loads for both airlines and intermediaries
- Poor response times and degraded user experience
- Increased infrastructure costs without proportional revenue gains
- Data noise that undermines demand forecasting accuracy

Fundamentally, the root cause is not just technical implementation, but a conceptual one. NDC perpetuates legacy thinking about airline products while wrapping them in modern APIs—what might be called “legacy constructs in REST clothing.” This has led to an explosion of inefficient shopping behavior, unsustainable look-to-book ratios, and a fundamental mismatch between retail aspirations and the distribution reality. These issues are further compounded by the complexity of interlining and codeshare operations.

While IATA’s commitment to modern airline retailing—centered on Offers and Orders—is a step in the right direction, there remains a risk that the industry will once again fall short by layering new paradigms over legacy NDC foundations. Unless the underlying structures and assumptions of NDC are fundamentally re-examined, history may repeat itself: the industry could invest in new technology and standards without truly transforming the way airline products are modeled, distributed, and retailed. To fully realize the promise of modern airline commerce, the industry must go beyond incremental changes and legacy constructs, embracing a holistic and genuinely digital approach to product, offer, and order management. Only then can airlines, partners, and customers benefit from the flexibility, efficiency, and personalization that modern retailing envisions.

---

## The Architecture of Inefficiency

### Current NDC Architecture: The Source of Inefficiency

The following diagram illustrates the current NDC shopping process from a high-level perspective. To respond to a single customer search, retailers and OTAs must send broad, repetitive requests to multiple airlines’ NDC APIs. Each airline’s NDC interface, in turn, queries its own legacy passenger service system—returning generic, opaque offers with limited product detail. This fragmented approach leads to high system load, poor user experience, and significant inefficiencies, making it difficult for customers to compare offers and for airlines to deliver true modern retailing.

![Current NDC pattern](<../out/NDC Whitepaper/CurrentArchitecture/CurrentArchitecture.png>)
<p style="text-align:center;font-size:10px;">Figure1: Current NDC pattern</p>

### The Look-to-Book Crisis Explained

From an enterprise architecture persepctive system efficiency stems from the alignment between data structures and usage patterns. NDC violates this principle spectacularly. Where traditional Global Distribution Systems (GDS) operated on cached, pre-computed fare displays, NDC demands real-time API calls for each search request. The result? Airlines report look-to-book ratios—the number of searches required per booking—that can exceed 1000:1 for some routes.

Consider the architectural implications: every price inquiry triggers live database queries, availability checks, and complex fare calculations across the airline's core systems. What was once a simple cache lookup has become a distributed computing problem that scales linearly with search volume, not bookings.

The business impact is significant. Airlines are facing substantial increases in infrastructure costs to handle the NDC-driven surge in live shopping requests. This is not simply a scaling challenge—it’s an architectural anti-pattern that addresses symptoms rather than the root cause: the lack of pre-shopping intelligence for sellers and retailers.

### The "Dumb Shopping" Epidemic

#### The "Dumb Shopping" Epidemic

The efficiency crisis stems from a deeper issue: information asymmetry. Modern retail aggregators have become exceptionally sophisticated at targeted shopping in other industries. Amazon doesn't show you every product in their catalog; it intelligently filters based on your context, preferences, and behavioral patterns.

But in airline distribution, retailers are forced into what we might call "dumb shopping." Here's why:

**The Mall Directory Analogy**: Imagine you're in a giant shopping mall. In the old days, every time you wanted to buy something, you had to walk into every store and ask, "What do you have for sale today?"—even if you were just browsing. By the time you finished, you'd have walked miles, and the shopkeepers would be exhausted from answering the same questions a hundred times.

This is exactly what happens in today's NDC environment. Travel retailers must "visit" every airline's API, repeatedly asking what products are available, without any way to browse or compare beforehand.

**No Product Discovery Layer**: NDC offers arrive as opaque bundles with minimal semantic information. A travel management company booking for a corporate client receives an offer labeled "Economy Flex" for $450, but has no programmatic way to understand:
- What specific change policies apply
- Whether carry-on bags are included  
- If seat selection is available
- How this compares to another airline's "Business Saver" at $470

**Fishing for Inventory**: Without product catalogs or structured discovery mechanisms, intermediaries must "poke and see"—sending broad, repetitive requests just to discover what's available. It's the digital equivalent of walking into every store and asking to see "everything you have." The result is massive over-searching for irrelevant inventory.

### Interlining and Codeshare: Multiplying the Problem Exponentially

> Diagram here

The challenge compounds dramatically with multi-airline itineraries, which represent a significant portion of airline commerce:

**From One Airline to Many**: Legacy airline commerce is built on the ability to combine flights from multiple carriers—interlining and codeshare—so travelers can book single tickets from Point A to Point C via Point B, even when segments are operated by different airlines. While this model adds customer value, it introduces combinatorial explosion in possible offers.

**Distributed Shopping Nightmare**: In traditional GDS systems, the platform aggregated, cached, and optimized multi-airline itineraries behind the scenes. With NDC, each segment or partner airline must be queried directly—often through separate and inconsistent APIs with no coordination or common product model.

**Codeshare Complexity**: The marketing carrier (seller) is often not the operating carrier (supplier). The marketed fare may not correlate with actual product availability—further increasing guesswork and redundant queries.

**Real-World Impact**: An OTA searching for itineraries from Paris to Sydney might need to query three or more airlines (e.g., AF, QF, CX) for every possible combination of segments, classes, and ancillaries. Without product catalogs, this means thousands of API calls just to assemble one viable option.

## The Schema Problem: Why NDC Standards Miss the Mark

### Legacy Constructs in Modern Wrappers

The current NDC schema reflects a fundamental misunderstanding of modern commerce patterns. Examine the data structures: they're essentially digitized versions of 1960s airline tickets, complete with concepts like "fare basis codes" and "passenger name records."

Consider the NDC OrderItem structure. It maintains artificial distinctions between "flights" and "ancillary services" that have no basis in modern customer thinking or system design. A passenger doesn't mentally separate "the flight" from "the seat" from "the meal"—they're purchasing a complete travel experience. Yet NDC perpetuates these boundaries through separate data schemas, pricing models, and business rules.

This creates unnecessary complexity. Airlines must maintain separate inventory systems for seats versus baggage versus meals, each with its own availability logic, pricing rules, and fulfillment processes. Integration becomes a constant challenge because the schema assumes these are fundamentally different product types.

### Semantic Poverty Across the Ecosystem

Modern e-commerce succeeds through rich product metadata. When you shop for a hotel on Booking.com, you can filter by dozens of semantic attributes: pet-friendly, business center, pool, distance to city center, guest ratings by category. The platform can intelligently match your expressed preferences to relevant inventory.

NDC offers contain almost no semantic information. There's no standardized way to express that one airline's "Basic Economy" prohibits carry-on bags while another's includes them. No mechanism to indicate that a fare is optimized for same-day changes versus advance planning. Retailers receive pricing without the contextual information needed for intelligent comparison or personalized recommendations.

**The Multi-Airline Challenge**: This semantic poverty becomes exponentially problematic with interlining and codeshare, where intermediaries must somehow compare and combine offers from airlines with completely different product models and naming conventions.

## Structural Flaws in Today's NDC Implementation

### Missing Foundation: No Product Catalog

The core issue is the absence of a product catalog or discovery API in standard NDC schemas. In retail, you can fetch a structured list of products, variants, and attributes before you buy. With NDC, there is no "airline catalog"—especially for multi-airline itineraries. You only know what's available after you ask, over and over again.

**Architect's Analogy**: "It's like assembling a meal with ingredients from multiple restaurants—except you have to knock on every kitchen door and ask what's cooking, every single time."

### Personalization: Blessing and Curse

NDC enables personalized offers, but this further complicates caching and cataloging. If every search could return a unique, tailored offer—especially when combining multiple airlines—how can intermediaries browse or cache products? The temptation is to turn every search into a real-time, one-off query, further fueling "dumb shopping."

### Fragmentation and Inconsistent APIs

Each airline's NDC implementation differs—some expose bundles, others only fares; some allow ancillaries at search, others only at booking. There's no standard way to browse or filter products. Aggregators and even airline partners must "poke and see," multiplying traffic and complexity for interline and codeshare bookings.

## The Path Forward: Unified Semantic Commerce Architecture

### Future State: Distributed Product Intelligence with Bilateral Exchange

> Diagram here

### Everything as Combinable Inventory

The solution requires eliminating the artificial boundaries between flights and services entirely. Instead of "base fares plus ancillaries," every component becomes a discrete, combinable inventory unit:

- Seat 12A on AA123 departing March 15 at 2:15 PM
- Priority boarding for that same flight
- 23kg baggage allowance LAX→JFK
- Delta Sky Club access at LAX on March 15
- Gogo Wi-Fi for flight AA123
- Meal option #3 (vegetarian) on AA123

Each unit carries rich semantic metadata about flexibility, comfort, service level, and combinability with other units. This isn't just a data model—it's a fundamental reconceptualization of airline products as composable services that work seamlessly across airline partnerships.

### Semantic-Rich Shopping

With unified inventory and rich metadata, shopping becomes dramatically more efficient. Instead of broad searches across entire route networks, retailers could make precise, intent-driven queries:

"Find combinations under $600 for corporate traveler profile: aisle seat + flexible change policy + lounge access + reliable Wi-Fi"

The system would only query inventory units matching these semantic requirements across all participating airlines. Look-to-book ratios would plummet because every search represents qualified intent rather than exploratory browsing.

### The Product Catalog Foundation

> Diagram here

This transformation requires what every modern retailer takes for granted: a structured, discoverable product catalog that works across airline partnerships:

### Continuous Product Information Maintenance Process

> Diagram here

### Real-World Analogy: Learning from Digital Commerce

#### The Hotel Industry Evolution

The hotel industry provides a compelling parallel. Twenty years ago, hotels sold "room nights" with limited differentiation. Today, they offer composable experiences: base accommodation + spa access + breakfast + late checkout + gym privileges + business center access. Each component is individually priced and combinable.

Modern hotel distribution platforms handle this complexity through semantic search. You don't search for "Marriott Category 4 with continental breakfast add-on"—you search for "downtown hotels with fitness center and business facilities." The platform translates your intent into specific inventory queries.

#### The Amazon Model

Amazon doesn't maintain separate systems for books versus electronics versus clothing. Everything is inventory with attributes, reviews, and compatibility. Third-party sellers integrate seamlessly through standardized product catalogs and APIs, enabling complex multi-vendor transactions through unified experiences.

Airlines could operate similarly, but NDC's current schema makes this impossible.

## Implementation Strategy: The Three-Phase Transformation

### Phase 1: Unified Product Catalog

Transform existing fare structures into semantic product attributes:
- Replace fare basis codes with flexibility scores (0-100)
- Convert service classes to comfort/convenience metrics
- Standardize change/cancel policies as structured data
- Map ancillary services to semantic categories (comfort, convenience, productivity)

This preserves supplier sovereignty over actual stock levels and pricing while enabling intelligent product discovery across airline partnerships.

### Phase 2: Intent-Driven APIs

### Implementation Strategy: Distributed Product Intelligence

> Diagram here

**Bilateral Product Intelligence**: Each retailer maintains their own product knowledge base with supplier product information mapped to their specific taxonomies and business rules—like each travel company having its own customized "mall directory" tailored to their customers' needs.

**IATA Standards-Based Exchange**: Standardized product information exchange formats enable consistent bilateral relationships while preserving retailer autonomy over categorization and optimization—ensuring all "mall directories" can receive updates in a common format while displaying them according to their own customer needs.

**Distributed Optimization**: Rather than a single centralized platform, multiple retailers can independently optimize their supplier relationships and product assortment processes—like different travel companies each optimizing their own "mall directory" for their specific customer segments.

**Gradual Adoption**: Suppliers and retailers can adopt enhanced product exchange bilaterally without waiting for industry-wide consensus or central platform availability—stores can start updating "directories" one retailer relationship at a time.

This distributed approach offers several key advantages over centralized models:
- "Flexible options under $500" becomes a structured query
- "Business traveler needs" maps to predefined attribute combinations
- Cross-airline comparison happens on semantic attributes, not opaque bundles

### Phase 3: Dynamic Offer Assembly

Enable real-time offer construction from available product components rather than pre-packaged products. This eliminates the need to maintain complex fare filing while enabling true mass customization. Critically, suppliers retain complete control over final pricing, availability decisions, and order acceptance—the system facilitates intelligent product discovery and presentation, not inventory management or price-setting by retailers.

## Business Case: The Efficiency Dividend

### Quantifiable Benefits

**Cost Reduction**: Semantic shopping dramatically reduces look-to-book ratios by targeting qualified searches. Airlines report potential 60-80% reductions in shopping-related computing costs through elimination of inefficient traffic.

**Revenue Optimization**: Rich product metadata enables sophisticated yield management across all product types, not just base fares. Early implementations show 8-12% revenue improvements through better product optimization while maintaining supplier control over pricing decisions.

**Market Expansion**: Unified commerce enables airlines to compete in adjacent markets (ground transportation, accommodations, experiences) using the same product architecture and distribution infrastructure, while maintaining appropriate supplier control over their respective product components.

### Competitive Implications

Airlines implementing semantic commerce first will enjoy significant advantages in cost structure, product flexibility, and customer experience. The architectural dividend compounds over time as the platform enables new business models and partnerships that weren't possible under legacy constructs.

## Industry Collaboration Requirements

This transformation cannot succeed in isolation. It requires:

**Standards Evolution**: Industry bodies must evolve NDC and related standards, learning from digital commerce platforms rather than perpetuating legacy constructs like fares, PNRs, EMDs, and complex interlining agreements.

**Partner Alignment**: Airlines, agents, aggregators, and technology providers must collaborate on unified product models and semantic standards that work seamlessly across partnerships.

**Ecosystem Thinking**: Success depends on network effects—the more participants adopting semantic commerce, the more valuable it becomes for everyone, especially for complex multi-airline itineraries.

## Conclusion: Architecture as Strategic Imperative

The airline industry stands at an architectural crossroads. Continue down the current NDC path, and airlines will face escalating infrastructure costs supporting increasingly inefficient shopping patterns, with problems compounding as interlining and codeshare become more complex. Or embrace a fundamental reconceptualization of airline commerce that eliminates legacy constraints and enables true product innovation.

The choice seems obvious, but requires courage to abandon familiar constructs in favor of architectural principles that align with modern commerce patterns. The airlines that make this transition first will enjoy significant competitive advantages in cost structure, product flexibility, and customer experience.

**From Legacy Migration to Future Architecture**: The transformation from legacy distribution to modern commerce isn't optional—it's inevitable. The question isn't whether this will happen, but whether your organization will architect the future or be architected by it.

The airlines that embrace semantic commerce principles—unified inventory, rich metadata, intent-driven shopping, and seamless partner integration—will define the next era of airline retailing. Those that continue optimizing legacy constructs will find themselves competitively disadvantaged by architecture itself.

**The path forward is clear: stop migrating the past and start architecting the future.**

---

*This white paper reflects the views of enterprise architecture best practices and is intended to stimulate strategic discussion among business and technology stakeholders. For detailed implementation guidance and architectural consultation, please contact your Enterprise Architecture Office.*