import React, { Suspense, useEffect, useMemo, useState, lazy } from "react";
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
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
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
import { ThemeProvider, createTheme } from "@mui/material/styles";
const SchemaWorkspace = lazy(() => import("./components/SchemaWorkspace"));
const ProductWorkspace = lazy(() => import("./components/ProductWorkspace"));
const TaxonomyWorkspace = lazy(() => import("./components/TaxonomyWorkspace"));
const ReferenceSystemWorkspace = lazy(() => import("./components/ReferenceSystemWorkspace"));
const RulesWorkspace = lazy(() => import("./components/RulesWorkspace"));
import {
  COLLECTIONS,
  DEFAULT_CONCEPTS,
  CONCEPT_SCHEMES,
  REFERENCE_SYSTEM_TYPES,
  SCHEMA_CATEGORIES,
  createExternalReferenceSource,
  createIndianMealRule,
  createTaxonomyReferenceSource,
  defaultReferenceSystems,
  defaultSchemaTemplate,
  instantiateProduct,
  resolveCollectionMembers,
  schemaCategoryLabel,
  updateTimestamp,
  uid,
} from "./domain";
import type {
  Partner,
  PartnerProductMap,
  PartnerRole,
  Product,
  ProductInstance,
  ProductSchema,
  InternalReferenceSource,
  LogicalExpression,
  LogicalOperator,
  ReferenceSource,
  ReferenceSystem,
  ReferenceSystemType,
  ReferenceSystemDraft,
  Rule,
  RuleScope,
  RuleTarget,
  SchemaCategory,
  TaxonomyConceptSetReference,
} from "./domain";
import { useTaxonomy } from "./taxonomy";
import {
  loadInstances,
  loadPartnerProducts,
  loadPartners,
  loadReferenceSystems,
  loadSchemas,
  persistInstances,
  persistPartnerProducts,
  persistPartners,
  persistReferenceSystems,
  persistSchemas,
} from "./storage";

type RetailerPayload = { receivedAt: string; product: Product };

const MAPPINGS = [
  { fromConceptId: "C-PriorityBoarding", toConceptId: "C-PriorityBoarding" },
  { fromConceptId: "C-Flight", toConceptId: "C-Flight" },
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

type RuleEvaluationStatus = "pass" | "fail" | "unknown";
type RuleEvaluationResult = { ruleId: string; name: string; status: RuleEvaluationStatus; details: string[] };

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

const evaluateLogicalExpression = (
  expression: LogicalExpression,
  product: Product,
  details: string[],
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
      evaluateLogicalExpression(child, product, details, depth + 1)
    );
    const result = combineStatuses(expression.operator, childStatuses);
    addDetail(details, depth, `Result: ${result.toUpperCase()}`);
    return result;
  }

  if (expression.kind === "Taxonomy") {
    const descriptor = expression.description ?? `Taxonomy concept ${expression.taxonomyConceptId}`;
    if (expression.subjectRef === "currentProduct") {
      const hasConcept = product.tags.includes(expression.taxonomyConceptId);
      addDetail(
        details,
        depth,
        `${hasConcept ? "✓" : "✗"} ${descriptor} (${expression.taxonomyConceptId}) on current product`
      );
      return hasConcept ? "pass" : "fail";
    }
    addDetail(
      details,
      depth,
      `? ${descriptor} (${expression.taxonomyConceptId}) requires '${expression.subjectRef}' context (not available in demo)`
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
    addDetail(details, depth, "? Feature condition evaluation not implemented in the demo");
    return "unknown";
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

const describeTarget = (target: RuleTarget) => {
  if (target.kind === "Taxonomy") {
    const suffix = target.description ? ` – ${target.description}` : "";
    return `Target ${target.targetId}: ${target.action} taxonomy concept ${target.conceptId}${suffix}`;
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

const evaluateRules = (product: Product, rules: Rule[]): RuleEvaluationResult[] =>
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

    const status = evaluateLogicalExpression(rule.expression, product, details, 0);

    if (rule.targets.length) {
      for (const target of rule.targets) {
        details.push(describeTarget(target));
      }
    } else {
      details.push("⚠ No targets defined");
    }

    details.push(...describeScope(rule.scope));

    return {
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

  const taxonomy = useTaxonomy(DEFAULT_CONCEPTS, COLLECTIONS);
  const { concepts, collections, conceptLabel, orderedConcepts } = taxonomy;

  const retailerPartners = useMemo(
    () => partners.filter((partner) => partner.roles.includes("retailer")),
    [partners]
  );
  const selectedPartnerProducts = selectedRetailPartnerId
    ? partnerAssociations[selectedRetailPartnerId] ?? []
    : [];

  const [rules, setRules] = useState<Rule[]>(() => [createIndianMealRule()]);

  const [retailerPayload, setRetailerPayload] = useState<RetailerPayload | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: AlertColor }>({
    open: false,
    message: "",
    severity: "info",
  });
  const notify = (message: string, severity: AlertColor = "info") => {
    setSnack({ open: true, message, severity });
  };

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

  const activeProduct =
    selectedInstance?.product ?? instantiateProduct(schemas[0] ?? defaultSchemaTemplate(), collections).product;
  const ruleResults = useMemo(() => evaluateRules(activeProduct, rules), [activeProduct, rules]);

  const exportSupplierPayload = () => {
    if (!selectedInstance) return null;
    const payload = {
      product: selectedInstance.product,
      schemaId: selectedInstance.schemaId,
      referenceSystems,
      conceptSchemes: CONCEPT_SCHEMES.map((scheme) => scheme.id),
      concepts,
      collections,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    notify("Payload copied to clipboard", "success");
    return payload;
  };

  const simulateRetailerIngest = (payloadText?: string) => {
    try {
      const payload = payloadText ? JSON.parse(payloadText) : { product: selectedInstance?.product };
      if (!payload.product) throw new Error("No product provided");
      const mapping = new Map(MAPPINGS.map((item) => [item.fromConceptId, item.toConceptId] as const));
      const translate = (id: string) => mapping.get(id) ?? id;
      const remapped: Product = {
        ...payload.product,
        tags: payload.product.tags.map(translate),
        features: payload.product.features.map((feature: Product["features"][number]) => ({
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

  return (
    <ThemeProvider theme={theme}>
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Product Information Exchange Workbench
          </Typography>
        </Toolbar>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" allowScrollButtonsMobile>
          <Tab id="tab-0" label="Product Schemas" />
          <Tab id="tab-1" label="Taxonomy" />
        <Tab id="tab-2" label="Specified Products" />
        <Tab id="tab-3" label="Reference Systems" />
        <Tab id="tab-4" label="Rules" />
        <Tab id="tab-5" label="Exchange" />
        <Tab id="tab-6" label="Partners" />
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
              metadata={taxonomy.metadata}
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
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <RulesWorkspace rules={rules} onChange={setRules} conceptLabel={conceptLabel} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardHeader
                    title="Run Rules"
                    action={
                      <Button startIcon={<PlayArrowIcon />} onClick={() => notify("Rules evaluated")}>
                        Run
                      </Button>
                    }
                  />
                  <CardContent>
                    {ruleResults.map((result) => (
                      <Card key={result.ruleId} variant="outlined" sx={{ borderRadius: 2, p: 2, mb: 2 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Box>
                            <Typography variant="subtitle1">{result.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {result.ruleId}
                            </Typography>
                          </Box>
                          <Chip
                            label={result.status.toUpperCase()}
                            color={result.status === "pass" ? "success" : result.status === "fail" ? "error" : "default"}
                            variant={result.status === "unknown" ? "outlined" : "filled"}
                          />
                        </Stack>
                        <Divider sx={{ my: 1 }} />
                        <Stack spacing={0.5}>
                          {result.details.map((detail, index) => (
                            <Typography key={index} variant="body2">
                              {detail}
                            </Typography>
                          ))}
                        </Stack>
                      </Card>
                    ))}
                    {ruleResults.length === 0 && (
                      <Box sx={{ textAlign: "center", py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No rules to evaluate.
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Box>
            </Stack>
          </Suspense>
        </Box>
      )}

      {tab === 5 && (
        <Box sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardHeader
                  title="Supplier Payload"
                  action={
                    <Stack direction="row" spacing={1}>
                      <Button startIcon={<ContentCopyIcon />} onClick={exportSupplierPayload} disabled={!selectedInstance}>
                        Copy
                      </Button>
                      <Button
                        startIcon={<DownloadIcon />}
                        onClick={() => {
                          const payload = exportSupplierPayload();
                          if (payload) downloadJson(`payload-${selectedInstance?.product.name ?? "product"}.json`, payload);
                        }}
                        disabled={!selectedInstance}
                      >
                        Download
                      </Button>
                    </Stack>
                  }
                />
                <CardContent>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {selectedInstance ? "Current product payload preview." : "Select a product to see the payload."}
                  </Typography>
                  <pre style={{ margin: 0, maxHeight: 320, overflow: "auto" }}>
                    {selectedInstance
                      ? JSON.stringify({ product: selectedInstance.product, referenceSystems }, null, 2)
                      : "—"}
                  </pre>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardHeader
                  title="Retailer View (Simulated)"
                  action={
                    <Button startIcon={<UploadIcon />} onClick={() => simulateRetailerIngest()}>
                      Import current
                    </Button>
                  }
                />
                <CardContent>
                  <Stack spacing={2}>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        const text = prompt("Paste supplier JSON payload:");
                        if (text != null) simulateRetailerIngest(text);
                      }}
                    >
                      Paste payload
                    </Button>
                    {retailerPayload ? (
                      <pre style={{ margin: 0, maxHeight: 320, overflow: "auto" }}>
                        {JSON.stringify(retailerPayload, null, 2)}
                      </pre>
                    ) : (
                      <Alert severity="info">No retailer payload yet.</Alert>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Box>
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

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((previous) => ({ ...previous, open: false }))}>
        <Alert severity={snack.severity} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
};

export default App;
