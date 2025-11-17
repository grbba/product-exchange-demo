import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState, lazy } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  Divider,
  Drawer,
  IconButton,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  ListItemText,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import type { AlertColor } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import UploadIcon from "@mui/icons-material/Upload";
import AddIcon from "@mui/icons-material/Add";
import SendIcon from "@mui/icons-material/Send";
import CachedIcon from "@mui/icons-material/Cached";
import CloseIcon from "@mui/icons-material/Close";
import { ThemeProvider, createTheme } from "@mui/material/styles";

const CONFIGURED_API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? null;
const CONFIGURED_API_PORT = (import.meta.env.VITE_API_PORT as string | undefined) ?? "5175";

const SchemaWorkspace = lazy(() => import("./components/SchemaWorkspace"));
const ProductWorkspace = lazy(() => import("./components/ProductWorkspace"));
const TaxonomyWorkspace = lazy(() => import("./components/TaxonomyWorkspace"));
const ReferenceSystemWorkspace = lazy(() => import("./components/ReferenceSystemWorkspace"));
const RulesWorkspace = lazy(() => import("./components/RulesWorkspace"));
const SettingsWorkspace = lazy(() => import("./components/SettingsWorkspace"));
import {
  COLLECTIONS,
  CONTEXT_REFS,
  DEFAULT_CONCEPTS,
  REFERENCE_SYSTEM_TYPES,
  SCHEMA_CATEGORIES,
  createExternalReferenceSource,
  createRule,
  createTaxonomyReferenceSource,
  defaultReferenceSystems,
  defaultSchemaTemplate,
  instantiateProduct,
  normalizeAppSettings,
  resolveCollectionMembers,
  schemaCategoryLabel,
  updateTimestamp,
  uid,
} from "./domain";
import type {
  AppSettings,
  Collection,
  Concept,
  ContextRef,
  Partner,
  PartnerProductMap,
  PartnerRole,
  Product,
  ProductInstance,
  ProductSchema,
  InternalReferenceSource,
  Feature,
  FeatureExpression,
  LogicalExpression,
  LogicalOperator,
  ReferenceSource,
  ReferenceSystem,
  ReferenceSystemType,
  ReferenceSystemDraft,
  Rule,
  RuleLink,
  RuleLinkKind,
  RuleScope,
  RuleTarget,
  SchemaCategory,
  TaxonomyConceptSetReference,
} from "./domain";
import { useTaxonomy } from "./taxonomy";
import type { TaxonomyMetadata } from "./taxonomy";
import {
  loadInstances,
  loadPartnerProducts,
  loadPartners,
  loadReferenceSystems,
  loadRuleLinks,
  loadRules,
  loadSettings,
  loadSchemas,
  persistInstances,
  persistPartnerProducts,
  persistPartners,
  persistReferenceSystems,
  persistRuleLinks,
  persistRules,
  persistSettings,
  persistSchemas,
} from "./storage";

type RetailerPayload = { receivedAt: string; product: Product };

type WebhookDispatchLog = {
  id: string;
  timestamp: string;
  target: string;
  kind: string;
  ok: boolean;
  status?: number;
  statusText?: string;
  bodyPreview?: string;
  error?: string;
};

type WebhookInboxEvent = {
  id: string;
  channelId: string;
  receivedAt: string;
  payload: unknown;
  headers: Record<string, string>;
};

type SendScopeMode = "all" | "selected";

const MAPPINGS = [
  { fromConceptId: "apmwg:C-PriorityBoarding", toConceptId: "apmwg:C-PriorityBoarding" },
  { fromConceptId: "apmwg:C-Flight", toConceptId: "apmwg:C-Flight" },
];

const WorkspaceFallback: React.FC<{ label: string }> = ({ label }) => (
  <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
    <Typography variant="body2" color="text.secondary">
      {`Loading ${label}…`}
    </Typography>
  </Box>
);

const downloadJson = (fileName: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const ensureReferenceSystemType = (value: unknown): ReferenceSystemType =>
  (REFERENCE_SYSTEM_TYPES.includes(value as ReferenceSystemType) ? (value as ReferenceSystemType) : "Other");

const normalizeReferenceSource = (source: unknown): ReferenceSource => {
  if (!source || typeof source !== "object") {
    return createExternalReferenceSource();
  }
  const candidate = source as Record<string, unknown>;
  if (candidate.kind === "Internal") {
    const base = {
      kind: "Internal" as const,
      authority: (candidate.authority as string) ?? "",
      resourceName: (candidate.resourceName as string) ?? "",
      resourceType: (candidate.resourceType as string) ?? "",
      repositoryName: (candidate.repositoryName as string) ?? "",
      repositoryVersion: ((candidate.repositoryVersion ?? candidate.version) as string) ?? "",
      lifecycleState: (candidate.lifecycleState as InternalReferenceSource["lifecycleState"]) ?? "draft",
      selectionPolicy: (candidate.selectionPolicy as InternalReferenceSource["selectionPolicy"]) ?? "fixed_set",
    };

    if (candidate.repositoryType === "CodeSet") {
      const values = Array.isArray(candidate.values) ? (candidate.values as unknown[]) : [];
      return {
        ...base,
        repositoryType: "CodeSet",
        values: values.filter((item): item is { code: string; label?: string } =>
          typeof item === "object" && !!item && typeof (item as { code?: unknown }).code === "string"
        ) as { code: string; label?: string }[],
        defaultCode: typeof candidate.defaultCode === "string" ? (candidate.defaultCode as string) : undefined,
      };
    }

    const taxonomy = createTaxonomyReferenceSource();
    return {
      ...taxonomy,
      ...base,
      conceptSchemeUri: (candidate.conceptSchemeUri as string) ?? "",
      anchorConceptIds: Array.isArray(candidate.anchorConceptIds)
        ? (candidate.anchorConceptIds as string[])
        : [],
      closurePolicy: (candidate.closurePolicy as TaxonomyConceptSetReference["closurePolicy"]) ?? "individual",
      representation: (candidate.representation as TaxonomyConceptSetReference["representation"]) ?? "id",
      labelPolicy: (candidate.labelPolicy as TaxonomyConceptSetReference["labelPolicy"]) ?? "resolve_at_read",
      versionBinding: (candidate.versionBinding as TaxonomyConceptSetReference["versionBinding"]) ?? "record_taxonomy_version",
    };
  }

  const external = createExternalReferenceSource();
  return {
    ...external,
    authority: (candidate.authority as string) ?? "",
    resourceName: (candidate.resourceName as string) ?? "",
    resourceType: (candidate.resourceType as string) ?? "",
    url: (candidate.url as string) ?? "",
    format: typeof candidate.format === "string" ? (candidate.format as string) : undefined,
    accessProtocol: typeof candidate.accessProtocol === "string" ? (candidate.accessProtocol as string) : undefined,
  };
};

const normalizeReferenceSystem = (system: unknown): ReferenceSystem => {
  const candidate = (system && typeof system === "object" ? (system as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  const createdAt = (candidate.createdAt as string) ?? new Date().toISOString();
  const updatedAt = (candidate.updatedAt as string) ?? createdAt;
  return {
    id: (candidate.id as string) ?? uid(),
    identifier: (candidate.identifier as string) ?? "",
    description: (candidate.description as string) ?? "",
    systemType: ensureReferenceSystemType(candidate.systemType),
    cardinality: candidate.cardinality === "multiple" ? "multiple" : "single",
    source: normalizeReferenceSource(candidate.source),
    createdAt,
    updatedAt,
    validationProvider: candidate.validationProvider === "amadeus-airport" ? "amadeus-airport" : undefined,
  };
};

const normalizeRule = (rule: Rule): Rule => {
  const createdAt = rule.createdAt ?? new Date().toISOString();
  const updatedAt = rule.updatedAt ?? createdAt;
  return { ...rule, createdAt, updatedAt };
};

type StoredRuleLink = RuleLink & { ruleId?: string };

const normalizeRuleLink = (link: StoredRuleLink): RuleLink => {
  const { ruleId: legacyRuleId, ...rest } = link;
  const createdAt = rest.createdAt ?? new Date().toISOString();
  const updatedAt = rest.updatedAt ?? createdAt;
  const kind: RuleLinkKind = rest.kind === "Schema" || rest.kind === "Product" ? rest.kind : "Global";
  const ruleRef = rest.ruleRef ?? legacyRuleId ?? "";
  return {
    ...rest,
    id: rest.id ?? uid(),
    ruleRef,
    kind,
    targetId: kind === "Global" ? undefined : rest.targetId ?? "",
    description: rest.description ?? "",
    effectiveFrom: rest.effectiveFrom,
    effectiveTo: rest.effectiveTo,
    createdAt,
    updatedAt,
  };
};

const isRuleLinkActive = (link: RuleLink, now: number) => {
  const start = link.effectiveFrom ? Date.parse(link.effectiveFrom) : undefined;
  const end = link.effectiveTo ? Date.parse(link.effectiveTo) : undefined;
  if (!Number.isFinite(start ?? NaN) && link.effectiveFrom) return true;
  if (!Number.isFinite(end ?? NaN) && link.effectiveTo) return true;
  if (typeof start === "number" && now < start) return false;
  if (typeof end === "number" && now > end) return false;
  return true;
};

type RuleEvaluationStatus = "pass" | "fail" | "unknown";
type RuleEvaluationResult = {
  internalId: string;
  ruleId: string;
  name: string;
  status: RuleEvaluationStatus;
  details: string[];
};

const formatEffectivityWindow = (from?: string, to?: string) => {
  if (!from && !to) return null;
  if (from && to) return `${from} → ${to}`;
  return from ? `${from} → …` : `… → ${to}`;
};

const addDetail = (details: string[], depth: number, message: string) => {
  details.push(`${"  ".repeat(depth)}${message}`);
};

const combineStatuses = (operator: LogicalOperator, statuses: RuleEvaluationStatus[]): RuleEvaluationStatus => {
  const summary = statuses.reduce(
    (acc, status) => {
      acc[status] += 1;
      return acc;
    },
    { pass: 0, fail: 0, unknown: 0 } as Record<RuleEvaluationStatus, number>
  );
  switch (operator) {
    case "AND":
      if (summary.fail > 0) return "fail";
      if (summary.unknown > 0) return "unknown";
      return "pass";
    case "OR":
      if (summary.pass > 0) return "pass";
      if (summary.unknown > 0) return "unknown";
      return "fail";
    case "NOT": {
      const [first] = statuses;
      if (!first || first === "unknown") return "unknown";
      return first === "pass" ? "fail" : "pass";
    }
    case "XOR":
      if (summary.unknown > 0) return "unknown";
      return summary.pass === 1 ? "pass" : "fail";
    case "NAND":
      if (summary.fail > 0) return "pass";
      if (summary.unknown > 0) return "unknown";
      return "fail";
    case "NOR":
      if (summary.pass > 0) return "fail";
      if (summary.unknown > 0) return "unknown";
      return "pass";
    default:
      return "unknown";
  }
};

const getFeatureValues = (feature: Feature): string[] => {
  const collected: string[] = [];
  for (const value of feature.values) {
    if (value.kind === "SingleValue") {
      collected.push(String(value.value));
    } else if (value.kind === "ValueRange") {
      collected.push(`${value.min}-${value.max}`);
    } else if (value.kind === "DiscreteSet") {
      collected.push(...value.values.map((entry) => String(entry)));
    }
  }
  return collected;
};

const findFeatureByIdentifier = (product: Product, identifier: string) =>
  product.features.find((feature) => feature.id === identifier || feature.name === identifier);

const evaluateFeatureExpression = (
  expression: FeatureExpression,
  product: Product,
  details: string[],
  depth: number,
  conceptLabelFn: (id: string) => string
): RuleEvaluationStatus => {
  const feature = findFeatureByIdentifier(product, expression.featureId);
  if (!feature) {
    addDetail(details, depth, `? Feature '${expression.featureId}' not found on product`);
    return "unknown";
  }
  const featureLabel = feature.name || feature.id || expression.featureId;
  const values = getFeatureValues(feature);
  const targetValue = expression.value ?? "";
  const log = (passed: boolean, message: string) =>
    addDetail(details, depth, `${passed ? "✓" : "✗"} ${message}`);

  let result: RuleEvaluationStatus = "pass";
  const needsValue =
    expression.operator === "EQUALS" ||
    expression.operator === "NOT_EQUALS" ||
    expression.operator === "LESS_THAN" ||
    expression.operator === "LESS_THAN_OR_EQUAL" ||
    expression.operator === "GREATER_THAN" ||
    expression.operator === "GREATER_THAN_OR_EQUAL" ||
    expression.operator === "IN" ||
    expression.operator === "NOT_IN" ||
    expression.operator === "CONTAINS" ||
    expression.operator === "NOT_CONTAINS" ||
    expression.operator === "STARTS_WITH" ||
    expression.operator === "ENDS_WITH" ||
    expression.operator === "MATCHES_PATTERN";

  if (needsValue && !expression.value) {
    if (!expression.featureTagId) {
      addDetail(details, depth, "? Provide a value or require a taxonomy tag for this feature");
      return "unknown";
    }
    addDetail(details, depth, `⚠ Skipping value comparison for ${featureLabel} (no value provided)`);
  } else {
    switch (expression.operator) {
      case "EQUALS": {
        const passes = values.some((value) => value === targetValue);
        log(passes, `${featureLabel} equals '${targetValue}'`);
        result = passes ? "pass" : "fail";
        break;
      }
      case "NOT_EQUALS": {
        const passes = values.every((value) => value !== targetValue);
        log(passes, `${featureLabel} not equal to '${targetValue}'`);
        result = passes ? "pass" : "fail";
        break;
      }
      case "EXISTS": {
        const passes = values.length > 0;
        log(passes, `${featureLabel} has at least one value`);
        result = passes ? "pass" : "fail";
        break;
      }
      case "NOT_EXISTS": {
        const passes = values.length === 0;
        log(passes, `${featureLabel} has no values`);
        result = passes ? "pass" : "fail";
        break;
      }
      case "CONTAINS": {
        const passes = values.some((value) => value.includes(targetValue));
        log(passes, `${featureLabel} contains '${targetValue}'`);
        result = passes ? "pass" : "fail";
        break;
      }
      case "NOT_CONTAINS": {
        const passes = values.every((value) => !value.includes(targetValue));
        log(passes, `${featureLabel} does not contain '${targetValue}'`);
        result = passes ? "pass" : "fail";
        break;
      }
      default:
        addDetail(details, depth, `? Operator '${expression.operator}' not supported for feature conditions`);
        return "unknown";
    }
  }

  if (expression.featureTagId) {
    const hasTag = feature.tags.includes(expression.featureTagId);
    const tagLabel = conceptLabelFn(expression.featureTagId) || expression.featureTagId;
    log(hasTag, `${featureLabel} tagged with '${tagLabel}'`);
    if (!hasTag) {
      return "fail";
    }
  }

  return result;
};

const evaluateLogicalExpression = (
  expression: LogicalExpression,
  product: Product,
  details: string[],
  conceptLabelFn: (id: string) => string,
  depth = 0
): RuleEvaluationStatus => {
  if (expression.kind === "Compound") {
    addDetail(
      details,
      depth,
      `Compound (${expression.operator})${expression.description ? ` – ${expression.description}` : ""}`
    );
    if (!expression.children.length) {
      addDetail(details, depth + 1, "⚠ No child expressions defined");
      return "unknown";
    }
    const childStatuses = expression.children.map((child) =>
      evaluateLogicalExpression(child, product, details, conceptLabelFn, depth + 1)
    );
    const result = combineStatuses(expression.operator, childStatuses);
    addDetail(details, depth, `Result: ${result.toUpperCase()}`);
    return result;
  }

  if (expression.kind === "Taxonomy") {
    const label = conceptLabelFn(expression.taxonomyConceptId) || expression.taxonomyConceptId;
    const descriptor = expression.description ?? `Taxonomy concept ${label}`;
    if (expression.subjectRef === "currentProduct") {
      const hasConcept = product.tags.includes(expression.taxonomyConceptId);
      addDetail(details, depth, `${hasConcept ? "✓" : "✗"} ${descriptor} (${label}) on current product`);
      return hasConcept ? "pass" : "fail";
    }
    addDetail(
      details,
      depth,
      `? ${descriptor} (${label}) requires '${expression.subjectRef}' context (not available in demo)`
    );
    return "unknown";
  }

  if (expression.kind === "DateTime") {
    const label = expression.description ?? "Date/time condition";
    addDetail(
      details,
      depth,
      `? ${label} (${expression.value || "no value"}) requires temporal context that is not modelled in the demo`
    );
    return "unknown";
  }

  if (expression.kind === "Feature") {
    return evaluateFeatureExpression(expression, product, details, depth, conceptLabelFn);
  }

  if (expression.kind === "Product") {
    addDetail(details, depth, "? Product condition evaluation not implemented in the demo");
    return "unknown";
  }

  if (expression.kind === "Quantity") {
    addDetail(details, depth, "? Quantity condition evaluation not implemented in the demo");
    return "unknown";
  }

  addDetail(details, depth, `? Unsupported expression kind '${(expression as LogicalExpression).kind}'`);
  return "unknown";
};

const describeTarget = (target: RuleTarget, conceptLabelFn: (id: string) => string) => {
  if (target.kind === "Taxonomy") {
    const label = conceptLabelFn(target.conceptId) || target.conceptId;
    const suffix = target.description ? ` – ${target.description}` : "";
    return `Target ${target.targetId}: ${target.action} taxonomy concept ${label}${suffix}`;
  }
  const suffix = target.description ? ` – ${target.description}` : "";
  return `Target ${target.targetId}: ${target.action} product ${target.productId}${suffix}`;
};

const describeScope = (scope?: RuleScope): string[] => {
  if (!scope) return [];
  const lines: string[] = [
    `Scope ${scope.scopeId}${scope.description ? ` – ${scope.description}` : ""}`,
  ];
  const parts: string[] = [];
  if (scope.definition.channels.length) parts.push(`Channels: ${scope.definition.channels.join(", ")}`);
  if (scope.definition.markets.length) parts.push(`Markets: ${scope.definition.markets.join(", ")}`);
  if (scope.definition.customerSegments.length) {
    parts.push(`Segments: ${scope.definition.customerSegments.join(", ")}`);
  }
  const window = [scope.definition.effectiveFrom, scope.definition.effectiveTo].filter(Boolean);
  if (window.length) parts.push(`Effective: ${window.join(" → ")}`);
  if (parts.length) {
    lines.push(`  ${parts.join(" | ")}`);
  }
  return lines;
};

const evaluateRules = (product: Product, rules: Rule[], conceptLabelFn: (id: string) => string): RuleEvaluationResult[] =>
  rules.map((rule) => {
    const details: string[] = [];
    details.push(`Type ${rule.type} · Priority ${rule.priority}`);
    if (rule.description) {
      details.push(rule.description);
    }
    const bindings = Object.entries(rule.context.bindings);
    details.push(
      bindings.length
        ? `Context bindings: ${bindings.map(([ref, value]) => `${ref} → ${value || "n/a"}`).join("; ")}`
        : "Context bindings: none"
    );

    const status = evaluateLogicalExpression(rule.expression, product, details, conceptLabelFn, 0);

    if (rule.targets.length) {
      for (const target of rule.targets) {
        details.push(describeTarget(target, conceptLabelFn));
      }
    } else {
      details.push("⚠ No targets defined");
    }

    details.push(...describeScope(rule.scope));

    return {
      internalId: rule.id,
      ruleId: rule.ruleId,
      name: rule.name,
      status,
      details,
    };
  });

const App: React.FC = () => {
  const theme = useMemo(
    () =>
      createTheme({
        palette: { mode: "light" },
        typography: { fontSize: 12 },
      }),
    []
  );

  const [tab, setTab] = useState(0);

  const [schemas, setSchemas] = useState<ProductSchema[]>(() => {
    const stored = loadSchemas();
    if (stored.length) {
      return stored.map((schema) => ({
        ...schema,
        assignedCollections: schema.assignedCollections ?? [],
      }));
    }
    const schema = defaultSchemaTemplate();
    schema.name = "New Product Schema";
    return [schema];
  });
  const [instances, setInstances] = useState<ProductInstance[]>(() => loadInstances());
  const [referenceSystems, setReferenceSystems] = useState<ReferenceSystem[]>(() => {
    const stored = loadReferenceSystems();
    if (stored.length) return stored.map((item) => normalizeReferenceSystem(item));
    return defaultReferenceSystems().map((item) => normalizeReferenceSystem(item));
  });
  const [partners, setPartners] = useState<Partner[]>(() => loadPartners());
  const [partnerAssociations, setPartnerAssociations] = useState<PartnerProductMap>(() => loadPartnerProducts());
  const [selectedRetailPartnerId, setSelectedRetailPartnerId] = useState<string | null>(null);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerExternalId, setNewPartnerExternalId] = useState("");
  const [newPartnerRoles, setNewPartnerRoles] = useState<Record<PartnerRole, boolean>>({
    supplier: false,
    retailer: false,
  });

  const [schemaSelection, setSchemaSelection] = useState<string | null>(schemas[0]?.id ?? null);
  const [productSchemaSelection, setProductSchemaSelection] = useState<string | null>(schemas[0]?.id ?? null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    instances.find((instance) => instance.schemaId === productSchemaSelection)?.id ?? null
  );
  const [productSendMode, setProductSendMode] = useState<SendScopeMode>("selected");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() =>
    selectedInstanceId ? [selectedInstanceId] : []
  );
  const [schemaSendMode, setSchemaSendMode] = useState<SendScopeMode>("all");
  const [selectedSchemaIds, setSelectedSchemaIds] = useState<string[]>([]);
  const [ruleSendMode, setRuleSendMode] = useState<SendScopeMode>("all");
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [runDrawerOpen, setRunDrawerOpen] = useState(false);
  const [runDrawerFilterRuleId, setRunDrawerFilterRuleId] = useState<string | null>(null);
  const [referenceSystemSendMode, setReferenceSystemSendMode] = useState<SendScopeMode>("all");
  const [selectedReferenceSystemIds, setSelectedReferenceSystemIds] = useState<string[]>([]);

  const [settings, setSettings] = useState<AppSettings>(() => normalizeAppSettings(loadSettings()));

  const taxonomy = useTaxonomy(DEFAULT_CONCEPTS, COLLECTIONS, settings.defaultTaxonomyId);
  const {
    concepts,
    collections,
    conceptLabel,
    orderedConcepts,
    setConcepts: setTaxonomyConcepts,
    setCollections: setTaxonomyCollections,
    setMetadata: setTaxonomyMetadata,
    metadata: taxonomyMetadata,
    reloadFromSource: reloadTaxonomyFromSource,
    source: defaultTaxonomySource,
  } = taxonomy;

  const conceptExchangeLookup = useMemo(() => {
    const lookup = new Map<string, Concept>();
    concepts.forEach((concept) => {
      lookup.set(concept.id, concept);
      if (concept.qualifiedId) {
        lookup.set(concept.qualifiedId, concept);
      }
    });
    return lookup;
  }, [concepts]);

  const taxonomyNamespaces = useMemo(() => {
    const entries = new Map<string, string>();
    concepts.forEach((concept) => {
      if (concept.namespace && concept.namespacePrefix) {
        entries.set(concept.namespacePrefix, concept.namespace);
      }
    });
    if (!entries.size && taxonomyMetadata?.namespace && taxonomyMetadata?.namespacePrefix) {
      entries.set(taxonomyMetadata.namespacePrefix, taxonomyMetadata.namespace);
    }
    return Array.from(entries.entries()).map(([prefix, namespace]) => ({ prefix, namespace }));
  }, [concepts, taxonomyMetadata]);

  const formatTagForExchange = useCallback(
    (tag: string) => {
      if (!tag) return tag;
      const concept = conceptExchangeLookup.get(tag);
      if (concept?.qualifiedId) {
        return concept.qualifiedId;
      }
      if (concept?.namespacePrefix) {
        const local =
          concept.id.startsWith(`${concept.namespacePrefix}:`)
            ? concept.id.slice(concept.namespacePrefix.length + 1)
            : concept.id;
        return `${concept.namespacePrefix}:${local}`;
      }
      if (taxonomyMetadata?.namespacePrefix && !tag.includes(":")) {
        return `${taxonomyMetadata.namespacePrefix}:${tag}`;
      }
      return tag;
    },
    [conceptExchangeLookup, taxonomyMetadata]
  );

  const translateProductForExchange = useCallback(
    (product: Product): Product => ({
      ...product,
      tags: product.tags.map((tag) => formatTagForExchange(tag)),
      features: product.features.map((feature) => ({
        ...feature,
        tags: feature.tags.map((tag) => formatTagForExchange(tag)),
      })),
    }),
    [formatTagForExchange]
  );

  const retailerPartners = useMemo(
    () => partners.filter((partner) => partner.roles.includes("retailer")),
    [partners]
  );
  const selectedPartnerProducts = selectedRetailPartnerId
    ? partnerAssociations[selectedRetailPartnerId] ?? []
    : [];

  const ruleCatalogue = useMemo(() => {
    const storedRules = loadRules();
    const storedLinks = loadRuleLinks();
    if (storedRules.length || storedLinks.length) {
      const normalizedRules = storedRules.map((rule) => normalizeRule(rule));
      const validRuleRefs = new Set(normalizedRules.map((rule) => rule.id));
      const normalizedLinks = storedLinks
        .map((link) => normalizeRuleLink(link as StoredRuleLink))
        .filter((link) => validRuleRefs.has(link.ruleRef));
      return { rules: normalizedRules, links: normalizedLinks };
    }
    const starterRule = createRule("Sample availability rule");
    starterRule.description = "Use the Add Condition wizard to build your first rule.";
    return { rules: [starterRule], links: [] };
  }, []);

  const [rules, setRules] = useState<Rule[]>(ruleCatalogue.rules);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(
    ruleCatalogue.rules[0]?.id ?? null
  );
  const [ruleLinks, setRuleLinks] = useState<RuleLink[]>(ruleCatalogue.links);
  const [webhookDestination, setWebhookDestination] = useState(settings.channel.destinationUrl);
  const webhookDestinationRef = useRef(webhookDestination);
  const [webhookLogs, setWebhookLogs] = useState<WebhookDispatchLog[]>([]);
  const [webhookDispatching, setWebhookDispatching] = useState(false);
  const [webhookInbox, setWebhookInbox] = useState<WebhookInboxEvent[]>([]);
  const [webhookInboxLoading, setWebhookInboxLoading] = useState(false);
  const [inboxApplyingId, setInboxApplyingId] = useState<string | null>(null);
  const inboxFetchInFlight = useRef(false);

  const [retailerPayload, setRetailerPayload] = useState<RetailerPayload | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: AlertColor }>({
    open: false,
    message: "",
    severity: "info",
  });
  const notify = useCallback((message: string, severity: AlertColor = "info") => {
    setSnack({ open: true, message, severity });
  }, []);
  const handleSaveSettings = (next: AppSettings) => {
    setSettings(next);
    persistSettings(next);
    notify("Settings saved", "success");
  };

  useEffect(() => {
    setWebhookDestination(settings.channel.destinationUrl);
    webhookDestinationRef.current = settings.channel.destinationUrl;
  }, [settings.channel.destinationUrl]);

  useEffect(() => {
    const validIds = new Set(instances.map((instance) => instance.id));
    setSelectedProductIds((current) => {
      const filtered = current.filter((id) => validIds.has(id));
      if (productSendMode === "selected") {
        if (filtered.length) return filtered;
        if (selectedInstanceId && validIds.has(selectedInstanceId)) return [selectedInstanceId];
        const fallback = instances[0]?.id;
        return fallback ? [fallback] : [];
      }
      return filtered;
    });
  }, [instances, productSendMode, selectedInstanceId]);

  useEffect(() => {
    const validIds = new Set(schemas.map((schema) => schema.id));
    setSelectedSchemaIds((current) => {
      const filtered = current.filter((id) => validIds.has(id));
      if (schemaSendMode === "selected") {
        if (filtered.length) return filtered;
        const fallback = schemas[0]?.id;
        return fallback ? [fallback] : [];
      }
      return filtered;
    });
  }, [schemas, schemaSendMode]);

  useEffect(() => {
    const validIds = new Set(rules.map((rule) => rule.id));
    setSelectedRuleIds((current) => {
      const filtered = current.filter((id) => validIds.has(id));
      if (ruleSendMode === "selected") {
        if (filtered.length) return filtered;
        const fallback = rules[0]?.id;
        return fallback ? [fallback] : [];
      }
      return filtered;
    });
  }, [ruleSendMode, rules]);

  useEffect(() => {
    const validIds = new Set(referenceSystems.map((system) => system.id));
    setSelectedReferenceSystemIds((current) => {
      const filtered = current.filter((id) => validIds.has(id));
      if (referenceSystemSendMode === "selected") {
        if (filtered.length) return filtered;
        const fallback = referenceSystems[0]?.id;
        return fallback ? [fallback] : [];
      }
      return filtered;
    });
  }, [referenceSystemSendMode, referenceSystems]);

  const inboundProxyEndpoint = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/api/webhooks/inbound/${encodeURIComponent(settings.identity.instanceId)}`;
  }, [settings.identity.instanceId]);

  const inboundDirectEndpoint = useMemo(() => {
    const encoded = encodeURIComponent(settings.identity.instanceId);
    if (CONFIGURED_API_BASE) {
      return `${CONFIGURED_API_BASE}/webhooks/${encoded}`;
    }
    if (typeof window === "undefined") return "";
    return `${window.location.protocol}//${window.location.hostname}:${CONFIGURED_API_PORT}/webhooks/${encoded}`;
  }, [settings.identity.instanceId]);

  useEffect(() => {
    persistSchemas(schemas);
  }, [schemas]);

  useEffect(() => {
    persistInstances(instances);
  }, [instances]);

  useEffect(() => {
    persistReferenceSystems(referenceSystems);
  }, [referenceSystems]);

  useEffect(() => {
    persistPartners(partners);
  }, [partners]);

  useEffect(() => {
    persistPartnerProducts(partnerAssociations);
  }, [partnerAssociations]);

  useEffect(() => {
    persistRules(rules);
  }, [rules]);

  useEffect(() => {
    persistRuleLinks(ruleLinks);
  }, [ruleLinks]);

  useEffect(() => {
    setRuleLinks((previous) => {
      const valid = new Set(rules.map((rule) => rule.id));
      const filtered = previous.filter((link) => valid.has(link.ruleRef));
      return filtered.length === previous.length ? previous : filtered;
    });
  }, [rules]);

  useEffect(() => {
    setSelectedRetailPartnerId((current) => {
      if (!retailerPartners.length) return null;
      if (current && retailerPartners.some((partner) => partner.id === current)) {
        return current;
      }
      return retailerPartners[0].id;
    });
  }, [retailerPartners]);

  useEffect(() => {
    setPartnerAssociations((previous) => {
      const partnerIds = new Set(partners.map((partner) => partner.id));
      let changed = false;
      const next: PartnerProductMap = {};
      for (const [partnerId, productIds] of Object.entries(previous)) {
        if (partnerIds.has(partnerId)) {
          next[partnerId] = productIds;
        } else {
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [partners]);

  useEffect(() => {
    setPartnerAssociations((previous) => {
      const validProductIds = new Set(instances.map((instance) => instance.id));
      let changed = false;
      const next: PartnerProductMap = {};
      for (const [partnerId, productIds] of Object.entries(previous)) {
        const filtered = productIds.filter((productId) => validProductIds.has(productId));
        if (filtered.length !== productIds.length) {
          changed = true;
        }
        next[partnerId] = filtered;
      }
      return changed ? next : previous;
    });
  }, [instances]);

  useEffect(() => {
    if (schemaSelection && !schemas.some((schema) => schema.id === schemaSelection)) {
      setSchemaSelection(schemas[0]?.id ?? null);
    }
  }, [schemas, schemaSelection]);

  useEffect(() => {
    if (productSchemaSelection && !schemas.some((schema) => schema.id === productSchemaSelection)) {
      setProductSchemaSelection(schemas[0]?.id ?? null);
    }
  }, [schemas, productSchemaSelection]);

  useEffect(() => {
    if (!productSchemaSelection) {
      setSelectedInstanceId(null);
      return;
    }
    const candidates = instances.filter((instance) => instance.schemaId === productSchemaSelection);
    if (selectedInstanceId && candidates.some((instance) => instance.id === selectedInstanceId)) {
      return;
    }
    setSelectedInstanceId(candidates[0]?.id ?? null);
  }, [instances, productSchemaSelection, selectedInstanceId]);

  const selectedInstance = selectedInstanceId
    ? instances.find((instance) => instance.id === selectedInstanceId) ?? null
    : null;

  const handleCreateSchema = (category: SchemaCategory, name: string, description: string) => {
    const base = defaultSchemaTemplate();
    const schema: ProductSchema = {
      ...base,
      category,
      name,
      description,
      featureTemplates: [],
    };
    setSchemas((previous) => [...previous, schema]);
    setSchemaSelection(schema.id);
   setProductSchemaSelection(schema.id);
    notify(`Schema '${name}' created`, "success");
  };

  const handleUpdateSchema = (schemaId: string, updater: (schema: ProductSchema) => ProductSchema) => {
    setSchemas((previous) => previous.map((schema) => (schema.id === schemaId ? updater(schema) : schema)));
  };

  const handleDeleteSchema = (schemaId: string) => {
    const remainingSchemas = schemas.filter((schema) => schema.id !== schemaId);
    setSchemas(remainingSchemas);
    setInstances((previous) => previous.filter((instance) => instance.schemaId !== schemaId));
    if (schemaSelection === schemaId) {
      setSchemaSelection(remainingSchemas[0]?.id ?? null);
    }
    if (productSchemaSelection === schemaId) {
      setProductSchemaSelection(remainingSchemas[0]?.id ?? null);
    }
    notify("Schema deleted", "info");
  };

  const handleExportSchema = (schema: ProductSchema) => {
    downloadJson(`schema-${schema.name.replace(/\s+/g, "-").toLowerCase()}.json`, schema);
  };

  const handlePersistSchemas = () => {
    persistSchemas(schemas);
    notify("Schemas saved", "success");
  };

  const handleTagSchema = (schemaId: string, conceptId: string) => {
    handleUpdateSchema(schemaId, (schema) =>
      schema.tags.includes(conceptId)
        ? schema
        : updateTimestamp({ ...schema, tags: [...schema.tags, conceptId] })
    );
  };

  const handleRemoveSchemaTag = (schemaId: string, conceptId: string) => {
    handleUpdateSchema(schemaId, (schema) =>
      updateTimestamp({ ...schema, tags: schema.tags.filter((tag) => tag !== conceptId) })
    );
  };

  const handleAssignCollection = (schemaId: string, collectionId: string) => {
    const schema = schemas.find((item) => item.id === schemaId);
    if (!schema) return;
    if (schema.assignedCollections.includes(collectionId)) {
      notify("Collection already assigned", "info");
      return;
    }
    const collection = collections.find((item) => item.id === collectionId);
    if (!collection) {
      notify("Collection not found", "error");
      return;
    }

    setSchemas((previous) =>
      previous.map((current) =>
        current.id === schemaId
          ? updateTimestamp({
              ...current,
              assignedCollections: [...current.assignedCollections, collectionId],
            })
          : current
      )
    );

    setInstances((previous) =>
      previous.map((instance) => {
        if (instance.schemaId !== schemaId) return instance;
        const nextTags = new Set(instance.product.tags);
        let changed = false;
        for (const member of collection.members) {
          if (!nextTags.has(member)) {
            nextTags.add(member);
            changed = true;
          }
        }
        if (!changed) return instance;
        return updateTimestamp({
          ...instance,
          product: { ...instance.product, tags: Array.from(nextTags) },
        });
      })
    );

    notify(`Collection '${collection.label}' assigned`, "success");
  };

  const handleRemoveCollection = (schemaId: string, collectionId: string) => {
    const schema = schemas.find((item) => item.id === schemaId);
    if (!schema) return;
    if (!schema.assignedCollections.includes(collectionId)) {
      notify("Collection already removed", "info");
      return;
    }

    const remainingCollectionIds = schema.assignedCollections.filter((id) => id !== collectionId);
    const remainingMembers = new Set(resolveCollectionMembers(remainingCollectionIds, collections));
    const schemaTags = new Set(schema.tags);
    const protectedTags = new Set<string>([...remainingMembers, ...schemaTags]);

    setSchemas((previous) =>
      previous.map((current) =>
        current.id === schemaId
          ? updateTimestamp({
              ...current,
              assignedCollections: current.assignedCollections.filter((id) => id !== collectionId),
            })
          : current
      )
    );

    const collection = collections.find((item) => item.id === collectionId);
    if (collection) {
      const removable = new Set(collection.members.filter((member) => !protectedTags.has(member)));
      if (removable.size) {
        setInstances((previous) =>
          previous.map((instance) => {
            if (instance.schemaId !== schemaId) return instance;
            const nextTags = instance.product.tags.filter((tag) => !removable.has(tag));
            if (nextTags.length === instance.product.tags.length) return instance;
            return updateTimestamp({
              ...instance,
              product: { ...instance.product, tags: nextTags },
            });
          })
        );
      }
      notify(`Collection '${collection.label}' removed`, "info");
    } else {
      notify("Collection removed", "info");
    }
  };

  const handleInstantiate = (schemaId: string, name: string) => {
    const schema = schemas.find((item) => item.id === schemaId);
    if (!schema) return;
    const instance = instantiateProduct(schema, collections);
    instance.product.name = name;
    instance.product.type = schemaCategoryLabel(schema.category);
    setInstances((previous) => [...previous, instance]);
    setProductSchemaSelection(schemaId);
    setSelectedInstanceId(instance.id);
    notify(`Product '${name}' created`, "success");
  };

  const handleUpdateInstance = (instanceId: string, updater: (instance: ProductInstance) => ProductInstance) => {
    setInstances((previous) => previous.map((instance) => (instance.id === instanceId ? updater(instance) : instance)));
  };

  const handleDeleteInstance = (instanceId: string) => {
    const remainingInstances = instances.filter((instance) => instance.id !== instanceId);
    setInstances(remainingInstances);
    if (selectedInstanceId === instanceId) {
      const candidates = remainingInstances.filter((instance) => instance.schemaId === productSchemaSelection);
      setSelectedInstanceId(candidates[0]?.id ?? null);
    }
    notify("Product deleted", "info");
  };

  const handleExportInstance = (instance: ProductInstance) => {
    downloadJson(`product-${instance.product.name.replace(/\s+/g, "-").toLowerCase()}.json`, instance);
  };

  const handlePersistInstances = () => {
    persistInstances(instances);
    notify("Products saved", "success");
  };

  const handleCreateReferenceSystem = (input: ReferenceSystemDraft) => {
    const timestamp = new Date().toISOString();
    const system = normalizeReferenceSystem({
      id: uid(),
      ...input,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    setReferenceSystems((previous) => [...previous, system]);
    return system.id;
  };

  const handleUpdateReferenceSystem = (
    referenceSystemId: string,
    updater: (referenceSystem: ReferenceSystem) => ReferenceSystem
  ) => {
    setReferenceSystems((previous) =>
      previous.map((system) => (system.id === referenceSystemId ? updateTimestamp(updater(system)) : system))
    );
  };

  const handleDeleteReferenceSystem = (referenceSystemId: string) => {
    setReferenceSystems((previous) => previous.filter((system) => system.id !== referenceSystemId));
  };

  const handleToggleNewPartnerRole = (role: PartnerRole) => {
    setNewPartnerRoles((previous) => ({ ...previous, [role]: !previous[role] }));
  };

  const handleCreatePartner = () => {
    const name = newPartnerName.trim();
    const externalId = newPartnerExternalId.trim();
    if (!name || !externalId) {
      notify("Provide both partner name and ID", "error");
      return;
    }

    const roles: PartnerRole[] = [];
    if (newPartnerRoles.supplier) roles.push("supplier");
    if (newPartnerRoles.retailer) roles.push("retailer");
    if (!roles.length) {
      notify("Select at least one partner role", "error");
      return;
    }

    if (partners.some((partner) => partner.externalId.toLowerCase() === externalId.toLowerCase())) {
      notify("A partner with that ID already exists", "error");
      return;
    }

    const timestamp = new Date().toISOString();
    const partner: Partner = {
      id: uid(),
      name,
      externalId,
      roles,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setPartners((previous) => [...previous, partner]);
    setPartnerAssociations((previous) => {
      if (previous[partner.id]) return previous;
      return { ...previous, [partner.id]: [] };
    });
    setNewPartnerName("");
    setNewPartnerExternalId("");
    setNewPartnerRoles({ supplier: false, retailer: false });
    notify(`Partner '${name}' created`, "success");
  };

  const handlePartnerProductToggle = (productId: string, allow: boolean) => {
    if (!selectedRetailPartnerId) return;
    let changed = false;
    setPartnerAssociations((previous) => {
      const current = previous[selectedRetailPartnerId] ?? [];
      const alreadyIncluded = current.includes(productId);
      if (allow && alreadyIncluded) return previous;
      if (!allow && !alreadyIncluded) return previous;
      const next = allow ? [...current, productId] : current.filter((id) => id !== productId);
      changed = true;
      return { ...previous, [selectedRetailPartnerId]: next };
    });
    if (changed) {
      const timestamp = new Date().toISOString();
      setPartners((previous) =>
        previous.map((partner) =>
          partner.id === selectedRetailPartnerId ? { ...partner, updatedAt: timestamp } : partner
        )
      );
    }
  };

  const handlePersistPartnerAssociations = () => {
    persistPartnerProducts(partnerAssociations);
    notify("Partner permissions saved", "success");
  };

  const handleTagProduct = (instanceId: string, conceptId: string) => {
    handleUpdateInstance(instanceId, (instance) =>
      instance.product.tags.includes(conceptId)
        ? instance
        : updateTimestamp({
            ...instance,
            product: { ...instance.product, tags: [...instance.product.tags, conceptId] },
          })
    );
  };

  const handleRemoveProductTag = (instanceId: string, conceptId: string) => {
    handleUpdateInstance(instanceId, (instance) =>
      updateTimestamp({
        ...instance,
        product: { ...instance.product, tags: instance.product.tags.filter((tag) => tag !== conceptId) },
      })
    );
  };

  const handleCreateRule = () => {
    const newRule = createRule("New Rule");
    setRules((previous) => [...previous, newRule]);
    setSelectedRuleId(newRule.id);
  };

  const handleUpdateRuleContext = (
    ruleId: string,
    updater: (context: Rule["context"]) => Rule["context"]
  ) => {
    setRules((previous) =>
      previous.map((rule) =>
        rule.id === ruleId ? updateTimestamp({ ...rule, context: updater(rule.context) }) : rule
      )
    );
  };

  const handleChangeContextId = (ruleId: string, nextValue: string) => {
    handleUpdateRuleContext(ruleId, (context) => ({ ...context, contextId: nextValue }));
  };

  const handleAddContextBinding = (ruleId: string) => {
    handleUpdateRuleContext(ruleId, (context) => {
      const available = CONTEXT_REFS.find((ref) => context.bindings[ref] === undefined);
      if (!available) return context;
      return { ...context, bindings: { ...context.bindings, [available]: "" } };
    });
  };

  const handleChangeBindingReference = (ruleId: string, from: ContextRef, to: ContextRef) => {
    if (from === to) return;
    handleUpdateRuleContext(ruleId, (context) => {
      if (context.bindings[to] !== undefined) return context;
      const bindings = { ...context.bindings };
      const value = bindings[from];
      delete bindings[from];
      bindings[to] = value ?? "";
      return { ...context, bindings };
    });
  };

  const handleChangeBindingValue = (ruleId: string, ref: ContextRef, value: string) => {
    handleUpdateRuleContext(ruleId, (context) => ({
      ...context,
      bindings: { ...context.bindings, [ref]: value },
    }));
  };

  const handleRemoveContextBinding = (ruleId: string, ref: ContextRef) => {
    handleUpdateRuleContext(ruleId, (context) => {
      const bindings = { ...context.bindings };
      delete bindings[ref];
      return { ...context, bindings };
    });
  };

  const fallbackSchema = useMemo(() => {
    if (selectedInstance) return null;
    if (!schemas.length) return defaultSchemaTemplate();
    if (productSchemaSelection) {
      return schemas.find((schema) => schema.id === productSchemaSelection) ?? schemas[0];
    }
    return schemas[0];
  }, [selectedInstance, productSchemaSelection, schemas]);

  const activeSchemaId = selectedInstance?.schemaId ?? fallbackSchema?.id ?? null;
  const activeProduct =
    selectedInstance?.product ?? instantiateProduct(fallbackSchema ?? defaultSchemaTemplate(), collections).product;
  const activeProductId = selectedInstance?.product.id ?? null;

  const evaluationCatalogue = useMemo(() => {
    const ruleIndex = new Map(rules.map((rule) => [rule.id, rule]));
    const schemaNames = new Map(schemas.map((schema) => [schema.id, schema.name]));
    const productNames = new Map(instances.map((instance) => [instance.product.id, instance.product.name]));
    const activeAssignments = new Map<string, string[]>();
    const matchedRuleIds = new Set<string>();
    const now = Date.now();
    const addAssignment = (ruleRef: string, description: string) => {
      if (!activeAssignments.has(ruleRef)) activeAssignments.set(ruleRef, []);
      const bucket = activeAssignments.get(ruleRef)!;
      if (!bucket.includes(description)) bucket.push(description);
    };
    for (const link of ruleLinks) {
      const rule = ruleIndex.get(link.ruleRef);
      if (!rule) continue;
      if (!isRuleLinkActive(link, now)) continue;
      if (link.kind === "Global") {
        const window = formatEffectivityWindow(link.effectiveFrom, link.effectiveTo);
        addAssignment(link.ruleRef, window ? `Global (${window})` : "Global");
        matchedRuleIds.add(link.ruleRef);
        continue;
      }
      if (link.kind === "Schema") {
        if (!link.targetId || link.targetId !== activeSchemaId) continue;
        const label = schemaNames.get(link.targetId) ?? link.targetId;
        const window = formatEffectivityWindow(link.effectiveFrom, link.effectiveTo);
        addAssignment(link.ruleRef, window ? `Schema · ${label} (${window})` : `Schema · ${label}`);
        matchedRuleIds.add(link.ruleRef);
        continue;
      }
      if (link.kind === "Product") {
        if (!link.targetId || link.targetId !== activeProductId) continue;
        const label = productNames.get(link.targetId) ?? link.targetId;
        const window = formatEffectivityWindow(link.effectiveFrom, link.effectiveTo);
        addAssignment(link.ruleRef, window ? `Product · ${label} (${window})` : `Product · ${label}`);
        matchedRuleIds.add(link.ruleRef);
      }
    }
    const applicableRules = rules.filter((rule) => matchedRuleIds.has(rule.id));
    return { applicableRules, activeAssignments };
  }, [rules, ruleLinks, schemas, instances, activeSchemaId, activeProductId]);

  const ruleResults = useMemo(() => {
    const evaluated = evaluateRules(activeProduct, evaluationCatalogue.applicableRules, conceptLabel);
    return evaluated.map((result) => {
      const assignments = evaluationCatalogue.activeAssignments.get(result.internalId);
      if (!assignments || !assignments.length) return result;
      return {
        ...result,
        details: [...result.details, `Assignments: ${assignments.join(" | ")}`],
      };
    });
  }, [activeProduct, evaluationCatalogue]);

  const drawerContextRules = useMemo(() => {
    if (runDrawerFilterRuleId) {
      return rules.filter((rule) => rule.id === runDrawerFilterRuleId);
    }
    return rules;
  }, [rules, runDrawerFilterRuleId]);

  const drawerRuleResults = useMemo(() => {
    if (runDrawerFilterRuleId) {
      return ruleResults.filter((result) => result.internalId === runDrawerFilterRuleId);
    }
    return ruleResults;
  }, [ruleResults, runDrawerFilterRuleId]);

  const resolveSchemaSummary = useCallback(
    (schemaId: string) => {
      const schema = schemas.find((item) => item.id === schemaId);
      if (schema) {
        return {
          id: schema.id,
          name: schema.name,
          version: schema.updatedAt,
          updatedAt: schema.updatedAt,
        };
      }
      return { id: schemaId, name: "Unknown schema", version: "unknown", updatedAt: "" };
    },
    [schemas]
  );

  const buildProductEnvelope = useCallback(
    (instancesToSend: ProductInstance[]) => {
      if (!instancesToSend.length) return null;
      return {
        kind: "product-update" as const,
        issuedAt: new Date().toISOString(),
        identity: settings.identity,
        namespaces: taxonomyNamespaces,
        products: instancesToSend.map((instance) => ({
          instanceId: instance.id,
          schema: resolveSchemaSummary(instance.schemaId),
          product: translateProductForExchange(instance.product),
        })),
      };
    },
    [resolveSchemaSummary, settings.identity, taxonomyNamespaces, translateProductForExchange]
  );

  const buildSchemaEnvelope = useCallback(
    (schemasToSend: ProductSchema[]) => {
      if (!schemasToSend.length) return null;
      return {
        kind: "schema-catalog" as const,
        issuedAt: new Date().toISOString(),
        identity: settings.identity,
        schemas: schemasToSend,
      };
    },
    [settings.identity]
  );

  const buildTaxonomyEnvelope = useCallback(
    () => ({
      kind: "taxonomy-update",
      issuedAt: new Date().toISOString(),
      identity: settings.identity,
      concepts,
      collections,
      metadata: taxonomyMetadata,
    }),
    [concepts, collections, taxonomyMetadata, settings.identity]
  );

  const buildReferenceSystemsEnvelope = useCallback(
    (systemsToSend: ReferenceSystem[]) => {
      if (!systemsToSend.length) return null;
      return {
        kind: "reference-system-catalog" as const,
        issuedAt: new Date().toISOString(),
        identity: settings.identity,
        referenceSystems: systemsToSend,
      };
    },
    [settings.identity]
  );

  const buildRulesEnvelope = useCallback(
    (rulesToSend: Rule[], linksToSend: RuleLink[]) => {
      if (!rulesToSend.length) return null;
      return {
        kind: "rule-catalog" as const,
        issuedAt: new Date().toISOString(),
        identity: settings.identity,
        rules: rulesToSend,
        ruleLinks: linksToSend,
      };
    },
    [settings.identity]
  );

  const exportSupplierPayload = () => {
    if (!productPreviewEnvelope) return null;
    navigator.clipboard.writeText(JSON.stringify(productPreviewEnvelope, null, 2));
    notify("Payload copied to clipboard", "success");
    return productPreviewEnvelope;
  };

  const simulateRetailerIngest = (payloadText?: string) => {
    try {
      let parsed: unknown = null;
      if (payloadText) {
        parsed = JSON.parse(payloadText);
      }
      let productCandidate: Product | undefined;
      if (parsed && typeof parsed === "object") {
        const envelope = parsed as Record<string, unknown>;
        if (envelope.product && typeof envelope.product === "object") {
          productCandidate = envelope.product as Product;
        } else if (Array.isArray(envelope.products) && envelope.products[0]?.product) {
          productCandidate = (envelope.products[0] as { product?: Product }).product;
        } else if (typeof envelope.payload === "object" && envelope.payload !== null) {
          const inner = envelope.payload as Record<string, unknown>;
          if (inner.product && typeof inner.product === "object") {
            productCandidate = inner.product as Product;
          }
        }
      } else if (productBatch[0]) {
        productCandidate = productBatch[0].product;
      }
      if (!productCandidate) throw new Error("No product provided");
      const mapping = new Map(MAPPINGS.map((item) => [item.fromConceptId, item.toConceptId] as const));
      const translate = (id: string) => mapping.get(id) ?? id;
      const remapped: Product = {
        ...productCandidate,
        tags: productCandidate.tags.map(translate),
        features: productCandidate.features.map((feature: Product["features"][number]) => ({
          ...feature,
          tags: feature.tags.map(translate),
        })),
      };
      setRetailerPayload({ receivedAt: new Date().toISOString(), product: remapped });
      notify("Retailer ingest OK", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notify(`Import failed: ${message}`, "error");
    }
  };

  const sendWebhookPayload = useCallback(
    async (kind: string, payloadFactory: () => unknown | null) => {
      const target = (webhookDestinationRef.current ?? webhookDestination).trim();
      if (!target) {
        notify("Set a destination URL before sending.", "warning");
        return;
      }
      const payload = payloadFactory();
      if (!payload) {
        notify("Nothing to send – adjust your selection first.", "warning");
        return;
      }
      setWebhookDispatching(true);
      try {
        const response = await fetch("/api/webhooks/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destinationUrl: target,
            payload,
            authToken: settings.channel.authToken || undefined,
            sourceInstanceId: settings.identity.instanceId,
          }),
        });
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        const ok = response.ok && (typeof data.ok !== "boolean" || data.ok);
        const entry: WebhookDispatchLog = {
          id: uid(),
          timestamp: new Date().toISOString(),
          target,
          kind,
          ok,
          status: typeof data.status === "number" ? (data.status as number) : response.status,
          statusText: typeof data.statusText === "string" ? (data.statusText as string) : response.statusText,
          bodyPreview: typeof data.body === "string" ? (data.body as string) : undefined,
          error: typeof data.error === "string" ? (data.error as string) : undefined,
        };
        setWebhookLogs((previous) => [entry, ...previous].slice(0, 8));
        notify(ok ? "Webhook delivered" : "Webhook failed", ok ? "success" : "error");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        notify(`Webhook failed: ${message}`, "error");
      } finally {
        setWebhookDispatching(false);
      }
    },
    [notify, settings.channel.authToken, settings.identity.instanceId, webhookDestination]
  );

  const fetchWebhookInbox = useCallback(async () => {
    if (inboxFetchInFlight.current) return;
    inboxFetchInFlight.current = true;
    setWebhookInboxLoading(true);
    try {
      const response = await fetch(`/api/webhooks/${encodeURIComponent(settings.identity.instanceId)}`);
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      const data = (await response.json()) as { events?: WebhookInboxEvent[] };
      setWebhookInbox(data.events ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notify(`Inbox refresh failed: ${message}`, "error");
    } finally {
      inboxFetchInFlight.current = false;
      setWebhookInboxLoading(false);
    }
  }, [notify, settings.identity.instanceId]);

  const clearWebhookInbox = useCallback(async () => {
    try {
      await fetch(`/api/webhooks/${encodeURIComponent(settings.identity.instanceId)}`, { method: "DELETE" });
      setWebhookInbox([]);
      notify("Inbox cleared", "info");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notify(`Failed clearing inbox: ${message}`, "error");
    }
  }, [notify, settings.identity.instanceId]);

  useEffect(() => {
    fetchWebhookInbox();
  }, [fetchWebhookInbox]);

  const acknowledgeEvent = useCallback(
    async (eventId: string) => {
      await fetch(
        `/api/webhooks/${encodeURIComponent(settings.identity.instanceId)}/${encodeURIComponent(eventId)}`,
        { method: "DELETE" }
      );
    },
    [settings.identity.instanceId]
  );

  const schemaIdSet = useMemo(() => new Set(schemas.map((schema) => schema.id)), [schemas]);

  const getMissingSchemaIds = useCallback(
    (event: WebhookInboxEvent): string[] => {
      const payload = event.payload;
      if (!payload || typeof payload !== "object") return [];
      const envelope = payload as Record<string, unknown>;
      if (envelope.kind !== "product-update" || !Array.isArray(envelope.products)) return [];
      const missing: string[] = [];
      for (const entry of envelope.products as unknown[]) {
        if (!entry || typeof entry !== "object") continue;
        const candidate = entry as { schema?: { id?: string } };
        const schemaId = candidate.schema?.id;
        if (!schemaId || !schemaIdSet.has(schemaId)) {
          missing.push(schemaId || "unknown");
        }
      }
      return Array.from(new Set(missing));
    },
    [schemaIdSet]
  );

  const processInboundEvent = useCallback(
    (event: WebhookInboxEvent, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      const payload = event.payload;
      if (!payload || typeof payload !== "object") {
        if (!silent) notify("Inbound payload is empty or malformed.", "error");
        return false;
      }
      const envelope = payload as Record<string, unknown>;
      const kind = typeof envelope.kind === "string" ? envelope.kind : "unknown";
      const sourceIdentity = (envelope.identity ?? {}) as { displayName?: string; instanceId?: string };
      const sourceLabel = sourceIdentity.displayName || sourceIdentity.instanceId || "partner";

      if (kind === "schema-catalog" && Array.isArray(envelope.schemas)) {
        const incomingSchemas = envelope.schemas as ProductSchema[];
        setSchemas(incomingSchemas);
        const firstId = incomingSchemas[0]?.id ?? null;
        setSchemaSelection(firstId);
        setProductSchemaSelection(firstId);
        setSelectedInstanceId(null);
        if (!silent) {
          notify(`Loaded ${incomingSchemas.length} schema(s) from ${sourceLabel}`, "success");
        }
        return true;
      }

      if (kind === "taxonomy-update" && Array.isArray(envelope.concepts) && Array.isArray(envelope.collections)) {
        setTaxonomyConcepts(envelope.concepts as Concept[]);
        setTaxonomyCollections(envelope.collections as Collection[]);
        setTaxonomyMetadata(
          envelope.metadata && typeof envelope.metadata === "object"
            ? (envelope.metadata as TaxonomyMetadata)
            : null
        );
        if (!silent) {
          notify(`Loaded taxonomy update from ${sourceLabel}`, "success");
        }
        return true;
      }

      if (kind === "product-update") {
        const missingSchemas = getMissingSchemaIds(event);
        if (missingSchemas.length) {
          if (!silent) {
            notify(
              `Missing schema(s): ${missingSchemas.join(", ")}. Unable to load product(s) until schemas are available.`,
              "error"
            );
          }
          return false;
        }
        const entries = Array.isArray(envelope.products) ? (envelope.products as unknown[]) : [];
        const createdInstances: ProductInstance[] = [];
        const timestamp = new Date().toISOString();
        for (const entry of entries) {
          if (!entry || typeof entry !== "object") continue;
          const candidate = entry as { product?: Product; schema?: { id?: string }; referenceSystems?: ReferenceSystem[] };
          if (!candidate.product) continue;
          const schemaSummary = candidate.schema ?? {};
          const schemaId = typeof schemaSummary.id === "string" ? schemaSummary.id : "remote";
          const newInstance: ProductInstance = {
            id: uid(),
            schemaId,
            product: candidate.product,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          createdInstances.push(newInstance);
          if (Array.isArray(candidate.referenceSystems) && candidate.referenceSystems.length) {
            setReferenceSystems(candidate.referenceSystems.map((item) => normalizeReferenceSystem(item)));
          }
        }
        if (!createdInstances.length) {
          if (!silent) notify("Inbound product payload missing product details.", "error");
          return false;
        }
        setInstances((previous) => [...createdInstances, ...previous]);
        setSelectedInstanceId(createdInstances[0].id);
        setRetailerPayload({ receivedAt: timestamp, product: createdInstances[0].product });
        if (!silent) {
          notify(`Loaded ${createdInstances.length} product(s) from ${sourceLabel}`, "success");
        }
        return true;
      }

      if (kind === "reference-system-catalog" && Array.isArray(envelope.referenceSystems)) {
        setReferenceSystems((envelope.referenceSystems as ReferenceSystem[]).map((item) => normalizeReferenceSystem(item)));
        if (!silent) {
          notify(`Loaded reference system catalog from ${sourceLabel}`, "success");
        }
        return true;
      }

      if (kind === "rule-catalog" && Array.isArray(envelope.rules)) {
        const incomingRules = (envelope.rules as Rule[]).map((rule) => normalizeRule(rule));
        const incomingLinks = Array.isArray(envelope.ruleLinks)
          ? (envelope.ruleLinks as RuleLink[]).map((link) => normalizeRuleLink(link as StoredRuleLink))
          : [];
        setRules(incomingRules);
        setRuleLinks(incomingLinks);
        setSelectedRuleId(incomingRules[0]?.id ?? null);
        if (!silent) {
          notify(`Loaded ${incomingRules.length} rule(s) from ${sourceLabel}`, "success");
        }
        return true;
      }

      if (!silent) {
        notify(`Unsupported inbound payload kind '${kind}'.`, "warning");
      }
      return false;
    },
    [
      notify,
      setInstances,
      setProductSchemaSelection,
      setReferenceSystems,
      setRuleLinks,
      setRules,
      setRetailerPayload,
      setSchemaSelection,
      setSelectedInstanceId,
      setSelectedRuleId,
      setTaxonomyCollections,
      setTaxonomyConcepts,
      setTaxonomyMetadata,
      setSchemas,
      taxonomyMetadata,
      getMissingSchemaIds,
    ]
  );

  const handleApplyInboundEvent = useCallback(
    async (event: WebhookInboxEvent, options?: { silent?: boolean; skipStateUpdate?: boolean }) => {
      const silent = options?.silent ?? false;
      const skipStateUpdate = options?.skipStateUpdate ?? false;
      const applied = processInboundEvent(event, { silent });
      if (!applied) return false;
      try {
        await acknowledgeEvent(event.id);
        if (!skipStateUpdate) {
          setWebhookInbox((previous) => previous.filter((item) => item.id !== event.id));
        }
        return true;
      } catch (error) {
        if (!silent) {
          const message = error instanceof Error ? error.message : String(error);
          notify(`Failed acknowledging event: ${message}`, "error");
        } else {
          console.error("Failed acknowledging event", error);
        }
        return false;
      }
    },
    [acknowledgeEvent, notify, processInboundEvent]
  );

  useEffect(() => {
    if (settings.inboundProcessingMode !== "auto" || !webhookInbox.length) return;
    let cancelled = false;
    (async () => {
      for (const event of webhookInbox) {
        if (cancelled) break;
        await handleApplyInboundEvent(event, { silent: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handleApplyInboundEvent, settings.inboundProcessingMode, webhookInbox]);
  useEffect(() => {
    if (settings.inboundProcessingMode !== "auto") return;
    const interval = window.setInterval(() => {
      fetchWebhookInbox();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [fetchWebhookInbox, settings.inboundProcessingMode]);

  const handleResetSchemas = useCallback(() => {
    const schema = defaultSchemaTemplate();
    schema.name = "New Product Schema";
    setSchemas([schema]);
    setSchemaSelection(schema.id);
    setProductSchemaSelection(schema.id);
    setSelectedInstanceId(null);
    notify("Schemas reset to defaults", "info");
  }, [notify]);

  const handleResetProducts = useCallback(() => {
    setInstances([]);
    setSelectedInstanceId(null);
    setRetailerPayload(null);
    notify("Products reset", "info");
  }, [notify]);

  const handleResetTaxonomy = useCallback(() => {
    const reloaded = reloadTaxonomyFromSource();
    if (reloaded) {
      const label = defaultTaxonomySource?.label ?? "configured taxonomy";
      notify(`Reloaded ${label}`, "info");
      return;
    }
    setTaxonomyConcepts(DEFAULT_CONCEPTS);
    setTaxonomyCollections(COLLECTIONS);
    setTaxonomyMetadata(null);
    notify("Taxonomy reset", "info");
  }, [
    defaultTaxonomySource?.label,
    notify,
    reloadTaxonomyFromSource,
    setTaxonomyCollections,
    setTaxonomyConcepts,
    setTaxonomyMetadata,
  ]);

  const handleResetReferenceSystems = useCallback(() => {
    const defaults = defaultReferenceSystems().map((item) => normalizeReferenceSystem(item));
    setReferenceSystems(defaults);
    notify("Reference systems reset", "info");
  }, [notify]);

  const handleResetRules = useCallback(() => {
    const starter = createRule("Sample availability rule");
    starter.description = "Use the Add Condition wizard to build your first rule.";
    setRules([starter]);
    setRuleLinks([]);
    setSelectedRuleId(starter.id);
    notify("Rules reset", "info");
  }, [notify]);

  const settingsResetActions = useMemo(
    () => [
      {
        key: "schemas",
        label: "Product schemas",
        description: "Remove all custom schemas and restore the starter template.",
        onReset: handleResetSchemas,
      },
      {
        key: "products",
        label: "Specified products",
        description: "Clear all instantiated products and retailer payloads.",
        onReset: handleResetProducts,
      },
      {
        key: "taxonomy",
        label: "Taxonomy library",
        description: "Reload the bundled taxonomy export and discard local edits.",
        onReset: handleResetTaxonomy,
      },
      {
        key: "reference-systems",
        label: "Reference systems",
        description: "Recreate the demo reference system catalog.",
        onReset: handleResetReferenceSystems,
      },
      {
        key: "rules",
        label: "Rules",
        description: "Clear all custom rules and start with a single empty rule.",
        onReset: handleResetRules,
      },
    ],
    [handleResetProducts, handleResetReferenceSystems, handleResetRules, handleResetSchemas, handleResetTaxonomy]
  );

  const selectedProductIdSet = useMemo(() => new Set(selectedProductIds), [selectedProductIds]);
  const productBatch = useMemo(
    () => (productSendMode === "all" ? instances : instances.filter((instance) => selectedProductIdSet.has(instance.id))),
    [instances, productSendMode, selectedProductIdSet]
  );

  const selectedSchemaIdSet = useMemo(() => new Set(selectedSchemaIds), [selectedSchemaIds]);
  const schemaBatch = useMemo(
    () => (schemaSendMode === "all" ? schemas : schemas.filter((schema) => selectedSchemaIdSet.has(schema.id))),
    [schemaSendMode, schemas, selectedSchemaIdSet]
  );

  const selectedRuleIdSet = useMemo(() => new Set(selectedRuleIds), [selectedRuleIds]);
  const ruleBatch = useMemo(
    () => (ruleSendMode === "all" ? rules : rules.filter((rule) => selectedRuleIdSet.has(rule.id))),
    [ruleSendMode, rules, selectedRuleIdSet]
  );
  const ruleLinksBatch = useMemo(() => {
    if (ruleSendMode === "all") return ruleLinks;
    return ruleLinks.filter((link) => selectedRuleIdSet.has(link.ruleRef));
  }, [ruleLinks, ruleSendMode, selectedRuleIdSet]);

  const selectedReferenceSystemIdSet = useMemo(() => new Set(selectedReferenceSystemIds), [selectedReferenceSystemIds]);
  const referenceSystemBatch = useMemo(
    () =>
      referenceSystemSendMode === "all"
        ? referenceSystems
        : referenceSystems.filter((system) => selectedReferenceSystemIdSet.has(system.id)),
    [referenceSystemSendMode, referenceSystems, selectedReferenceSystemIdSet]
  );

  const productPreviewEnvelope = useMemo(
    () => buildProductEnvelope(productBatch),
    [buildProductEnvelope, productBatch]
  );

  const handleManualApplyInboundEvent = useCallback(
    async (event: WebhookInboxEvent) => {
      setInboxApplyingId(event.id);
      try {
        await handleApplyInboundEvent(event);
      } finally {
        setInboxApplyingId((current) => (current === event.id ? null : current));
      }
    },
    [handleApplyInboundEvent]
  );

  return (
    <ThemeProvider theme={theme}>
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">Product Information Exchange Workbench</Typography>
            <Typography variant="caption" color="text.secondary">
              {settings.identity.displayName || "Unnamed instance"}
            </Typography>
          </Box>
        </Toolbar>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" allowScrollButtonsMobile>
          <Tab id="tab-0" label="Product Schemas" />
          <Tab id="tab-1" label="Taxonomy" />
          <Tab id="tab-2" label="Specified Products" />
          <Tab id="tab-3" label="Reference Systems" />
          <Tab id="tab-4" label="Rules" />
          <Tab id="tab-5" label="Exchange" />
          <Tab id="tab-6" label="Partners" />
          <Tab id="tab-7" label="Settings" />
        </Tabs>
      </AppBar>

      {tab === 0 && (
        <Box sx={{ p: 2 }}>
          <Suspense fallback={<WorkspaceFallback label="product schemas" />}>
            <SchemaWorkspace
              categories={SCHEMA_CATEGORIES}
              schemas={schemas}
              selectedSchemaId={schemaSelection}
              onSelectSchema={setSchemaSelection}
              onCreateSchema={handleCreateSchema}
              onUpdateSchema={handleUpdateSchema}
              onDeleteSchema={handleDeleteSchema}
              onExportSchema={handleExportSchema}
              onPersistSchemas={handlePersistSchemas}
              onTagSchema={handleTagSchema}
              onRemoveSchemaTag={handleRemoveSchemaTag}
              onAssignCollection={handleAssignCollection}
              onRemoveCollection={handleRemoveCollection}
              collections={collections}
              conceptLabel={conceptLabel}
              orderedConcepts={orderedConcepts}
              referenceSystems={referenceSystems}
            />
          </Suspense>
        </Box>
      )}

      {tab === 1 && (
        <Box sx={{ p: 2 }}>
          <Suspense fallback={<WorkspaceFallback label="taxonomy" />}>
            <TaxonomyWorkspace
              concepts={concepts}
              setConcepts={taxonomy.setConcepts}
              collections={collections}
              setCollections={taxonomy.setCollections}
              metadata={taxonomyMetadata}
              setMetadata={taxonomy.setMetadata}
              conceptLabel={conceptLabel}
              onNotify={notify}
            />
          </Suspense>
        </Box>
      )}

      {tab === 2 && (
        <Box sx={{ p: 2 }}>
          <Suspense fallback={<WorkspaceFallback label="specified products" />}>
            <ProductWorkspace
              schemas={schemas}
              instances={instances}
              selectedSchemaId={productSchemaSelection}
              onSelectSchema={setProductSchemaSelection}
              selectedInstanceId={selectedInstanceId}
              onSelectInstance={setSelectedInstanceId}
              onInstantiate={handleInstantiate}
              onUpdateInstance={handleUpdateInstance}
              onDeleteInstance={handleDeleteInstance}
              onExportInstance={handleExportInstance}
              onPersistInstances={handlePersistInstances}
              onTagProduct={handleTagProduct}
              onRemoveProductTag={handleRemoveProductTag}
              retailerPartners={retailerPartners}
              partnerAssociations={partnerAssociations}
              conceptLabel={conceptLabel}
              orderedConcepts={orderedConcepts}
              referenceSystems={referenceSystems}
            />
          </Suspense>
        </Box>
      )}

      {tab === 3 && (
        <Box sx={{ p: 2 }}>
          <Suspense fallback={<WorkspaceFallback label="reference systems" />}>
            <ReferenceSystemWorkspace
              referenceSystems={referenceSystems}
              onCreate={handleCreateReferenceSystem}
              onUpdate={handleUpdateReferenceSystem}
              onDelete={handleDeleteReferenceSystem}
              systemTypes={REFERENCE_SYSTEM_TYPES}
              concepts={concepts}
              conceptLabel={conceptLabel}
            />
          </Suspense>
        </Box>
      )}

      {tab === 4 && (
        <Box sx={{ p: 2 }}>
          <Suspense fallback={<WorkspaceFallback label="rules" />}>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1}
                alignItems={{ md: "center" }}
                justifyContent="space-between"
              >
                <Typography variant="h6">Rules management</Typography>
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreateRule}>
                    New rule
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => {
                      setRunDrawerFilterRuleId(null);
                      setRunDrawerOpen(true);
                    }}
                  >
                    Run rules
                  </Button>
                </Stack>
              </Stack>
              <RulesWorkspace
                rules={rules}
                selectedRuleId={selectedRuleId}
                onSelectRule={(ruleId) => setSelectedRuleId(ruleId)}
                onCreateRule={handleCreateRule}
                onChange={setRules}
                ruleLinks={ruleLinks}
                onChangeRuleLinks={setRuleLinks}
                schemas={schemas}
                instances={instances}
                conceptLabel={conceptLabel}
                concepts={concepts}
                onRunRule={(ruleId) => {
                  setRunDrawerFilterRuleId(ruleId);
                  setRunDrawerOpen(true);
                }}
              />
            </Stack>
          </Suspense>
        </Box>
      )}

      {tab === 5 && (
        <Box sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardHeader
                  title="Supplier Payload"
                  action={
                    <Stack direction="row" spacing={1}>
                      <Button startIcon={<ContentCopyIcon />} onClick={exportSupplierPayload} disabled={!productPreviewEnvelope}>
                        Copy
                      </Button>
                      <Button
                        startIcon={<DownloadIcon />}
                        onClick={() => {
                          const payload = exportSupplierPayload();
                          if (payload) downloadJson(`product-payload-${new Date().toISOString()}.json`, payload);
                        }}
                        disabled={!productPreviewEnvelope}
                      >
                        Download
                      </Button>
                    </Stack>
                  }
                />
                <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {productPreviewEnvelope
                      ? "Preview of the webhook payload that will be sent for specified products."
                      : "Select at least one product to preview the payload."}
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      m: 0,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      p: 1.5,
                      maxHeight: { xs: 240, md: 320 },
                      overflow: "auto",
                      bgcolor: "background.default",
                    }}
                  >
                    {productPreviewEnvelope ? JSON.stringify(productPreviewEnvelope, null, 2) : "—"}
                  </Box>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardHeader title="Webhook Outbound" subheader="Push updates to a partner endpoint." />
                <CardContent>
                  <Stack spacing={3}>
                    <Box>
                      <TextField
                        label="Destination URL"
                        value={webhookDestination}
                        onChange={(event) => {
                          const value = event.target.value;
                          setWebhookDestination(value);
                          webhookDestinationRef.current = value;
                        }}
                        helperText="Use Settings → Channel to store the canonical endpoint."
                        fullWidth
                      />
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="subtitle2">Specified products</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Send instantiated products with schema metadata so partners can verify compatibility.
                      </Typography>
                      <FormControl component="fieldset" sx={{ mt: 1 }}>
                        <FormLabel component="legend">Scope</FormLabel>
                        <RadioGroup
                          row
                          value={productSendMode}
                          onChange={(event) => setProductSendMode(event.target.value as SendScopeMode)}
                        >
                          <FormControlLabel value="all" control={<Radio size="small" />} label="All products" />
                          <FormControlLabel value="selected" control={<Radio size="small" />} label="Choose products" />
                        </RadioGroup>
                      </FormControl>
                      {productSendMode === "selected" && (
                        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                          <InputLabel id="product-send-select-label">Products to include</InputLabel>
                          <Select
                            multiple
                            labelId="product-send-select-label"
                            label="Products to include"
                            value={selectedProductIds}
                            onChange={(event) =>
                              setSelectedProductIds(
                                typeof event.target.value === "string"
                                  ? event.target.value.split(",")
                                  : (event.target.value as string[])
                              )
                            }
                            renderValue={(selected) => {
                              const ids = selected as string[];
                              if (!ids.length) return "None selected";
                              return ids
                                .map((id) => instances.find((instance) => instance.id === id)?.product.name ?? id)
                                .join(", ");
                            }}
                            MenuProps={{ PaperProps: { style: { maxHeight: 280 } } }}
                          >
                            {instances.length === 0 ? (
                              <MenuItem disabled> No products available </MenuItem>
                            ) : (
                              instances.map((instance) => (
                                <MenuItem key={instance.id} value={instance.id}>
                                  <Checkbox checked={selectedProductIds.includes(instance.id)} />
                                  <ListItemText
                                    primary={instance.product.name}
                                    secondary={resolveSchemaSummary(instance.schemaId).name}
                                  />
                                </MenuItem>
                              ))
                            )}
                          </Select>
                        </FormControl>
                      )}
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
                        <Button
                          startIcon={<SendIcon />}
                          variant="contained"
                          disabled={webhookDispatching || !productBatch.length}
                          onClick={() =>
                            sendWebhookPayload("product-update", () => buildProductEnvelope(productBatch))
                          }
                        >
                          Send product update
                        </Button>
                      </Stack>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="subtitle2">Product schemas</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Share schema templates so partners can validate incoming products.
                      </Typography>
                      <FormControl component="fieldset" sx={{ mt: 1 }}>
                        <FormLabel component="legend">Scope</FormLabel>
                        <RadioGroup
                          row
                          value={schemaSendMode}
                          onChange={(event) => setSchemaSendMode(event.target.value as SendScopeMode)}
                        >
                          <FormControlLabel value="all" control={<Radio size="small" />} label="All schemas" />
                          <FormControlLabel value="selected" control={<Radio size="small" />} label="Choose schemas" />
                        </RadioGroup>
                      </FormControl>
                      {schemaSendMode === "selected" && (
                        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                          <InputLabel id="schema-send-select-label">Schemas to include</InputLabel>
                          <Select
                            multiple
                            labelId="schema-send-select-label"
                            label="Schemas to include"
                            value={selectedSchemaIds}
                            onChange={(event) =>
                              setSelectedSchemaIds(
                                typeof event.target.value === "string"
                                  ? event.target.value.split(",")
                                  : (event.target.value as string[])
                              )
                            }
                            renderValue={(selected) => {
                              const ids = selected as string[];
                              if (!ids.length) return "None selected";
                              return ids.map((id) => schemas.find((schema) => schema.id === id)?.name ?? id).join(", ");
                            }}
                            MenuProps={{ PaperProps: { style: { maxHeight: 280 } } }}
                          >
                            {schemas.length === 0 ? (
                              <MenuItem disabled>No schemas available</MenuItem>
                            ) : (
                              schemas.map((schema) => (
                                <MenuItem key={schema.id} value={schema.id}>
                                  <Checkbox checked={selectedSchemaIds.includes(schema.id)} />
                                  <ListItemText primary={schema.name} secondary={schema.category} />
                                </MenuItem>
                              ))
                            )}
                          </Select>
                        </FormControl>
                      )}
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
                        <Button
                          variant="outlined"
                          disabled={webhookDispatching || !schemaBatch.length}
                          onClick={() =>
                            sendWebhookPayload("schema-catalog", () => buildSchemaEnvelope(schemaBatch))
                          }
                        >
                          Send schema catalog
                        </Button>
                      </Stack>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="subtitle2">Reference systems</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Provide code lists and validation systems referenced by schemas and products.
                      </Typography>
                      <FormControl component="fieldset" sx={{ mt: 1 }}>
                        <FormLabel component="legend">Scope</FormLabel>
                        <RadioGroup
                          row
                          value={referenceSystemSendMode}
                          onChange={(event) => setReferenceSystemSendMode(event.target.value as SendScopeMode)}
                        >
                          <FormControlLabel value="all" control={<Radio size="small" />} label="All reference systems" />
                          <FormControlLabel value="selected" control={<Radio size="small" />} label="Choose entries" />
                        </RadioGroup>
                      </FormControl>
                      {referenceSystemSendMode === "selected" && (
                        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                          <InputLabel id="reference-system-send-select-label">Reference systems to include</InputLabel>
                          <Select
                            multiple
                            labelId="reference-system-send-select-label"
                            label="Reference systems to include"
                            value={selectedReferenceSystemIds}
                            onChange={(event) =>
                              setSelectedReferenceSystemIds(
                                typeof event.target.value === "string"
                                  ? event.target.value.split(",")
                                  : (event.target.value as string[])
                              )
                            }
                            renderValue={(selected) => {
                              const ids = selected as string[];
                              if (!ids.length) return "None selected";
                              return ids
                                .map((id) => referenceSystems.find((system) => system.id === id)?.identifier ?? id)
                                .join(", ");
                            }}
                            MenuProps={{ PaperProps: { style: { maxHeight: 280 } } }}
                          >
                            {referenceSystems.length === 0 ? (
                              <MenuItem disabled>No reference systems available</MenuItem>
                            ) : (
                              referenceSystems.map((system) => (
                                <MenuItem key={system.id} value={system.id}>
                                  <Checkbox checked={selectedReferenceSystemIds.includes(system.id)} />
                                  <ListItemText primary={system.identifier || system.id} secondary={system.systemType} />
                                </MenuItem>
                              ))
                            )}
                          </Select>
                        </FormControl>
                      )}
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
                        <Button
                          variant="outlined"
                          disabled={webhookDispatching || !referenceSystemBatch.length}
                          onClick={() =>
                            sendWebhookPayload("reference-system-catalog", () =>
                              buildReferenceSystemsEnvelope(referenceSystemBatch)
                            )
                          }
                        >
                          Send reference systems
                        </Button>
                      </Stack>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="subtitle2">Rules</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Share activation logic and assignments so partners can evaluate offers consistently.
                      </Typography>
                      <FormControl component="fieldset" sx={{ mt: 1 }}>
                        <FormLabel component="legend">Scope</FormLabel>
                        <RadioGroup
                          row
                          value={ruleSendMode}
                          onChange={(event) => setRuleSendMode(event.target.value as SendScopeMode)}
                        >
                          <FormControlLabel value="all" control={<Radio size="small" />} label="All rules" />
                          <FormControlLabel value="selected" control={<Radio size="small" />} label="Choose rules" />
                        </RadioGroup>
                      </FormControl>
                      {ruleSendMode === "selected" && (
                        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                          <InputLabel id="rule-send-select-label">Rules to include</InputLabel>
                          <Select
                            multiple
                            labelId="rule-send-select-label"
                            label="Rules to include"
                            value={selectedRuleIds}
                            onChange={(event) =>
                              setSelectedRuleIds(
                                typeof event.target.value === "string"
                                  ? event.target.value.split(",")
                                  : (event.target.value as string[])
                              )
                            }
                            renderValue={(selected) => {
                              const ids = selected as string[];
                              if (!ids.length) return "None selected";
                              return ids.map((id) => rules.find((rule) => rule.id === id)?.name ?? id).join(", ");
                            }}
                            MenuProps={{ PaperProps: { style: { maxHeight: 280 } } }}
                          >
                            {rules.length === 0 ? (
                              <MenuItem disabled>No rules available</MenuItem>
                            ) : (
                              rules.map((rule) => (
                                <MenuItem key={rule.id} value={rule.id}>
                                  <Checkbox checked={selectedRuleIds.includes(rule.id)} />
                                  <ListItemText primary={rule.name} secondary={rule.ruleId} />
                                </MenuItem>
                              ))
                            )}
                          </Select>
                        </FormControl>
                      )}
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
                        <Button
                          variant="outlined"
                          disabled={webhookDispatching || !ruleBatch.length}
                          onClick={() =>
                            sendWebhookPayload("rule-catalog", () => buildRulesEnvelope(ruleBatch, ruleLinksBatch))
                          }
                        >
                          Send rules
                        </Button>
                      </Stack>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="subtitle2">Taxonomy</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Send the active taxonomy snapshot (single instance).
                      </Typography>
                      <Button
                        sx={{ mt: 1 }}
                        variant="outlined"
                        disabled={webhookDispatching}
                        onClick={() => sendWebhookPayload("taxonomy-update", buildTaxonomyEnvelope)}
                      >
                        Send taxonomy
                      </Button>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="subtitle2">Recent deliveries</Typography>
                      <Box sx={{ maxHeight: 260, overflow: "auto", mt: 1 }}>
                        {webhookLogs.length === 0 ? (
                          <Alert severity="info">No webhooks sent yet.</Alert>
                        ) : (
                          <Stack spacing={1}>
                            {webhookLogs.map((entry) => (
                              <Box
                                key={entry.id}
                                sx={{
                                  border: "1px solid",
                                  borderColor: entry.ok ? "success.light" : "error.light",
                                  borderRadius: 2,
                                  p: 1.5,
                                }}
                              >
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                  <Typography variant="subtitle2">{entry.kind}</Typography>
                                  <Chip
                                    size="small"
                                    label={entry.ok ? `OK · ${entry.status ?? ""}` : `Error · ${entry.status ?? "n/a"}`}
                                    color={entry.ok ? "success" : "error"}
                                  />
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(entry.timestamp).toLocaleString()}
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 0.5 }}>
                                  Target: {entry.target}
                                </Typography>
                                {entry.error ? (
                                  <Typography variant="body2" color="error">
                                    {entry.error}
                                  </Typography>
                                ) : entry.bodyPreview ? (
                                  <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>
                                    {entry.bodyPreview}
                                  </Typography>
                                ) : null}
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>

            <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardHeader
                  title="Retailer View (Simulated)"
                  action={
                    <Button startIcon={<UploadIcon />} onClick={() => simulateRetailerIngest()} disabled={!productBatch.length}>
                      Import current
                    </Button>
                  }
                />
                <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: { xs: "none", lg: 420 } }}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      const text = prompt("Paste supplier JSON payload:");
                      if (text != null) simulateRetailerIngest(text);
                    }}
                  >
                    Paste payload
                  </Button>
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    {retailerPayload ? (
                      <Box
                        component="pre"
                        sx={{
                          m: 0,
                          height: "100%",
                          maxHeight: { xs: 320, lg: "100%" },
                          overflow: "auto",
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: "divider",
                          p: 1.5,
                          bgcolor: "background.default",
                        }}
                      >
                        {JSON.stringify(retailerPayload, null, 2)}
                      </Box>
                    ) : (
                      <Alert severity="info">No retailer payload yet.</Alert>
                    )}
                  </Box>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardHeader title="Inbound Webhooks" subheader="Share an endpoint for partners to push updates." />
                <CardContent>
                  <Stack spacing={2}>
                    {inboundProxyEndpoint ? (
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle2">Through this app</Typography>
                        <TextField value={inboundProxyEndpoint} size="small" InputProps={{ readOnly: true }} />
                        <Button
                          size="small"
                          startIcon={<ContentCopyIcon fontSize="small" />}
                          sx={{ alignSelf: "flex-start" }}
                          onClick={() => navigator.clipboard.writeText(inboundProxyEndpoint)}
                        >
                          Copy proxy endpoint
                        </Button>
                      </Stack>
                    ) : null}
                    {inboundDirectEndpoint ? (
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle2">Direct API</Typography>
                        <TextField value={inboundDirectEndpoint} size="small" InputProps={{ readOnly: true }} />
                        <Button
                          size="small"
                          startIcon={<ContentCopyIcon fontSize="small" />}
                          sx={{ alignSelf: "flex-start" }}
                          onClick={() => navigator.clipboard.writeText(inboundDirectEndpoint)}
                        >
                          Copy direct endpoint
                        </Button>
                      </Stack>
                    ) : null}
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Button
                        startIcon={<CachedIcon />}
                        variant="outlined"
                        onClick={fetchWebhookInbox}
                        disabled={webhookInboxLoading}
                      >
                        Refresh inbox
                      </Button>
                      <Button
                        variant="text"
                        color="secondary"
                        onClick={clearWebhookInbox}
                        disabled={webhookInboxLoading || webhookInbox.length === 0}
                      >
                        Clear
                      </Button>
                      {settings.inboundProcessingMode === "auto" && (
                        <Chip label="Auto load enabled" size="small" color="primary" variant="outlined" />
                      )}
                    </Stack>
                    <Box sx={{ maxHeight: 320, overflow: "auto" }}>
                      {webhookInbox.length === 0 ? (
                        <Alert severity="info">No inbound events yet. POST any JSON payload to the endpoint above.</Alert>
                      ) : (
                        <Stack spacing={1}>
                          {webhookInbox.map((event) => {
                            const eventPayload =
                              event.payload && typeof event.payload === "object"
                                ? (event.payload as Record<string, unknown>)
                                : null;
                            const eventKind = typeof eventPayload?.kind === "string" ? eventPayload.kind : "unknown";
                            const senderIdentity =
                              eventPayload && typeof eventPayload.identity === "object"
                                ? (eventPayload.identity as { displayName?: string; instanceId?: string })
                                : null;
                            const senderLabel = senderIdentity?.displayName || senderIdentity?.instanceId || "Unknown sender";
                            const missingSchemas =
                              eventKind === "product-update" ? getMissingSchemaIds(event) : [];
                            return (
                              <Box key={event.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.5 }}>
                                <Stack
                                  direction={{ xs: "column", sm: "row" }}
                                  spacing={1}
                                  justifyContent="space-between"
                                  alignItems={{ xs: "flex-start", sm: "center" }}
                                >
                                  <Typography variant="subtitle2">
                                    Received {new Date(event.receivedAt).toLocaleString()}
                                  </Typography>
                                  <Chip label={eventKind} size="small" />
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                  From: {senderLabel}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                  Event ID: {event.id}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                                  Headers: {Object.keys(event.headers).length ? JSON.stringify(event.headers) : "—"}
                                </Typography>
                                <Stack
                                  direction={{ xs: "column", sm: "row" }}
                                  spacing={1}
                                  alignItems={{ xs: "stretch", sm: "center" }}
                                  sx={{ mt: 1 }}
                                >
                                  <Button
                                    size="small"
                                    variant="contained"
                                    startIcon={<DownloadIcon fontSize="small" />}
                                    onClick={() => handleManualApplyInboundEvent(event)}
                                    disabled={inboxApplyingId === event.id || missingSchemas.length > 0}
                                  >
                                    Load into workspace
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={() => navigator.clipboard.writeText(JSON.stringify(event.payload, null, 2))}
                                  >
                                    Copy payload
                                  </Button>
                                </Stack>
                                {missingSchemas.length ? (
                                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
                                    Missing schema(s): {missingSchemas.join(", ")}. Import or create them before loading this product.
                                  </Typography>
                                ) : null}
                                <Box
                                  component="pre"
                                  sx={{ m: 0, mt: 1, maxHeight: 180, overflow: "auto", borderRadius: 1, bgcolor: "background.default", p: 1 }}
                                >
                                  {JSON.stringify(event.payload, null, 2)}
                                </Box>
                              </Box>
                            );
                          })}
                        </Stack>
                      )}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Stack>
        </Box>
      )}

      {tab === 6 && (
        <Box sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Card variant="outlined" sx={{ borderRadius: 3, flex: 1 }}>
              <CardHeader title="Partner Management" subheader="Register airline partners and their roles." />
              <CardContent>
                <Stack spacing={2}>
                  <TextField
                    label="Partner name"
                    value={newPartnerName}
                    onChange={(event) => setNewPartnerName(event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Partner ID"
                    value={newPartnerExternalId}
                    onChange={(event) => setNewPartnerExternalId(event.target.value)}
                    fullWidth
                  />
                  <FormGroup row>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={newPartnerRoles.supplier}
                          onChange={() => handleToggleNewPartnerRole("supplier")}
                        />
                      }
                      label="Supplier"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={newPartnerRoles.retailer}
                          onChange={() => handleToggleNewPartnerRole("retailer")}
                        />
                      }
                      label="Retailer"
                    />
                  </FormGroup>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleCreatePartner}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Add partner
                  </Button>
                  <Divider />
                  <Typography variant="subtitle1">Existing partners</Typography>
                  {partners.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No partners yet.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {partners.map((partner) => (
                        <Stack key={partner.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography variant="body2" sx={{ minWidth: 140, fontWeight: 500 }}>
                            {partner.name}
                          </Typography>
                          <Chip label={`ID: ${partner.externalId}`} size="small" variant="outlined" />
                          {partner.roles.map((role) => (
                            <Chip
                              key={`${partner.id}-${role}`}
                              label={role === "supplier" ? "Supplier" : "Retailer"}
                              size="small"
                              color={role === "retailer" ? "primary" : "default"}
                              variant={role === "retailer" ? "filled" : "outlined"}
                              sx={{ mr: 0.5 }}
                            />
                          ))}
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ borderRadius: 3, flex: 1 }}>
              <CardHeader
                title="Retail Access Control"
                subheader="Associate retail partners with products they can offer."
              />
              <CardContent>
                <Stack spacing={2}>
                  {retailerPartners.length === 0 ? (
                    <Alert severity="info">Create a partner with the retailer role to manage associations.</Alert>
                  ) : (
                    <>
                      <FormControl fullWidth>
                        <InputLabel id="retail-partner-select-label">Retail partner</InputLabel>
                        <Select
                          labelId="retail-partner-select-label"
                          label="Retail partner"
                          value={selectedRetailPartnerId ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            setSelectedRetailPartnerId(value ? String(value) : null);
                          }}
                        >
                          {retailerPartners.map((partner) => (
                            <MenuItem key={partner.id} value={partner.id}>
                              {partner.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {instances.length === 0 ? (
                        <Alert severity="info">Create products to make them available for partners.</Alert>
                      ) : selectedRetailPartnerId ? (
                        <Stack spacing={1}>
                          {instances.map((instance) => (
                            <FormControlLabel
                              key={instance.id}
                              control={
                                <Checkbox
                                  checked={selectedPartnerProducts.includes(instance.id)}
                                  onChange={(event) => handlePartnerProductToggle(instance.id, event.target.checked)}
                                />
                              }
                              label={instance.product.name}
                            />
                          ))}
                        </Stack>
                      ) : null}
                      <Button
                        variant="outlined"
                        onClick={handlePersistPartnerAssociations}
                        disabled={!selectedRetailPartnerId}
                        sx={{ alignSelf: "flex-start" }}
                      >
                        Save associations
                      </Button>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      )}

      {tab === 7 && (
        <Box sx={{ p: 2 }}>
          <Suspense fallback={<WorkspaceFallback label="settings" />}>
            <SettingsWorkspace settings={settings} onSave={handleSaveSettings} resetActions={settingsResetActions} />
          </Suspense>
        </Box>
      )}

      <Drawer
        anchor="right"
        open={runDrawerOpen}
        onClose={() => {
          setRunDrawerOpen(false);
          setRunDrawerFilterRuleId(null);
        }}
      >
        <Box sx={{ width: { xs: "100vw", sm: 420 }, maxWidth: "100vw", p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="h6">Run rules</Typography>
              <IconButton aria-label="Close run rules panel" onClick={() => setRunDrawerOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Configure contexts and preview how the currently selected products behave before sharing changes.
            </Typography>
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={() => notify("Rules evaluated")}
            >
              Run now
            </Button>
            <Divider />
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Evaluation context
              </Typography>
              <Stack spacing={2}>
                          {drawerContextRules.map((rule) => {
                  const bindingEntries = Object.entries(rule.context.bindings) as [ContextRef, string][];
                  const availableRefs = CONTEXT_REFS.filter(
                    (ref) => !bindingEntries.some(([current]) => current === ref)
                  );
                  return (
                    <Box
                      key={`${rule.id}-context`}
                      sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2 }}
                    >
                      <Stack spacing={1.5}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Box>
                            <Typography variant="subtitle2">{rule.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {rule.ruleId}
                            </Typography>
                          </Box>
                        </Stack>
                        <TextField
                          size="small"
                          label="Context ID"
                          value={rule.context.contextId}
                          onChange={(event) => handleChangeContextId(rule.id, event.target.value)}
                        />
                        <Stack spacing={1}>
                          {bindingEntries.map(([ref, value]) => (
                            <Stack
                              key={`${rule.id}-${ref}`}
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              alignItems={{ xs: "stretch", sm: "center" }}
                            >
                              <FormControl size="small" sx={{ minWidth: 160 }}>
                                <InputLabel>Reference</InputLabel>
                                <Select
                                  label="Reference"
                                  value={ref}
                                  onChange={(event) =>
                                    handleChangeBindingReference(rule.id, ref, event.target.value as ContextRef)
                                  }
                                >
                                  {CONTEXT_REFS.map((candidate) => (
                                    <MenuItem
                                      key={candidate}
                                      value={candidate}
                                      disabled={candidate !== ref && rule.context.bindings[candidate] !== undefined}
                                    >
                                      {candidate}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              <TextField
                                fullWidth
                                size="small"
                                label="Binding description"
                                value={value}
                                onChange={(event) => handleChangeBindingValue(rule.id, ref, event.target.value)}
                              />
                              <Button size="small" color="error" onClick={() => handleRemoveContextBinding(rule.id, ref)}>
                                Remove
                              </Button>
                            </Stack>
                          ))}
                          <Button
                            size="small"
                            startIcon={<AddIcon fontSize="small" />}
                            disabled={!availableRefs.length}
                            onClick={() => handleAddContextBinding(rule.id)}
                          >
                            Add binding
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  );
                })}
                          {drawerContextRules.length === 0 && rules.length > 0 && (
                            <Typography variant="body2" color="text.secondary">
                              {runDrawerFilterRuleId
                                ? "Selected rule is no longer available."
                                : "Select a rule to configure its evaluation context."}
                            </Typography>
                          )}
              </Stack>
            </Box>
            <Divider />
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Evaluation results
              </Typography>
              <Stack spacing={1}>
                {!activeProduct && (
                  <Alert severity="warning">Create or select a product to evaluate rules.</Alert>
                )}
                {drawerRuleResults.map((result) => (
                  <Card key={result.internalId} variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardHeader title={result.name || result.ruleId} subheader={`Status: ${result.status.toUpperCase()}`} />
                    <CardContent>
                      <Stack spacing={0.5}>
                        {result.details.map((line, index) => (
                          <Typography
                            key={`${result.internalId}-${index}`}
                            variant="body2"
                            color={line.startsWith("✗") ? "error.main" : "text.secondary"}
                          >
                            {line}
                          </Typography>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
                {drawerRuleResults.length === 0 && (
                  <Alert severity="info">No applicable rules for the current selection.</Alert>
                )}
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Drawer>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((previous) => ({ ...previous, open: false }))}>
        <Alert severity={snack.severity} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
};

export default App;
