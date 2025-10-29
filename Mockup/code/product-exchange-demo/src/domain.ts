export type SingleValue = { kind: "SingleValue"; value: string; referenceSystemId?: string };
export type ValueRange = { kind: "ValueRange"; min: string; max: string; referenceSystemId?: string };
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

export type ReferenceSystemType =
  | "Measurement"
  | "Enumeration"
  | "CodeSystem"
  | "ColorSystem"
  | "Schema"
  | "Other";

type ReferenceSourceBase = {
  authority: string;
  resourceName: string;
  resourceType: string;
};

export type ExternalReferenceSource = ReferenceSourceBase & {
  kind: "External";
  url: string;
};

export type InternalReferenceSource = ReferenceSourceBase & {
  kind: "Internal";
  repositoryName: string;
  version: string;
};

export type ReferenceSource = ExternalReferenceSource | InternalReferenceSource;

export type ReferenceSystem = {
  id: string;
  identifier: string;
  description: string;
  systemType: ReferenceSystemType;
  source: ReferenceSource;
  createdAt: string;
  updatedAt: string;
};

export type ReferenceSystemDraft = {
  identifier: string;
  description: string;
  systemType: ReferenceSystemType;
  source: ReferenceSource;
};

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
};
export type ConceptScheme = { id: string; label: string; topConcepts: string[] };
export type Collection = { id: string; label: string; members: string[] };

export type Mapping = { fromConceptId: string; toConceptId: string; relation: "exactMatch" | "closeMatch" };

export type TaxonomyCondition = { kind: "HasConcept"; conceptId: string; target: "Product" | "Feature" | "FeatureValue" };
export type FeatureCondition =
  | { kind: "FeatureExists"; featureName: string }
  | { kind: "ValueInRange"; featureName: string; min?: number; max?: number };

export type Rule = {
  id: string;
  name: string;
  conditions: (TaxonomyCondition | FeatureCondition)[];
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
      source: {
        kind: "External",
        authority: "IATA",
        resourceName: "IATA Airline and Airport Code Directory",
        resourceType: "CodeList",
        url: "https://www.iata.org/en/publications/directories/code-search/?airport.search=",
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      identifier: "RS-UNECE-REC20-001",
      id: "RS-UNECE-REC20-001",
      description: "UNECE Recommendation 20 – Measurement units",
      systemType: "Measurement",
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
  { id: "C-Flight", label: "Flight" },
  { id: "C-PriorityBoarding", label: "Priority boarding" },
  { id: "C-Baggage", label: "Baggage" },
  { id: "C-Origin", label: "Origin airport" },
  { id: "C-Destination", label: "Destination airport" },
  { id: "C-Seat", label: "Seat assignment" },
];

export const CONCEPT_SCHEMES: ConceptScheme[] = [
  { id: "SCH-Airline", label: "Airline Services", topConcepts: ["C-Flight", "C-Baggage", "C-Seat"] },
];

export const COLLECTIONS: Collection[] = [
  { id: "COL-Ancillaries", label: "Ancillary Services", members: ["C-PriorityBoarding", "C-Seat"] },
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

export const createRule = (name: string): Rule => ({
  id: uid(),
  name,
  conditions: [],
});

export const updateTimestamp = <T extends { updatedAt: string }>(item: T): T => ({
  ...item,
  updatedAt: new Date().toISOString(),
});
