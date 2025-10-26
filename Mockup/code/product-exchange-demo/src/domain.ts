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
  type?: string;
  lifecycleStatus: "Draft" | "Active" | "EndOfLife";
  features: Feature[];
  tags: string[];
  additionalInfo?: Record<string, string>;
};

export type ReferenceSystem = {
  id: string;
  name: string;
  type: "CodeList" | "Unit" | "Schema";
  source?: string;
};

export type Concept = { id: string; label: string; altLabels?: string[] };
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

export const REF_SYSTEMS: ReferenceSystem[] = [
  { id: "RS-IATA", name: "IATA Airport Code", type: "CodeList", source: "IATA" },
  { id: "RS-UNIT-KG", name: "Kilogram", type: "Unit", source: "SI" },
  { id: "RS-UNIT-CM", name: "Centimeter", type: "Unit", source: "SI" },
];

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
    featureTemplates: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const defaultProductFromSchema = (schema: ProductSchema): Product => ({
  id: uid(),
  name: `${schema.name} Product`,
  type: schemaCategoryLabel(schema.category),
  lifecycleStatus: "Draft",
  features: cloneFeatures(schema.featureTemplates),
  tags: [...schema.tags],
  additionalInfo: {},
});

export const instantiateProduct = (schema: ProductSchema): ProductInstance => {
  const timestamp = new Date().toISOString();
  return {
    id: uid(),
    schemaId: schema.id,
    product: defaultProductFromSchema(schema),
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
