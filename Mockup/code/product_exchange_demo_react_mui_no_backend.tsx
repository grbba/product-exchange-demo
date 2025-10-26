import React, { useMemo, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab,
  Box,
  Grid,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Snackbar,
  Alert,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import DownloadIcon from "@mui/icons-material/Download";
import UploadIcon from "@mui/icons-material/Upload";
import { TreeView, TreeItem } from "@mui/lab";

// ------------------------------
// Minimal domain model (based on your AFM + ISO25964 + Hooks + Rules)
// ------------------------------

// AFM: FeatureValue kinds
export type SingleValue = { kind: "SingleValue"; value: string; referenceSystemId?: string };
export type ValueRange = { kind: "ValueRange"; min: string; max: string; referenceSystemId?: string };
export type DiscreteSet = { kind: "DiscreteSet"; values: string[]; referenceSystemId?: string };
export type FeatureValue = SingleValue | ValueRange | DiscreteSet;

export type Feature = {
  id: string;
  name: string;
  description?: string;
  values: FeatureValue[];
  tags: string[]; // concept ids
};

export type Product = {
  id: string;
  name: string;
  type?: string; // ProductType
  lifecycleStatus: "Draft" | "Active" | "EndOfLife";
  features: Feature[];
  tags: string[]; // concept ids
  additionalInfo?: Record<string, string>; // AdditionalProductInformation
};

// Reference systems
export type ReferenceSystem = {
  id: string;
  name: string;
  type: "CodeList" | "Unit" | "Schema";
  source?: string; // ReferenceSource
};

// ISO 25964 bits
export type Concept = { id: string; label: string; altLabels?: string[] };
export type ConceptScheme = { id: string; label: string; topConcepts: string[] };
export type Collection = { id: string; label: string; members: string[] };
export type Mapping = { fromConceptId: string; toConceptId: string; relation: "exactMatch" | "closeMatch" };

// Tag (glue)
export type Tag = { id: string; conceptId: string; target: { kind: "Product" | "Feature" | "FeatureValue"; ids: string[] } };

// Rules (very light)
export type TaxonomyCondition = { kind: "HasConcept"; conceptId: string; target: "Product" | "Feature" | "FeatureValue" };
export type FeatureCondition =
  | { kind: "FeatureExists"; featureName: string }
  | { kind: "ValueInRange"; featureName: string; min?: number; max?: number };
export type Rule = {
  id: string;
  name: string;
  conditions: (TaxonomyCondition | FeatureCondition)[];
};

// ------------------------------
// Stub data (client-side only)
// ------------------------------

const REF_SYSTEMS: ReferenceSystem[] = [
  { id: "RS-IATA", name: "IATA Airport Code", type: "CodeList", source: "IATA" },
  { id: "RS-UNIT-KG", name: "Kilogram", type: "Unit", source: "SI" },
  { id: "RS-UNIT-CM", name: "Centimeter", type: "Unit", source: "SI" },
];

const CONCEPTS: Concept[] = [
  { id: "C-Flight", label: "Flight" },
  { id: "C-PriorityBoarding", label: "Priority boarding" },
  { id: "C-Baggage", label: "Baggage" },
  { id: "C-Origin", label: "Origin airport" },
  { id: "C-Destination", label: "Destination airport" },
  { id: "C-Seat", label: "Seat assignment" },
];

const SCHEMES: ConceptScheme[] = [
  { id: "SCH-Airline", label: "Airline Services", topConcepts: ["C-Flight", "C-Baggage", "C-Seat"] },
];

const COLLECTIONS: Collection[] = [
  { id: "COL-Ancillaries", label: "Ancillary Services", members: ["C-PriorityBoarding", "C-Seat"] },
];

// Simple supplier→retailer concept mapping (demo only)
const MAPPINGS: Mapping[] = [
  { fromConceptId: "C-PriorityBoarding", toConceptId: "C-PriorityBoarding", relation: "exactMatch" },
  { fromConceptId: "C-Flight", toConceptId: "C-Flight", relation: "exactMatch" },
];

// ------------------------------
// Helpers
// ------------------------------

const uid = () => Math.random().toString(36).slice(2, 9);

function TabPanel({ index, value, children }: { index: number; value: number; children: React.ReactNode }) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`tabpanel-${index}`} aria-labelledby={`tab-${index}`}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

// Evaluate rules against a product
function evaluateRules(product: Product, rules: Rule[]): { ruleId: string; name: string; passed: boolean; details: string[] }[] {
  return rules.map((r) => {
    const details: string[] = [];
    let passed = true;

    const hasConceptOn = (conceptId: string, target: "Product" | "Feature" | "FeatureValue") => {
      if (target === "Product") return product.tags.includes(conceptId);
      if (target === "Feature") return product.features.some((f) => f.tags.includes(conceptId));
      return product.features.some((f) => f.values.some(() => false)); // not used in this minimal demo
    };

    for (const c of r.conditions) {
      if (c.kind === "HasConcept") {
        const ok = hasConceptOn(c.conceptId, c.target);
        details.push(ok ? `✓ Concept ${c.conceptId} present on ${c.target}` : `✗ Missing concept ${c.conceptId} on ${c.target}`);
        passed &&= ok;
      } else if (c.kind === "FeatureExists") {
        const ok = product.features.some((f) => f.name === c.featureName);
        details.push(ok ? `✓ Feature '${c.featureName}' exists` : `✗ Feature '${c.featureName}' not found`);
        passed &&= ok;
      } else if (c.kind === "ValueInRange") {
        const ft = product.features.find((f) => f.name === c.featureName);
        let ok = false;
        if (ft) {
          // Look for SingleValue numeric or ValueRange overlapping
          for (const v of ft.values) {
            if (v.kind === "SingleValue") {
              const n = Number(v.value);
              if (!isNaN(n)) {
                ok = (c.min === undefined || n >= c.min) && (c.max === undefined || n <= c.max);
              }
            } else if (v.kind === "ValueRange") {
              const nMin = Number(v.min);
              const nMax = Number(v.max);
              if (!isNaN(nMin) && !isNaN(nMax)) {
                const inLow = c.min === undefined || nMax >= c.min;
                const inHigh = c.max === undefined || nMin <= c.max;
                ok = inLow && inHigh;
              }
            }
            if (ok) break;
          }
        }
        details.push(ok ? `✓ ${c.featureName} within range` : `✗ ${c.featureName} not within range`);
        passed &&= ok;
      }
    }

    return { ruleId: r.id, name: r.name, passed, details };
  });
}

// ------------------------------
// Main App
// ------------------------------

export default function App() {
  const theme = useMemo(() => createTheme({
    cssVariables: true,
    palette: { mode: "light" }, // Material 3 baseline, no custom brand
    typography: { fontSize: 14 },
  }), []);

  const [tab, setTab] = useState(0);

  const [product, setProduct] = useState<Product>({
    id: uid(),
    name: "Transatlantic Fare",
    type: "FareProduct",
    lifecycleStatus: "Draft",
    features: [
      { id: uid(), name: "Origin", values: [{ kind: "SingleValue", value: "CDG", referenceSystemId: "RS-IATA" }], tags: ["C-Origin"] },
      { id: uid(), name: "Destination", values: [{ kind: "SingleValue", value: "JFK", referenceSystemId: "RS-IATA" }], tags: ["C-Destination"] },
      { id: uid(), name: "Checked Baggage (kg)", values: [{ kind: "ValueRange", min: "0", max: "23", referenceSystemId: "RS-UNIT-KG" }], tags: ["C-Baggage"] },
    ],
    tags: ["C-Flight"],
  });

  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(product.features[0]?.id ?? null);
  const selectedFeature = product.features.find((f) => f.id === selectedFeatureId) || null;

  const [rules, setRules] = useState<Rule[]>([
    {
      id: uid(),
      name: "Priority boarding requires Flight tag",
      conditions: [
        { kind: "HasConcept", conceptId: "C-Flight", target: "Product" },
        { kind: "FeatureExists", featureName: "Origin" },
      ],
    },
  ]);

  const [retailerPayload, setRetailerPayload] = useState<any | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: "success" | "info" | "warning" | "error" }>({ open: false, message: "", severity: "info" });

  // ------------------ Event handlers
  const updateProductField = (field: keyof Product, value: any) => setProduct((p) => ({ ...p, [field]: value }));

  const addFeature = () => {
    const f: Feature = { id: uid(), name: "New Feature", description: "", values: [], tags: [] };
    setProduct((p) => ({ ...p, features: [...p.features, f] }));
    setSelectedFeatureId(f.id);
  };

  const removeFeature = (id: string) => setProduct((p) => ({ ...p, features: p.features.filter((f) => f.id !== id) }));

  const setFeature = (id: string, patch: Partial<Feature>) =>
    setProduct((p) => ({
      ...p,
      features: p.features.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));

  const addValueToFeature = (id: string, kind: FeatureValue["kind"]) => {
    const blank: FeatureValue =
      kind === "SingleValue"
        ? { kind: "SingleValue", value: "" }
        : kind === "ValueRange"
        ? { kind: "ValueRange", min: "", max: "" }
        : { kind: "DiscreteSet", values: [] };
    setFeature(id, { values: [...(product.features.find((f) => f.id === id)?.values ?? []), blank] });
  };

  const removeValueFromFeature = (fid: string, vidx: number) => {
    const f = product.features.find((x) => x.id === fid);
    if (!f) return;
    const next = [...f.values];
    next.splice(vidx, 1);
    setFeature(fid, { values: next });
  };

  const addTagToTarget = (conceptId: string, target: "Product" | "Feature") => {
    if (target === "Product") {
      if (!product.tags.includes(conceptId)) setProduct((p) => ({ ...p, tags: [...p.tags, conceptId] }));
    } else if (selectedFeature) {
      if (!selectedFeature.tags.includes(conceptId)) setFeature(selectedFeature.id, { tags: [...selectedFeature.tags, conceptId] });
    }
  };

  const exportSupplierPayload = () => {
    const payload = { product, refs: REF_SYSTEMS, schemes: SCHEMES.map((s) => s.id), concepts: CONCEPTS, collections: COLLECTIONS };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setSnack({ open: true, message: "Supplier payload copied to clipboard", severity: "success" });
    return payload;
  };

  const simulateRetailerIngest = (payloadText?: string) => {
    try {
      const input = payloadText ? JSON.parse(payloadText) : { product, concepts: CONCEPTS };
      // Apply very simple concept mapping using MAPPINGS
      const mapIndex = new Map(MAPPINGS.map((m) => [m.fromConceptId, m.toConceptId] as const));
      const remapConcept = (cid: string) => mapIndex.get(cid) ?? cid;
      const pIn: Product = input.product;
      const remapped: Product = {
        ...pIn,
        tags: pIn.tags.map(remapConcept),
        features: pIn.features.map((f) => ({ ...f, tags: f.tags.map(remapConcept) })),
      };
      setRetailerPayload({ receivedAt: new Date().toISOString(), product: remapped });
      setSnack({ open: true, message: "Retailer ingest OK", severity: "success" });
    } catch (e: any) {
      setSnack({ open: true, message: `Import failed: ${e.message ?? e}`, severity: "error" });
    }
  };

  const ruleResults = useMemo(() => evaluateRules(product, rules), [product, rules]);

  // ------------------ UI helpers
  const FeatureCard = ({ f }: { f: Feature }) => (
    <Card variant="outlined" sx={{ mb: 2, borderRadius: 3 }}>
      <CardHeader
        title={
          <TextField
            size="small"
            label="Feature name"
            value={f.name}
            onChange={(e) => setFeature(f.id, { name: e.target.value })}
          />
        }
        action={
          <IconButton aria-label="delete feature" onClick={() => removeFeature(f.id)}>
            <DeleteIcon />
          </IconButton>
        }
      />
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap" }}>
          {f.tags.map((cid) => (
            <Chip key={cid} label={CONCEPTS.find((c) => c.id === cid)?.label ?? cid} size="small" />
          ))}
        </Stack>
        <Grid container spacing={2}>
          {f.values.map((v, idx) => (
            <Grid item xs={12} md={6} key={idx}>
              <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Chip label={v.kind} size="small" />
                  <IconButton aria-label="delete value" onClick={() => removeValueFromFeature(f.id, idx)}>
                    <DeleteIcon />
                  </IconButton>
                </Stack>
                <Box sx={{ mt: 2 }}>
                  {v.kind === "SingleValue" && (
                    <Stack spacing={2}>
                      <TextField
                        label="Value"
                        size="small"
                        value={v.value}
                        onChange={(e) => {
                          const next = [...f.values];
                          (next[idx] as SingleValue).value = e.target.value;
                          setFeature(f.id, { values: next });
                        }}
                      />
                      <FormControl size="small">
                        <InputLabel id={`ref-${f.id}-${idx}`}>Reference</InputLabel>
                        <Select
                          labelId={`ref-${f.id}-${idx}`}
                          value={v.referenceSystemId ?? ""}
                          label="Reference"
                          onChange={(e) => {
                            const next = [...f.values];
                            (next[idx] as SingleValue).referenceSystemId = e.target.value || undefined;
                            setFeature(f.id, { values: next });
                          }}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {REF_SYSTEMS.map((r) => (
                            <MenuItem key={r.id} value={r.id}>{`${r.name} (${r.type})`}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                  )}
                  {v.kind === "ValueRange" && (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField
                        label="Min"
                        size="small"
                        value={v.min}
                        onChange={(e) => {
                          const next = [...f.values];
                          (next[idx] as ValueRange).min = e.target.value;
                          setFeature(f.id, { values: next });
                        }}
                      />
                      <TextField
                        label="Max"
                        size="small"
                        value={v.max}
                        onChange={(e) => {
                          const next = [...f.values];
                          (next[idx] as ValueRange).max = e.target.value;
                          setFeature(f.id, { values: next });
                        }}
                      />
                      <FormControl size="small" fullWidth>
                        <InputLabel id={`refvr-${f.id}-${idx}`}>Reference</InputLabel>
                        <Select
                          labelId={`refvr-${f.id}-${idx}`}
                          value={v.referenceSystemId ?? ""}
                          label="Reference"
                          onChange={(e) => {
                            const next = [...f.values];
                            (next[idx] as ValueRange).referenceSystemId = e.target.value || undefined;
                            setFeature(f.id, { values: next });
                          }}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {REF_SYSTEMS.map((r) => (
                            <MenuItem key={r.id} value={r.id}>{`${r.name} (${r.type})`}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                  )}
                  {v.kind === "DiscreteSet" && (
                    <Stack spacing={1}>
                      <TextField
                        size="small"
                        label="Comma-separated values"
                        value={v.values.join(", ")}
                        onChange={(e) => {
                          const next = [...f.values];
                          (next[idx] as DiscreteSet).values = e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean);
                          setFeature(f.id, { values: next });
                        }}
                      />
                      <FormControl size="small">
                        <InputLabel id={`refds-${f.id}-${idx}`}>Reference</InputLabel>
                        <Select
                          labelId={`refds-${f.id}-${idx}`}
                          value={v.referenceSystemId ?? ""}
                          label="Reference"
                          onChange={(e) => {
                            const next = [...f.values];
                            (next[idx] as DiscreteSet).referenceSystemId = e.target.value || undefined;
                            setFeature(f.id, { values: next });
                          }}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {REF_SYSTEMS.map((r) => (
                            <MenuItem key={r.id} value={r.id}>{`${r.name} (${r.type})`}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                  )}
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => addValueToFeature(f.id, "SingleValue")}>
            Add SingleValue
          </Button>
          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => addValueToFeature(f.id, "ValueRange")}>
            Add ValueRange
          </Button>
          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => addValueToFeature(f.id, "DiscreteSet")}>
            Add DiscreteSet
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );

  // Columns for reference systems table
  const refCols: GridColDef[] = [
    { field: "id", headerName: "ID", width: 150 },
    { field: "name", headerName: "Name", flex: 1 },
    { field: "type", headerName: "Type", width: 120 },
    { field: "source", headerName: "Source", width: 160 },
  ];

  const productConceptChips = (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
      {product.tags.map((cid) => (
        <Chip key={cid} label={CONCEPTS.find((c) => c.id === cid)?.label ?? cid} />
      ))}
    </Stack>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Supplier → Retailer Product Exchange (Demo, Material 3)
          </Typography>
          <ToggleButtonGroup
            size="small"
            value={product.lifecycleStatus}
            exclusive
            onChange={(_, v) => v && updateProductField("lifecycleStatus", v)}
            aria-label="Lifecycle status"
          >
            <ToggleButton value="Draft">Draft</ToggleButton>
            <ToggleButton value="Active">Active</ToggleButton>
            <ToggleButton value="EndOfLife">End-of-life</ToggleButton>
          </ToggleButtonGroup>
        </Toolbar>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} aria-label="main tabs" variant="scrollable" allowScrollButtonsMobile>
          <Tab id="tab-0" label="Supplier" />
          <Tab id="tab-1" label="Taxonomy & Tagging" />
          <Tab id="tab-2" label="Reference Systems" />
          <Tab id="tab-3" label="Rules" />
          <Tab id="tab-4" label="Exchange" />
        </Tabs>
      </AppBar>

      {/* Supplier Panel */}
      <TabPanel index={0} value={tab}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardHeader title="Product" />
              <CardContent>
                <Stack spacing={2}>
                  <TextField label="Name" value={product.name} onChange={(e) => updateProductField("name", e.target.value)} />
                  <TextField label="Type" value={product.type ?? ""} onChange={(e) => updateProductField("type", e.target.value)} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Product Tags
                    </Typography>
                    {productConceptChips}
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Box sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={addFeature}>
                  Add Feature
                </Button>
              </Stack>
            </Box>

            <Box sx={{ mt: 2 }}>
              {product.features.map((f) => (
                <Box key={f.id} onClick={() => setSelectedFeatureId(f.id)}>
                  <FeatureCard f={f} />
                </Box>
              ))}
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardHeader title="Selected Feature" subheader={selectedFeature ? selectedFeature.name : "None"} />
              <CardContent>
                {selectedFeature ? (
                  <Stack spacing={2}>
                    <TextField
                      label="Description"
                      multiline
                      minRows={3}
                      value={selectedFeature.description ?? ""}
                      onChange={(e) => setFeature(selectedFeature.id, { description: e.target.value })}
                    />
                    <Divider />
                    <Typography variant="subtitle2">Tags on this Feature</Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                      {selectedFeature.tags.map((cid) => (
                        <Chip key={cid} label={CONCEPTS.find((c) => c.id === cid)?.label ?? cid} size="small" />
                      ))}
                    </Stack>
                  </Stack>
                ) : (
                  <Alert severity="info">Select a feature to edit.</Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Taxonomy & Tagging */}
      <TabPanel index={1} value={tab}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
              <CardHeader title="Taxonomy Browser" subheader="Concept Schemes, Collections, Concepts" />
              <CardContent>
                <TreeView defaultCollapseIcon={<span>-</span>} defaultExpandIcon={<span>+</span>}>
                  {SCHEMES.map((sch) => (
                    <TreeItem nodeId={sch.id} label={`Scheme: ${sch.label}`} key={sch.id}>
                      <TreeItem nodeId={`${sch.id}-tops`} label="Top Concepts">
                        {sch.topConcepts.map((cid) => {
                          const c = CONCEPTS.find((x) => x.id === cid)!;
                          return <TreeItem nodeId={c.id} label={c.label} key={c.id} />;
                        })}
                      </TreeItem>
                    </TreeItem>
                  ))}
                  <TreeItem nodeId="collections" label="Collections">
                    {COLLECTIONS.map((col) => (
                      <TreeItem nodeId={col.id} key={col.id} label={`Collection: ${col.label}`}>
                        {col.members.map((cid) => {
                          const c = CONCEPTS.find((x) => x.id === cid)!;
                          return <TreeItem nodeId={`col-${col.id}-${cid}`} key={`${col.id}-${cid}`} label={c.label} />;
                        })}
                      </TreeItem>
                    ))}
                  </TreeItem>
                </TreeView>
                <Box sx={{ mt: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel id="concept-select">Assign Concept</InputLabel>
                    <Select labelId="concept-select" label="Assign Concept" defaultValue="" onChange={(e) => addTagToTarget(e.target.value, selectedFeature ? "Feature" : "Product")}>
                      <MenuItem value="">
                        <em>— choose —</em>
                      </MenuItem>
                      {CONCEPTS.map((c) => (
                        <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Typography variant="caption" sx={{ mt: 1, display: "block" }}>
                    Tip: If a feature is selected, the tag is applied to the feature; otherwise it goes on the product.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={7}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardHeader title="Current Tags" />
              <CardContent>
                <Typography variant="subtitle2">On Product</Typography>
                {productConceptChips}
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2">On Features</Typography>
                <Stack spacing={1}>
                  {product.features.map((f) => (
                    <Stack key={f.id} direction="row" spacing={1} alignItems="center">
                      <Typography sx={{ minWidth: 200 }}>{f.name}</Typography>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                        {f.tags.map((cid) => (
                          <Chip key={cid} label={CONCEPTS.find((c) => c.id === cid)?.label ?? cid} size="small" />)
                        )}
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Reference Systems */}
      <TabPanel index={2} value={tab}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardHeader title="Reference Systems Registry" subheader="Used to validate or qualify FeatureValues" />
              <CardContent>
                <div style={{ height: 320, width: "100%" }}>
                  <DataGrid rows={REF_SYSTEMS.map((r) => ({ id: r.id, ...r }))} columns={refCols} disableRowSelectionOnClick hideFooterSelectedRowCount />
                </div>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Rules */}
      <TabPanel index={3} value={tab}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardHeader title="Rules" action={<Button size="small" startIcon={<AddIcon />} onClick={() => setRules((rs) => [...rs, { id: uid(), name: "New Rule", conditions: [] }])}>Add</Button>} />
              <CardContent>
                <Stack spacing={2}>
                  {rules.map((r, idx) => (
                    <Card key={r.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <TextField label="Rule name" size="small" value={r.name} onChange={(e) => setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))} />
                        <IconButton aria-label="delete rule" onClick={() => setRules((rs) => rs.filter((x) => x.id !== r.id))}>
                          <DeleteIcon />
                        </IconButton>
                      </Stack>
                      <Divider sx={{ my: 1 }} />
                      <Stack spacing={1}>
                        {r.conditions.map((c, cidx) => (
                          <Stack key={cidx} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                            <FormControl size="small" sx={{ minWidth: 160 }}>
                              <InputLabel id={`cond-kind-${r.id}-${cidx}`}>Condition</InputLabel>
                              <Select
                                labelId={`cond-kind-${r.id}-${cidx}`}
                                label="Condition"
                                value={c.kind}
                                onChange={(e) => {
                                  const kind = e.target.value as any;
                                  setRules((rs) =>
                                    rs.map((x) => {
                                      if (x.id !== r.id) return x;
                                      const next = [...x.conditions];
                                      if (kind === "HasConcept") next[cidx] = { kind: "HasConcept", conceptId: "C-Flight", target: "Product" } as TaxonomyCondition;
                                      if (kind === "FeatureExists") next[cidx] = { kind: "FeatureExists", featureName: "Origin" } as FeatureCondition;
                                      if (kind === "ValueInRange") next[cidx] = { kind: "ValueInRange", featureName: "Checked Baggage (kg)", min: 0, max: 23 } as FeatureCondition;
                                      return { ...x, conditions: next };
                                    })
                                  );
                                }}
                              >
                                <MenuItem value="HasConcept">HasConcept</MenuItem>
                                <MenuItem value="FeatureExists">FeatureExists</MenuItem>
                                <MenuItem value="ValueInRange">ValueInRange</MenuItem>
                              </Select>
                            </FormControl>

                            {c.kind === "HasConcept" && (
                              <>
                                <FormControl size="small" sx={{ minWidth: 160 }}>
                                  <InputLabel id={`cond-target-${r.id}-${cidx}`}>Target</InputLabel>
                                  <Select
                                    labelId={`cond-target-${r.id}-${cidx}`}
                                    label="Target"
                                    value={c.target}
                                    onChange={(e) =>
                                      setRules((rs) =>
                                        rs.map((x) => {
                                          if (x.id !== r.id) return x;
                                          const next = [...x.conditions];
                                          (next[cidx] as TaxonomyCondition).target = e.target.value as any;
                                          return { ...x, conditions: next };
                                        })
                                      )
                                    }
                                  >
                                    <MenuItem value="Product">Product</MenuItem>
                                    <MenuItem value="Feature">Feature</MenuItem>
                                    <MenuItem value="FeatureValue">FeatureValue</MenuItem>
                                  </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ minWidth: 200 }}>
                                  <InputLabel id={`cond-concept-${r.id}-${cidx}`}>Concept</InputLabel>
                                  <Select
                                    labelId={`cond-concept-${r.id}-${cidx}`}
                                    label="Concept"
                                    value={c.conceptId}
                                    onChange={(e) =>
                                      setRules((rs) =>
                                        rs.map((x) => {
                                          if (x.id !== r.id) return x;
                                          const next = [...x.conditions];
                                          (next[cidx] as TaxonomyCondition).conceptId = e.target.value as any;
                                          return { ...x, conditions: next };
                                        })
                                      )
                                    }
                                  >
                                    {CONCEPTS.map((cc) => (
                                      <MenuItem key={cc.id} value={cc.id}>{cc.label}</MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </>
                            )}

                            {c.kind !== "HasConcept" && (
                              <>
                                <TextField
                                  size="small"
                                  label="Feature name"
                                  value={c.featureName}
                                  onChange={(e) =>
                                    setRules((rs) =>
                                      rs.map((x) => {
                                        if (x.id !== r.id) return x;
                                        const next = [...x.conditions];
                                        (next[cidx] as any).featureName = e.target.value;
                                        return { ...x, conditions: next };
                                      })
                                    )
                                  }
                                />
                                {c.kind === "ValueInRange" && (
                                  <>
                                    <TextField
                                      size="small"
                                      label="Min"
                                      type="number"
                                      value={c.min ?? ""}
                                      onChange={(e) =>
                                        setRules((rs) =>
                                          rs.map((x) => {
                                            if (x.id !== r.id) return x;
                                            const next = [...x.conditions];
                                            (next[cidx] as any).min = Number(e.target.value);
                                            return { ...x, conditions: next };
                                          })
                                        )
                                      }
                                    />
                                    <TextField
                                      size="small"
                                      label="Max"
                                      type="number"
                                      value={c.max ?? ""}
                                      onChange={(e) =>
                                        setRules((rs) =>
                                          rs.map((x) => {
                                            if (x.id !== r.id) return x;
                                            const next = [...x.conditions];
                                            (next[cidx] as any).max = Number(e.target.value);
                                            return { ...x, conditions: next };
                                          })
                                        )
                                      }
                                    />
                                  </>
                                )}
                              </>
                            )}

                            <IconButton aria-label="delete condition" onClick={() => setRules((rs) => rs.map((x) => (x.id !== r.id ? x : { ...x, conditions: x.conditions.filter((_, i) => i !== cidx) })))}>
                              <DeleteIcon />
                            </IconButton>
                          </Stack>
                        ))}
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setRules((rs) => rs.map((x) => (x.id !== r.id ? x : { ...x, conditions: [...x.conditions, { kind: "HasConcept", conceptId: "C-Flight", target: "Product" } as TaxonomyCondition] })))}>
                            Add HasConcept
                          </Button>
                          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setRules((rs) => rs.map((x) => (x.id !== r.id ? x : { ...x, conditions: [...x.conditions, { kind: "FeatureExists", featureName: "Origin" } as FeatureCondition] })))}>
                            Add FeatureExists
                          </Button>
                          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setRules((rs) => rs.map((x) => (x.id !== r.id ? x : { ...x, conditions: [...x.conditions, { kind: "ValueInRange", featureName: "Checked Baggage (kg)", min: 0, max: 23 } as FeatureCondition] })))}>
                            Add ValueInRange
                          </Button>
                        </Stack>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardHeader title="Run Rules" action={<Button startIcon={<PlayArrowIcon />} onClick={() => setSnack({ open: true, message: "Rules evaluated", severity: "info" })}>Run</Button>} />
              <CardContent>
                <Stack spacing={2}>
                  {ruleResults.map((rr) => (
                    <Card key={rr.ruleId} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Typography variant="subtitle1">{rr.name}</Typography>
                        <Chip label={rr.passed ? "PASS" : "FAIL"} color={rr.passed ? "success" : "error"} variant="outlined" />
                      </Stack>
                      <Divider sx={{ my: 1 }} />
                      <Stack spacing={0.5}>
                        {rr.details.map((d, i) => (
                          <Typography key={i} variant="body2">{d}</Typography>
                        ))}
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Exchange */}
      <TabPanel index={4} value={tab}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardHeader
                title="Supplier Payload"
                action={
                  <Stack direction="row" spacing={1}>
                    <IconButton aria-label="copy" onClick={exportSupplierPayload}>
                      <ContentCopyIcon />
                    </IconButton>
                    <Button startIcon={<DownloadIcon />} onClick={() => {
                      const payload = exportSupplierPayload();
                      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `supplier-payload-${product.id}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}>Download</Button>
                  </Stack>
                }
              />
              <CardContent>
                <pre style={{ margin: 0, maxHeight: 360, overflow: "auto" }}>{JSON.stringify({ product, refs: REF_SYSTEMS }, null, 2)}</pre>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardHeader title="Retailer View (Simulated Ingest)" action={<Button startIcon={<UploadIcon />} onClick={() => simulateRetailerIngest()}>Import from current</Button>} />
              <CardContent>
                <Stack spacing={2}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      const txt = prompt("Paste supplier JSON payload:");
                      if (txt != null) simulateRetailerIngest(txt);
                    }}
                  >
                    Paste JSON to simulate ingest
                  </Button>
                  {retailerPayload ? (
                    <pre style={{ margin: 0, maxHeight: 320, overflow: "auto" }}>{JSON.stringify(retailerPayload, null, 2)}</pre>
                  ) : (
                    <Alert severity="info">No retailer payload yet. Import from current or paste JSON.</Alert>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
