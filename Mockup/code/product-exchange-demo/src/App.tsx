import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  FormControl,
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
import SchemaWorkspace from "./components/SchemaWorkspace";
import ProductWorkspace from "./components/ProductWorkspace";
import {
  COLLECTIONS,
  DEFAULT_CONCEPTS,
  CONCEPT_SCHEMES,
  REF_SYSTEMS,
  SCHEMA_CATEGORIES,
  createRule,
  defaultSchemaTemplate,
  instantiateProduct,
  schemaCategoryLabel,
  updateTimestamp,
} from "./domain";
import type { Product, ProductInstance, ProductSchema, Rule, SchemaCategory, TaxonomyCondition } from "./domain";
import { useTaxonomy } from "./taxonomy";
import { loadInstances, loadSchemas, persistInstances, persistSchemas } from "./storage";

type RetailerPayload = { receivedAt: string; product: Product };

const MAPPINGS = [
  { fromConceptId: "C-PriorityBoarding", toConceptId: "C-PriorityBoarding" },
  { fromConceptId: "C-Flight", toConceptId: "C-Flight" },
];

const downloadJson = (fileName: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const evaluateRules = (product: Product, rules: Rule[]) =>
  rules.map((rule) => {
    const details: string[] = [];
    let passed = true;
    const hasConcept = (conceptId: string, target: "Product" | "Feature" | "FeatureValue") => {
      if (target === "Product") return product.tags.includes(conceptId);
      if (target === "Feature") return product.features.some((feature) => feature.tags.includes(conceptId));
      return product.features.some((feature) =>
        feature.values.some((value) => value.referenceSystemId === conceptId)
      );
    };
    for (const condition of rule.conditions) {
      if (condition.kind === "HasConcept") {
        const ok = hasConcept(condition.conceptId, condition.target);
        details.push(ok ? `✓ Concept ${condition.conceptId} present on ${condition.target}` : `✗ Missing concept ${condition.conceptId} on ${condition.target}`);
        passed &&= ok;
      } else if (condition.kind === "FeatureExists") {
        const ok = product.features.some((feature) => feature.name === condition.featureName);
        details.push(ok ? `✓ Feature '${condition.featureName}' exists` : `✗ Feature '${condition.featureName}' not found`);
        passed &&= ok;
      } else if (condition.kind === "ValueInRange") {
        const feature = product.features.find((f) => f.name === condition.featureName);
        let ok = false;
        if (feature) {
          for (const value of feature.values) {
            if (value.kind === "SingleValue") {
              const numeric = Number(value.value);
              if (!Number.isNaN(numeric)) {
                ok =
                  (condition.min === undefined || numeric >= condition.min) &&
                  (condition.max === undefined || numeric <= condition.max);
              }
            } else if (value.kind === "ValueRange") {
              const min = Number(value.min);
              const max = Number(value.max);
              if (!Number.isNaN(min) && !Number.isNaN(max)) {
                const lowerOk = condition.min === undefined || max >= condition.min;
                const upperOk = condition.max === undefined || min <= condition.max;
                ok = lowerOk && upperOk;
              }
            }
            if (ok) break;
          }
        }
        details.push(ok ? `✓ ${condition.featureName} within range` : `✗ ${condition.featureName} not within range`);
        passed &&= ok;
      }
    }
    return { ruleId: rule.id, name: rule.name, passed, details };
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
    if (stored.length) return stored;
    const schema = defaultSchemaTemplate();
    schema.name = "New Product Schema";
    return [schema];
  });
  const [instances, setInstances] = useState<ProductInstance[]>(() => loadInstances());

  const [schemaSelection, setSchemaSelection] = useState<string | null>(schemas[0]?.id ?? null);
  const [productSchemaSelection, setProductSchemaSelection] = useState<string | null>(schemas[0]?.id ?? null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    instances.find((instance) => instance.schemaId === productSchemaSelection)?.id ?? null
  );

  const { concepts, conceptLabel, orderedConcepts } = useTaxonomy(DEFAULT_CONCEPTS);

  const [rules, setRules] = useState<Rule[]>([
    {
      ...createRule("Priority boarding requires Flight tag"),
      conditions: [
        { kind: "HasConcept", conceptId: "C-Flight", target: "Product" } satisfies TaxonomyCondition,
        { kind: "FeatureExists", featureName: "Origin" },
      ],
    },
  ]);

  const [retailerPayload, setRetailerPayload] = useState<RetailerPayload | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: AlertColor }>({
    open: false,
    message: "",
    severity: "info",
  });

  useEffect(() => {
    persistSchemas(schemas);
  }, [schemas]);

  useEffect(() => {
    persistInstances(instances);
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
    setSnack({ open: true, message: `Schema '${name}' created`, severity: "success" });
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
    setSnack({ open: true, message: "Schema deleted", severity: "info" });
  };

  const handleExportSchema = (schema: ProductSchema) => {
    downloadJson(`schema-${schema.name.replace(/\s+/g, "-").toLowerCase()}.json`, schema);
  };

  const handlePersistSchemas = () => {
    persistSchemas(schemas);
    setSnack({ open: true, message: "Schemas saved", severity: "success" });
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

  const handleInstantiate = (schemaId: string, name: string) => {
    const schema = schemas.find((item) => item.id === schemaId);
    if (!schema) return;
    const instance = instantiateProduct(schema);
    instance.product.name = name;
    instance.product.type = schemaCategoryLabel(schema.category);
    setInstances((previous) => [...previous, instance]);
    setProductSchemaSelection(schemaId);
    setSelectedInstanceId(instance.id);
    setSnack({ open: true, message: `Product '${name}' created`, severity: "success" });
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
    setSnack({ open: true, message: "Product deleted", severity: "info" });
  };

  const handleExportInstance = (instance: ProductInstance) => {
    downloadJson(`product-${instance.product.name.replace(/\s+/g, "-").toLowerCase()}.json`, instance);
  };

  const handlePersistInstances = () => {
    persistInstances(instances);
    setSnack({ open: true, message: "Products saved", severity: "success" });
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

  const replaceRuleCondition = (ruleId: string, index: number, condition: Rule["conditions"][number]) => {
    setRules((previous) =>
      previous.map((rule) =>
        rule.id === ruleId
          ? { ...rule, conditions: rule.conditions.map((existing, idx) => (idx === index ? condition : existing)) }
          : rule
      )
    );
  };

  const updateRuleCondition = (
    ruleId: string,
    index: number,
    updater: (condition: Rule["conditions"][number]) => Rule["conditions"][number]
  ) => {
    setRules((previous) =>
      previous.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              conditions: rule.conditions.map((condition, idx) => (idx === index ? updater(condition) : condition)),
            }
          : rule
      )
    );
  };

  const activeProduct = selectedInstance?.product ?? instantiateProduct(schemas[0] ?? defaultSchemaTemplate()).product;
  const ruleResults = useMemo(() => evaluateRules(activeProduct, rules), [activeProduct, rules]);

  const exportSupplierPayload = () => {
    if (!selectedInstance) return null;
    const payload = {
      product: selectedInstance.product,
      schemaId: selectedInstance.schemaId,
      refs: REF_SYSTEMS,
      conceptSchemes: CONCEPT_SCHEMES.map((scheme) => scheme.id),
      concepts,
      collections: COLLECTIONS,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setSnack({ open: true, message: "Payload copied to clipboard", severity: "success" });
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
      setSnack({ open: true, message: "Retailer ingest OK", severity: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSnack({ open: true, message: `Import failed: ${message}`, severity: "error" });
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Product Exchange Workbench
          </Typography>
        </Toolbar>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" allowScrollButtonsMobile>
          <Tab id="tab-0" label="Product Schemas" />
          <Tab id="tab-1" label="Specified Products" />
          <Tab id="tab-2" label="Reference Systems" />
          <Tab id="tab-3" label="Rules" />
          <Tab id="tab-4" label="Exchange" />
        </Tabs>
      </AppBar>

      {tab === 0 && (
        <Box sx={{ p: 2 }}>
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
            conceptLabel={conceptLabel}
            orderedConcepts={orderedConcepts}
            referenceSystems={REF_SYSTEMS}
          />
        </Box>
      )}

      {tab === 1 && (
        <Box sx={{ p: 2 }}>
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
            conceptLabel={conceptLabel}
            orderedConcepts={orderedConcepts}
            referenceSystems={REF_SYSTEMS}
          />
        </Box>
      )}

      {tab === 2 && (
        <Box sx={{ p: 2 }}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardHeader title="Reference Systems Registry" subheader="Used to validate or qualify feature values." />
            <CardContent>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
                }}
              >
                {REF_SYSTEMS.map((reference) => (
                  <Card key={reference.id} variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardHeader title={reference.name} subheader={`Type: ${reference.type}`} />
                    <CardContent>
                      <Typography variant="body2">Identifier: {reference.id}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Source: {reference.source ?? "—"}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {tab === 3 && (
        <Box sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardHeader
                  title="Rules"
                  action={
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setRules((previous) => [...previous, createRule("New rule")])}
                    >
                      Add
                    </Button>
                  }
                />
                <CardContent>
                  <Stack spacing={2}>
                    {rules.map((rule) => (
                      <Card key={rule.id} variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <TextField
                            label="Rule name"
                            size="small"
                            value={rule.name}
                            onChange={(event) =>
                              setRules((previous) =>
                                previous.map((current) =>
                                  current.id === rule.id ? { ...current, name: event.target.value } : current
                                )
                              )
                            }
                          />
                          <Button
                            size="small"
                            color="error"
                            onClick={() => setRules((previous) => previous.filter((current) => current.id !== rule.id))}
                          >
                            Delete
                          </Button>
                        </Stack>
                        <Divider sx={{ my: 1 }} />
                        <Stack spacing={1}>
                          {rule.conditions.map((condition, index) => (
                            <Stack key={`${rule.id}-${index}`} direction={{ xs: "column", sm: "row" }} spacing={1}>
                              <FormControl size="small" sx={{ minWidth: 160 }}>
                                <InputLabel id={`rule-kind-${rule.id}-${index}`}>Condition</InputLabel>
                                <Select
                                  labelId={`rule-kind-${rule.id}-${index}`}
                                  label="Condition"
                                  value={condition.kind}
                                  onChange={(event) => {
                                    const kind = event.target.value as Rule["conditions"][number]["kind"];
                                    if (kind === "HasConcept") {
                                      replaceRuleCondition(rule.id, index, {
                                        kind: "HasConcept",
                                        conceptId: "C-Flight",
                                        target: "Product",
                                      });
                                    } else if (kind === "FeatureExists") {
                                      replaceRuleCondition(rule.id, index, {
                                        kind: "FeatureExists",
                                        featureName: "Origin",
                                      });
                                    } else {
                                      replaceRuleCondition(rule.id, index, {
                                        kind: "ValueInRange",
                                        featureName: "Checked Baggage (kg)",
                                        min: 0,
                                        max: 23,
                                      });
                                    }
                                  }}
                                >
                                  <MenuItem value="HasConcept">HasConcept</MenuItem>
                                  <MenuItem value="FeatureExists">FeatureExists</MenuItem>
                                  <MenuItem value="ValueInRange">ValueInRange</MenuItem>
                                </Select>
                              </FormControl>
                              {condition.kind === "HasConcept" && (
                                <>
                                  <FormControl size="small" sx={{ minWidth: 160 }}>
                                    <InputLabel id={`rule-target-${rule.id}-${index}`}>Target</InputLabel>
                                    <Select
                                      labelId={`rule-target-${rule.id}-${index}`}
                                      label="Target"
                                      value={condition.target}
                                      onChange={(event) =>
                                        updateRuleCondition(rule.id, index, (current) =>
                                          current.kind === "HasConcept"
                                            ? { ...current, target: event.target.value as TaxonomyCondition["target"] }
                                            : current
                                        )
                                      }
                                    >
                                      <MenuItem value="Product">Product</MenuItem>
                                      <MenuItem value="Feature">Feature</MenuItem>
                                      <MenuItem value="FeatureValue">FeatureValue</MenuItem>
                                    </Select>
                                  </FormControl>
                                  <FormControl size="small" sx={{ minWidth: 200 }}>
                                    <InputLabel id={`rule-concept-${rule.id}-${index}`}>Concept</InputLabel>
                                    <Select
                                      labelId={`rule-concept-${rule.id}-${index}`}
                                      label="Concept"
                                      value={condition.conceptId}
                                      onChange={(event) =>
                                        updateRuleCondition(rule.id, index, (current) =>
                                          current.kind === "HasConcept"
                                            ? { ...current, conceptId: event.target.value }
                                            : current
                                        )
                                      }
                                    >
                                      {orderedConcepts.map((concept) => (
                                        <MenuItem key={concept.id} value={concept.id}>
                                          {concept.label}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </>
                              )}
                              {condition.kind !== "HasConcept" && (
                                <>
                                  <TextField
                                    size="small"
                                    label="Feature name"
                                    value={condition.featureName}
                                    onChange={(event) =>
                                      updateRuleCondition(rule.id, index, (current) =>
                                        current.kind === "HasConcept"
                                          ? current
                                          : { ...current, featureName: event.target.value }
                                      )
                                    }
                                  />
                                  {condition.kind === "ValueInRange" && (
                                    <>
                                      <TextField
                                        size="small"
                                        label="Min"
                                        type="number"
                                        value={condition.min ?? ""}
                                        onChange={(event) =>
                                          updateRuleCondition(rule.id, index, (current) =>
                                            current.kind === "ValueInRange"
                                              ? {
                                                  ...current,
                                                  min: event.target.value === "" ? undefined : Number(event.target.value),
                                                }
                                              : current
                                          )
                                        }
                                      />
                                      <TextField
                                        size="small"
                                        label="Max"
                                        type="number"
                                        value={condition.max ?? ""}
                                        onChange={(event) =>
                                          updateRuleCondition(rule.id, index, (current) =>
                                            current.kind === "ValueInRange"
                                              ? {
                                                  ...current,
                                                  max: event.target.value === "" ? undefined : Number(event.target.value),
                                                }
                                              : current
                                          )
                                        }
                                      />
                                    </>
                                  )}
                                </>
                              )}
                              <Button
                                size="small"
                                color="error"
                                onClick={() =>
                                  setRules((previous) =>
                                    previous.map((current) =>
                                      current.id === rule.id
                                        ? {
                                            ...current,
                                            conditions: current.conditions.filter((_, idx) => idx !== index),
                                          }
                                        : current
                                    )
                                  )
                                }
                              >
                                Remove
                              </Button>
                            </Stack>
                          ))}
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() =>
                                setRules((previous) =>
                                  previous.map((current) =>
                                    current.id === rule.id
                                      ? {
                                          ...current,
                                          conditions: [
                                            ...current.conditions,
                                            { kind: "HasConcept", conceptId: "C-Flight", target: "Product" } satisfies TaxonomyCondition,
                                          ],
                                        }
                                      : current
                                  )
                                )
                              }
                            >
                              Add HasConcept
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() =>
                                setRules((previous) =>
                                  previous.map((current) =>
                                    current.id === rule.id
                                      ? {
                                          ...current,
                                          conditions: [
                                            ...current.conditions,
                                            { kind: "FeatureExists", featureName: "Origin" },
                                          ],
                                        }
                                      : current
                                  )
                                )
                              }
                            >
                              Add FeatureExists
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() =>
                                setRules((previous) =>
                                  previous.map((current) =>
                                    current.id === rule.id
                                      ? {
                                          ...current,
                                          conditions: [
                                            ...current.conditions,
                                            { kind: "ValueInRange", featureName: "Checked Baggage (kg)", min: 0, max: 23 },
                                          ],
                                        }
                                      : current
                                  )
                                )
                              }
                            >
                              Add ValueInRange
                            </Button>
                          </Stack>
                        </Stack>
                      </Card>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardHeader
                  title="Run Rules"
                  action={
                    <Button startIcon={<PlayArrowIcon />} onClick={() => setSnack({ open: true, message: "Rules evaluated", severity: "info" })}>
                      Run
                    </Button>
                  }
                />
                <CardContent>
                  {ruleResults.map((result) => (
                    <Card key={result.ruleId} variant="outlined" sx={{ borderRadius: 2, p: 2, mb: 2 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="subtitle1">{result.name}</Typography>
                        <Chip label={result.passed ? "PASS" : "FAIL"} color={result.passed ? "success" : "error"} variant="outlined" />
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
                </CardContent>
              </Card>
            </Box>
          </Stack>
        </Box>
      )}

      {tab === 4 && (
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
                      ? JSON.stringify({ product: selectedInstance.product, refs: REF_SYSTEMS }, null, 2)
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

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((previous) => ({ ...previous, open: false }))}>
        <Alert severity={snack.severity} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
};

export default App;
