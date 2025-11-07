export type SingleValue = {
  kind: "SingleValue";
  value: string;
  referenceSystemId?: string;
  unit?: string;
};
export type ValueRange = {
  kind: "ValueRange";
  min: string;
  max: string;
  referenceSystemId?: string;
  unit?: string;
};
export type DiscreteSet = { kind: "DiscreteSet"; values: string[]; referenceSystemId?: string };
export type FeatureValue = SingleValue | ValueRange | DiscreteSet;

export type Feature = {
  id: string;
  name: string;
  description?: string;
  values: FeatureValue[];
  tags: string[];
};

export type Product = {
  id: string;
  name: string;
  localizedNames?: Record<string, string>;
  type?: string;
  lifecycleStatus: "Draft" | "Active" | "EndOfLife";
  features: Feature[];
  tags: string[];
  additionalInfo?: Record<string, string>;
};

export type PartnerRole = "supplier" | "retailer";

export type Partner = {
  id: string;
  name: string;
  externalId: string;
  roles: PartnerRole[];
  createdAt: string;
  updatedAt: string;
};

export type PartnerProductMap = Record<string, string[]>;

export const IDENTITY_CAPABILITIES = [
  "product-updates",
  "schema-updates",
  "taxonomy-updates",
  "reference-system-updates",
] as const;
export type IdentityCapability = (typeof IDENTITY_CAPABILITIES)[number];

export type AppIdentity = {
  instanceId: string;
  displayName: string;
  organization: string;
  contactEmail: string;
  description: string;
  endpointUrl: string;
  capabilities: IdentityCapability[];
};

export const EXCHANGE_PROTOCOLS = ["webhook", "sse", "websocket"] as const;
export type ExchangeProtocol = (typeof EXCHANGE_PROTOCOLS)[number];

export type ChannelConfiguration = {
  protocol: ExchangeProtocol;
  destinationUrl: string;
  authToken: string;
  requireAcknowledgement: boolean;
  notes: string;
};

export type AppSettings = {
  identity: AppIdentity;
  channel: ChannelConfiguration;
  updatedAt: string;
};

export type ReferenceSystemType =
  | "Measurement"
  | "Enumeration"
  | "CodeSystem"
  | "ColorSystem"
  | "Schema"
  | "Other";

export type ReferenceSystemCardinality = "single" | "multiple";

type ReferenceSourceBase = {
  authority: string;
  resourceName: string;
  resourceType: string;
};

export type ExternalReferenceSource = ReferenceSourceBase & {
  kind: "External";
  url: string;
  format?: string;
  accessProtocol?: string;
};

export type InternalLifecycleState = "draft" | "active" | "retired";
export type InternalSelectionPolicy = "fixed_set" | "controlled_extension";

type InternalReferenceBase = ReferenceSourceBase & {
  kind: "Internal";
  repositoryName: string;
  repositoryVersion: string;
  lifecycleState: InternalLifecycleState;
  selectionPolicy: InternalSelectionPolicy;
};

export type ClosurePolicy = "individual" | "direct" | "with_descendants" | "transitive_closure";
export type RepresentationMode = "id" | "uri" | "code";
export type LabelPolicy = "resolve_at_read" | "freeze_on_bind";
export type VersionBinding = "record_taxonomy_version" | "none";

export type TaxonomyConceptSetReference = InternalReferenceBase & {
  repositoryType: "TaxonomyConceptSet";
  conceptSchemeUri: string;
  anchorConceptIds: string[];
  closurePolicy: ClosurePolicy;
  representation: RepresentationMode;
  labelPolicy: LabelPolicy;
  versionBinding: VersionBinding;
};

export type CodeSetValue = { code: string; label?: string };

export type CodeSetReference = InternalReferenceBase & {
  repositoryType: "CodeSet";
  values: CodeSetValue[];
  defaultCode?: string;
};

export type InternalReferenceSource = TaxonomyConceptSetReference | CodeSetReference;

export type ReferenceSource = ExternalReferenceSource | InternalReferenceSource;

export type ReferenceValidationProvider = "amadeus-airport";

export const createExternalReferenceSource = (): ExternalReferenceSource => ({
  kind: "External",
  authority: "",
  resourceName: "",
  resourceType: "",
  url: "",
});

export const createTaxonomyReferenceSource = (): TaxonomyConceptSetReference => ({
  kind: "Internal",
  authority: "",
  resourceName: "",
  resourceType: "",
  repositoryName: "",
  repositoryVersion: "",
  lifecycleState: "draft",
  selectionPolicy: "fixed_set",
  repositoryType: "TaxonomyConceptSet",
  conceptSchemeUri: "",
  anchorConceptIds: [],
  closurePolicy: "individual",
  representation: "id",
  labelPolicy: "resolve_at_read",
  versionBinding: "record_taxonomy_version",
});

export type ReferenceSystem = {
  id: string;
  identifier: string;
  description: string;
  systemType: ReferenceSystemType;
  cardinality: ReferenceSystemCardinality;
  source: ReferenceSource;
  createdAt: string;
  updatedAt: string;
  validationProvider?: ReferenceValidationProvider;
};

export type ReferenceSystemDraft = {
  identifier: string;
  description: string;
  systemType: ReferenceSystemType;
  cardinality: ReferenceSystemCardinality;
  source: ReferenceSource;
  validationProvider?: ReferenceValidationProvider;
};

export type LinkedSsr = { id: string; label: string };

export type Concept = {
  id: string;
  label: string;
  altLabels?: string[];
  definition?: string;
  broader?: string[];
  narrower?: string[];
  related?: string[];
  topConceptOf?: string[];
  inSchemes?: string[];
  linkedSsrs?: LinkedSsr[];
};
export type ConceptScheme = { id: string; label: string; topConcepts: string[] };
export type Collection = { id: string; label: string; members: string[] };

export type Mapping = { fromConceptId: string; toConceptId: string; relation: "exactMatch" | "closeMatch" };

export const RULE_TYPES = ["Dependency", "Exclusion", "AvailabilityConstraint", "ValueConstraint", "Inclusion"] as const;
export type RuleType = (typeof RULE_TYPES)[number];

export const CONTEXT_REFS = ["currentProduct", "transport", "offer", "customer", "itinerary", "segment"] as const;
export type ContextRef = (typeof CONTEXT_REFS)[number];

export const LOGICAL_OPERATORS = ["AND", "OR", "NOT", "XOR", "NAND", "NOR"] as const;
export type LogicalOperator = (typeof LOGICAL_OPERATORS)[number];

export const TARGET_ACTIONS = [
  "ENABLE",
  "DISABLE",
  "SET_VALUE",
  "ADD_TO_SELECTION",
  "REMOVE_FROM_SELECTION",
  "SHOW",
  "HIDE",
  "REQUIRE",
  "FORBID",
] as const;
export type TargetAction = (typeof TARGET_ACTIONS)[number];

export const VALUE_OPERATORS = [
  "EQUALS",
  "NOT_EQUALS",
  "LESS_THAN",
  "LESS_THAN_OR_EQUAL",
  "GREATER_THAN",
  "GREATER_THAN_OR_EQUAL",
  "IN",
  "NOT_IN",
  "CONTAINS",
  "NOT_CONTAINS",
  "STARTS_WITH",
  "ENDS_WITH",
  "MATCHES_PATTERN",
  "SELECTED",
  "NOT_SELECTED",
  "EXISTS",
  "NOT_EXISTS",
] as const;
export type ValueOperator = (typeof VALUE_OPERATORS)[number];

export const SELECTION_SCOPES = ["ANY_SELECTED", "ALL_SELECTED", "NONE_SELECTED"] as const;
export type SelectionScope = (typeof SELECTION_SCOPES)[number];

type LogicalExpressionBase = {
  expressionId: string;
  description?: string;
};

export type CompoundExpression = LogicalExpressionBase & {
  kind: "Compound";
  operator: LogicalOperator;
  children: LogicalExpression[];
};

export type TaxonomyExpression = LogicalExpressionBase & {
  kind: "Taxonomy";
  subjectRef: ContextRef;
  taxonomyConceptId: string;
  taxonomyScheme: string;
  selectionScope?: SelectionScope;
};

export type FeatureExpression = LogicalExpressionBase & {
  kind: "Feature";
  subjectRef: ContextRef;
  featureId: string;
  operator: ValueOperator;
  value?: string;
};

export type ProductExpression = LogicalExpressionBase & {
  kind: "Product";
  subjectRef: ContextRef;
  productId: string;
  operator: ValueOperator;
};

export type QuantityExpression = LogicalExpressionBase & {
  kind: "Quantity";
  subjectRef: ContextRef;
  itemId: string;
  quantity: number;
  operator: ValueOperator;
};

export type DateTimeExpression = LogicalExpressionBase & {
  kind: "DateTime";
  subjectRef: ContextRef;
  operator: ValueOperator;
  value: string;
};

export type LogicalExpression =
  | CompoundExpression
  | TaxonomyExpression
  | FeatureExpression
  | ProductExpression
  | QuantityExpression
  | DateTimeExpression;

export type RuleContext = {
  contextId: string;
  bindings: Partial<Record<ContextRef, string>>;
};

type RuleTargetBase = {
  targetId: string;
  description?: string;
  action: TargetAction;
};

export type ProductTarget = RuleTargetBase & {
  kind: "Product";
  productId: string;
};

export type TaxonomyTarget = RuleTargetBase & {
  kind: "Taxonomy";
  conceptId: string;
};

export type RuleTarget = ProductTarget | TaxonomyTarget;

export type ScopeDefinition = {
  channels: string[];
  markets: string[];
  customerSegments: string[];
  effectiveFrom?: string;
  effectiveTo?: string;
};

export type RuleScope = {
  scopeId: string;
  description?: string;
  definition: ScopeDefinition;
};

export type Rule = {
  id: string;
  ruleId: string;
  name: string;
  description: string;
  type: RuleType;
  priority: number;
  context: RuleContext;
  expression: LogicalExpression;
  targets: RuleTarget[];
  scope?: RuleScope;
  createdAt: string;
  updatedAt: string;
};

export type RuleLinkKind = "Global" | "Schema" | "Product";

export type RuleLink = {
  id: string;
  ruleRef: string;
  kind: RuleLinkKind;
  targetId?: string;
  description?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
};

export type SchemaCategory = "transport" | "baggage" | "seat" | "lounge" | "meal" | "other";


export type ProductSchema = {
  id: string;
  name: string;
  description?: string;
  category: SchemaCategory;
  tags: string[];
  assignedCollections: string[];
  featureTemplates: Feature[];
  createdAt: string;
  updatedAt: string;
};

export type ProductInstance = {
  id: string;
  schemaId: string;
  product: Product;
  createdAt: string;
  updatedAt: string;
};

export const REFERENCE_SYSTEM_TYPES: ReferenceSystemType[] = [
  "Measurement",
  "Enumeration",
  "CodeSystem",
  "ColorSystem",
  "Schema",
  "Other",
];

export const defaultReferenceSystems = (): ReferenceSystem[] => {
  const timestamp = new Date().toISOString();
  return [
    {
      identifier: "RS-IATA-AIRPORT-001",
      id: "RS-IATA-AIRPORT-001",
      description: "IATA 3-letter airport codes",
      systemType: "Enumeration",
      cardinality: "single",
      source: {
        kind: "External",
        authority: "IATA",
        resourceName: "IATA Airline and Airport Code Directory",
        resourceType: "CodeList",
        url: "https://www.iata.org/en/publications/directories/code-search/?airport.search=",
      },
      createdAt: timestamp,
      updatedAt: timestamp,
      validationProvider: "amadeus-airport",
    },
    {
      identifier: "RS-UNECE-REC20-001",
      id: "RS-UNECE-REC20-001",
      description: "UNECE Recommendation 20 – Measurement units",
      systemType: "Measurement",
      cardinality: "single",
      source: {
        kind: "External",
        authority: "UNECE",
        resourceName: "Recommendation No. 20",
        resourceType: "CodeList",
        url: "https://unece.org/trade/cefact/recommendations/standard-units",
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
};

export const DEFAULT_CONCEPTS: Concept[] = [
  { id: "apmwg:C-Flight", label: "Flight" },
  { id: "apmwg:C-PriorityBoarding", label: "Priority boarding" },
  { id: "apmwg:C-Baggage", label: "Baggage" },
  { id: "apmwg:C-Origin", label: "Origin airport" },
  { id: "apmwg:C-Destination", label: "Destination airport" },
  { id: "apmwg:C-Seat", label: "Seat assignment" },
];

export const CONCEPT_SCHEMES: ConceptScheme[] = [
  { id: "apmwg:SCH-Airline", label: "Airline Services", topConcepts: ["apmwg:C-Flight", "apmwg:C-Baggage", "apmwg:C-Seat"] },
];

export const COLLECTIONS: Collection[] = [
  { id: "apmwg:COL-Ancillaries", label: "Ancillary Services", members: ["apmwg:C-PriorityBoarding", "apmwg:C-Seat"] },
];

export const SCHEMA_CATEGORIES: SchemaCategory[] = [
  "transport",
  "baggage",
  "seat",
  "lounge",
  "meal",
  "other",
];

export const schemaCategoryLabel = (category: SchemaCategory) =>
  category.charAt(0).toUpperCase() + category.slice(1);

export const uid = () => Math.random().toString(36).slice(2, 10);

const capabilitySet = new Set<IdentityCapability>(IDENTITY_CAPABILITIES);
const isCapability = (value: unknown): value is IdentityCapability =>
  typeof value === "string" && capabilitySet.has(value as IdentityCapability);

const sanitizeCapabilities = (
  value: unknown,
  fallback: IdentityCapability[]
): IdentityCapability[] => {
  if (!Array.isArray(value)) return fallback;
  const filtered = value.filter(isCapability);
  return filtered.length ? filtered : fallback;
};

const isProtocol = (value: unknown): value is ExchangeProtocol =>
  typeof value === "string" && (EXCHANGE_PROTOCOLS as readonly string[]).includes(value);

const randomInstanceId = () => `apmwg-node-${uid()}`;

export const createDefaultIdentity = (): AppIdentity => ({
  instanceId: randomInstanceId(),
  displayName: "Workbench Instance",
  organization: "",
  contactEmail: "",
  description: "Local sandbox for exchanging product data.",
  endpointUrl: "",
  capabilities: ["product-updates", "schema-updates", "taxonomy-updates"] as IdentityCapability[],
});

export const createDefaultSettings = (): AppSettings => ({
  identity: createDefaultIdentity(),
  channel: {
    protocol: "webhook",
    destinationUrl: "",
    authToken: "",
    requireAcknowledgement: true,
    notes: "",
  },
  updatedAt: new Date().toISOString(),
});

export const normalizeAppSettings = (input?: Partial<AppSettings> | null): AppSettings => {
  const defaults = createDefaultSettings();
  const identityInput = input?.identity;
  const channelInput = input?.channel;

  return {
    identity: {
      ...defaults.identity,
      ...identityInput,
      instanceId: typeof identityInput?.instanceId === "string" && identityInput.instanceId.trim()
        ? identityInput.instanceId
        : defaults.identity.instanceId,
      displayName: typeof identityInput?.displayName === "string" ? identityInput.displayName : defaults.identity.displayName,
      organization: typeof identityInput?.organization === "string" ? identityInput.organization : defaults.identity.organization,
      contactEmail: typeof identityInput?.contactEmail === "string" ? identityInput.contactEmail : defaults.identity.contactEmail,
      description: typeof identityInput?.description === "string" ? identityInput.description : defaults.identity.description,
      endpointUrl: typeof identityInput?.endpointUrl === "string" ? identityInput.endpointUrl : defaults.identity.endpointUrl,
      capabilities: sanitizeCapabilities(identityInput?.capabilities, defaults.identity.capabilities),
    },
    channel: {
      ...defaults.channel,
      ...channelInput,
      protocol: isProtocol(channelInput?.protocol) ? (channelInput?.protocol as ExchangeProtocol) : defaults.channel.protocol,
      destinationUrl:
        typeof channelInput?.destinationUrl === "string" ? channelInput.destinationUrl : defaults.channel.destinationUrl,
      authToken: typeof channelInput?.authToken === "string" ? channelInput.authToken : defaults.channel.authToken,
      requireAcknowledgement:
        typeof channelInput?.requireAcknowledgement === "boolean"
          ? channelInput.requireAcknowledgement
          : defaults.channel.requireAcknowledgement,
      notes: typeof channelInput?.notes === "string" ? channelInput.notes : defaults.channel.notes,
    },
    updatedAt: input?.updatedAt ?? defaults.updatedAt,
  };
};

export const cloneFeatureValue = (value: FeatureValue): FeatureValue => {
  if (value.kind === "SingleValue") return { ...value };
  if (value.kind === "ValueRange") return { ...value };
  return { ...value, values: [...value.values] };
};

export const cloneFeature = (feature: Feature): Feature => ({
  ...feature,
  id: uid(),
  values: feature.values.map(cloneFeatureValue),
  tags: [...feature.tags],
});

export const cloneFeatures = (features: Feature[]): Feature[] => features.map(cloneFeature);

export const defaultSchemaTemplate = (): ProductSchema => {
  const timestamp = new Date().toISOString();
  return {
    id: uid(),
    name: "New Product Schema",
    description: "",
    category: "transport",
    tags: [],
    assignedCollections: [],
    featureTemplates: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};
const unique = <T,>(values: T[]) => Array.from(new Set(values));

export const resolveCollectionMembers = (collectionIds: string[], collections: Collection[]): string[] => {
  const lookup = new Map(collections.map((collection) => [collection.id, collection.members] as const));
  return unique(collectionIds.flatMap((collectionId) => lookup.get(collectionId) ?? []));
};

export const defaultProductFromSchema = (schema: ProductSchema, collections: Collection[]): Product => ({
  id: uid(),
  name: `${schema.name} Product`,
  type: schemaCategoryLabel(schema.category),
  lifecycleStatus: "Draft",
  features: cloneFeatures(schema.featureTemplates),
  tags: unique([...schema.tags, ...resolveCollectionMembers(schema.assignedCollections, collections)]),
  additionalInfo: {},
});

export const instantiateProduct = (schema: ProductSchema, collections: Collection[]): ProductInstance => {
  const timestamp = new Date().toISOString();
  return {
    id: uid(),
    schemaId: schema.id,
    product: defaultProductFromSchema(schema, collections),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const randomSuffix = () => uid().toUpperCase();

export const defaultScopeDefinition = (): ScopeDefinition => ({
  channels: [],
  markets: [],
  customerSegments: [],
});

export const createRule = (name = "New Rule"): Rule => {
  const timestamp = new Date().toISOString();
  const ruleId = `R-${randomSuffix()}`;
  return {
    id: uid(),
    ruleId,
    name,
    description: "",
    type: "AvailabilityConstraint",
    priority: 10,
    context: {
      contextId: `CTX-${randomSuffix()}`,
      bindings: {},
    },
    expression: {
      kind: "Compound",
      expressionId: `EXP-${randomSuffix()}`,
      operator: "AND",
      description: "",
      children: [],
    },
    targets: [],
    scope: {
      scopeId: `SCOPE-${randomSuffix()}`,
      description: "",
      definition: defaultScopeDefinition(),
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const createRuleLink = (ruleRef: string, kind: RuleLinkKind): RuleLink => {
  const timestamp = new Date().toISOString();
  return {
    id: uid(),
    ruleRef,
    kind,
    targetId: kind === "Global" ? undefined : "",
    description: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const createIndianMealRule = (): Rule => {
  const timestamp = new Date().toISOString();
  return {
    id: uid(),
    ruleId: "R-INDIAN-001",
    name: "Indian meal blackout on EU→NA transports",
    description: "Disable Indian cuisine selections for EU→NA transports during the blackout window.",
    type: "AvailabilityConstraint",
    priority: 10,
    context: {
      contextId: "CTX-1",
      bindings: {
        transport: "CDG-JFK transport segment",
        offer: "OFF-9876 offer snapshot",
      },
    },
    expression: {
      kind: "Compound",
      expressionId: "EXP-INDIAN-ROOT",
      operator: "AND",
      description: "Transport touches Europe and North America AND date in blackout window",
      children: [
        {
          kind: "Compound",
          expressionId: "EXP-INDIAN-ROUTE",
          operator: "AND",
          description: "Transport tagged with both Europe and North America regions",
          children: [
            {
              kind: "Taxonomy",
              expressionId: "EXP-INDIAN-ROUTE-EU",
              taxonomyConceptId: "apmwg:1HJT7649KP",
              taxonomyScheme: "apmwg:product_taxonomy_scheme",
              subjectRef: "transport",
              selectionScope: "ANY_SELECTED",
              description: "Transport segment tagged with Europe",
            },
            {
              kind: "Taxonomy",
              expressionId: "EXP-INDIAN-ROUTE-NA",
              taxonomyConceptId: "apmwg:OSHGFC67",
              taxonomyScheme: "apmwg:product_taxonomy_scheme",
              subjectRef: "transport",
              selectionScope: "ANY_SELECTED",
              description: "Transport segment tagged with North America",
            },
          ],
        },
        {
          kind: "Taxonomy",
          expressionId: "EXP-INDIAN-CUISINE",
          taxonomyConceptId: "apmwg:66B0BOM6",
          taxonomyScheme: "apmwg:product_taxonomy_scheme",
          subjectRef: "currentProduct",
          selectionScope: "ANY_SELECTED",
          description: "Product tagged as Indian cuisine",
        },
        {
          kind: "DateTime",
          expressionId: "EXP-INDIAN-DATE",
          subjectRef: "offer",
          operator: "IN",
          value: "2025-10-01/2025-12-31",
          description: "Travel/service date within blackout period",
        },
      ],
    },
    targets: [
      {
        kind: "Taxonomy",
        targetId: "TARGET-INDIAN-DISABLE",
        action: "DISABLE",
        conceptId: "apmwg:66B0BOM6",
        description: "Disable all products tagged as Indian cuisine",
      },
    ],
    scope: {
      scopeId: "SCOPE-INDIAN",
      description: "EU→NA blackout period",
      definition: {
        channels: [],
        markets: ["region:EU-NA"],
        customerSegments: [],
        effectiveFrom: "2025-10-01",
        effectiveTo: "2025-12-31",
      },
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const createIndianMealRuleBundle = () => {
  const rule = createIndianMealRule();
  const link = {
    ...createRuleLink(rule.id, "Global"),
    description: "Applies to all offers during the EU↔NA blackout window",
    effectiveFrom: "2025-10-01",
    effectiveTo: "2025-12-31",
  };
  return { rule, links: [link] };
};

export const updateTimestamp = <T extends { updatedAt: string }>(item: T): T => ({
  ...item,
  updatedAt: new Date().toISOString(),
});
export const createBurgerMealRule = (): Rule => {
  const timestamp = new Date().toISOString();
  return {
    id: uid(),
    ruleId: "R-BURGER-001",
    name: "Burger meal allowed only on CDG-JFK",
    description: "American burger meals may only be selected on the CDG→JFK transport product.",
    type: "AvailabilityConstraint",
    priority: 5,
    context: {
      contextId: "CTX-BURGER",
      bindings: {
        transport: "CDG-JFK transport segment",
        currentProduct: "Burger meal product",
      },
    },
    expression: {
      kind: "Compound",
      expressionId: "EXP-BURGER-ROOT",
      operator: "AND",
      description: "Transport equals CDG-JFK AND product tagged American cuisine",
      children: [
        {
          kind: "Product",
          expressionId: "EXP-BURGER-ROUTE",
          subjectRef: "transport",
          productId: "CDG-JFK",
          operator: "EQUALS",
          description: "Transport corresponds to CDG-JFK",
        },
        {
          kind: "Taxonomy",
          expressionId: "EXP-BURGER-AMERICAN",
          taxonomyConceptId: "apmwg:1PIZRPAA",
          taxonomyScheme: "apmwg:product_taxonomy_scheme",
          subjectRef: "currentProduct",
          description: "Product tagged with American cuisine",
        },
      ],
    },
    targets: [
      {
        kind: "Product",
        targetId: "TARGET-BURGER-ALLOW",
        action: "ENABLE",
        productId: "BURGER-MEAL",
        description: "Enable burger meal product when rule matches",
      },
    ],
    scope: {
      scopeId: "SCOPE-BURGER",
      description: "Limited to CDG-JFK transport product",
      definition: {
        channels: [],
        markets: [],
        customerSegments: [],
      },
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const createBurgerMealRuleBundle = () => {
  const rule = createBurgerMealRule();
  const link = {
    ...createRuleLink(rule.id, "Product"),
    targetId: "CDG-JFK",
    description: "Burger meal restricted to CDG-JFK specified product",
  };
  return { rule, links: [link] };
};
