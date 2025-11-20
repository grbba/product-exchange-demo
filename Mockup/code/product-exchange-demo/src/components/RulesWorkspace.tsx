import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  CONTEXT_REFS,
  LOGICAL_OPERATORS,
  RULE_TYPES,
  SELECTION_SCOPES,
  TARGET_ACTIONS,
  VALUE_OPERATORS,
  createRuleLink,
  defaultScopeDefinition,
  updateTimestamp,
  type CompoundExpression,
  type DateTimeExpression,
  type Feature,
  type FeatureExpression,
  type LogicalExpression,
  type Product,
  type ProductExpression,
  type QuantityExpression,
  type SelectionScope,
  type TaxonomyExpression,
  type ProductInstance,
  type ProductSchema,
  type Rule,
  type RuleLink,
  type RuleLinkKind,
  type Concept,
  type ValueOperator,
  uid,
} from "../domain";

type RulesWorkspaceProps = {
  rules: Rule[];
  selectedRuleId: string | null;
  onSelectRule: (ruleId: string | null) => void;
  onCreateRule: () => void;
  onChange: (rules: Rule[]) => void;
  ruleLinks: RuleLink[];
  onChangeRuleLinks: (links: RuleLink[]) => void;
  schemas: ProductSchema[];
  instances: ProductInstance[];
  conceptLabel: (id: string) => string;
  concepts: Concept[];
  onRunRule?: (ruleId: string) => void;
};

type ExpressionEditorProps = {
  expression: LogicalExpression;
  onChange: (expression: LogicalExpression) => void;
  onRemove?: () => void;
  conceptLabel: (id: string) => string;
  concepts: Concept[];
  featureOptions: FeatureOption[];
  productOptions: ProductOption[];
  quantityOptions: QuantityOption[];
  diagnostics: Map<string, ExpressionDiagnostic>;
};

type ConditionKind = "Taxonomy" | "DateTime" | "Feature" | "Product" | "Quantity";

const nextExpressionId = () => `EXP-${uid().toUpperCase()}`;

type FeatureOption = {
  id: string;
  name: string;
  identifier: string;
  source: "schema" | "product";
  originId: string;
  originLabel: string;
  values: Feature["values"];
  tags: string[];
};

type ProductOption = { id: string; label: string };

type QuantityOption = { id: string; label: string };

type ExpressionDiagnostic = {
  status: "ok" | "warning" | "error";
  message?: string;
};

const isCompound = (expression: LogicalExpression): expression is CompoundExpression =>
  expression.kind === "Compound";
const isTaxonomy = (expression: LogicalExpression): expression is TaxonomyExpression =>
  expression.kind === "Taxonomy";
const isDateTime = (expression: LogicalExpression): expression is DateTimeExpression =>
  expression.kind === "DateTime";
const isFeatureExpression = (expression: LogicalExpression): expression is FeatureExpression =>
  expression.kind === "Feature";
const isProductExpression = (expression: LogicalExpression): expression is ProductExpression =>
  expression.kind === "Product";
const isQuantityExpression = (expression: LogicalExpression): expression is QuantityExpression =>
  expression.kind === "Quantity";

type OutlineNode = {
  expressionId: string;
  label: string;
  depth: number;
  diagnostic: ExpressionDiagnostic;
};

const VALUE_REQUIRED_OPERATORS: ValueOperator[] = [
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
];

const gatherFeatureOptions = (
  schemas: ProductSchema[],
  products: Product[]
): FeatureOption[] => {
  const options: FeatureOption[] = [];
  for (const schema of schemas) {
    for (const feature of schema.featureTemplates) {
      const identifier = feature.name?.trim() || feature.id;
      if (!identifier) continue;
      options.push({
        id: feature.id || feature.name,
        name: feature.name || feature.id,
        identifier,
        source: "schema",
        originId: schema.id,
        originLabel: schema.name,
        values: feature.values,
        tags: feature.tags,
      });
    }
  }
  for (const product of products) {
    for (const feature of product.features) {
      const identifier = feature.name?.trim() || feature.id;
      if (!identifier) continue;
      options.push({
        id: feature.id || feature.name,
        name: feature.name || feature.id,
        identifier,
        source: "product",
        originId: product.id,
        originLabel: product.name,
        values: feature.values,
        tags: feature.tags,
      });
    }
  }
  const seen = new Map<string, FeatureOption>();
  for (const option of options) {
    if (!option.identifier) continue;
    if (!seen.has(option.identifier)) {
      seen.set(option.identifier, option);
      continue;
    }
    const existing = seen.get(option.identifier)!;
    if (existing.source === "schema" && option.source === "product") {
      // keep schema definition as canonical but merge tags
      existing.tags = Array.from(new Set([...existing.tags, ...option.tags]));
    }
  }
  return Array.from(seen.values());
};

const findProductFeature = (product: Product | undefined, featureId: string) =>
  product?.features.find((feature) => feature.id === featureId || feature.name === featureId);

const collectExpressionDiagnostics = (
  expression: LogicalExpression,
  helpers: {
    featureOptions: FeatureOption[];
    productOptions: ProductOption[];
    conceptLabel: (id: string) => string;
    simulationProduct?: Product;
  }
) => {
  const diagnostics = new Map<string, ExpressionDiagnostic>();
  const visit = (node: LogicalExpression) => {
    let diagnostic: ExpressionDiagnostic = { status: "ok" };
    if (isCompound(node)) {
      if (!node.children.length) {
        diagnostic = { status: "warning", message: "Add at least one child condition" };
      }
    } else if (isTaxonomy(node)) {
      if (!node.taxonomyConceptId) {
        diagnostic = { status: "error", message: "Select a taxonomy concept" };
      }
    } else if (isFeatureExpression(node)) {
      if (!node.featureId) {
        diagnostic = { status: "error", message: "Select a feature" };
      } else {
        const feature = helpers.featureOptions.find(
          (option) =>
            option.identifier === node.featureId ||
            option.id === node.featureId ||
            option.name === node.featureId
        );
        if (!feature) {
          diagnostic = { status: "warning", message: "Feature not available in current assignments" };
        } else if (VALUE_REQUIRED_OPERATORS.includes(node.operator) && !node.value && !node.featureTagId) {
          diagnostic = { status: "warning", message: "Provide a comparison value or add a taxonomy tag" };
        } else if (helpers.simulationProduct && !findProductFeature(helpers.simulationProduct, node.featureId)) {
          diagnostic = { status: "warning", message: "Preview product lacks this feature" };
        }
      }
    } else if (isProductExpression(node)) {
      if (!node.productId) {
        diagnostic = { status: "error", message: "Select a product to reference" };
      } else if (!helpers.productOptions.some((option) => option.id === node.productId)) {
        diagnostic = { status: "warning", message: "Product not linked to this rule" };
      }
    } else if (isQuantityExpression(node)) {
      if (!node.itemId) {
        diagnostic = { status: "warning", message: "Specify an item identifier" };
      }
      if (VALUE_REQUIRED_OPERATORS.includes(node.operator) && typeof node.quantity !== "number") {
        diagnostic = { status: "warning", message: "Provide a numeric quantity" };
      }
    } else if (isDateTime(node)) {
      if (!node.value) {
        diagnostic = { status: "warning", message: "Provide a date or range" };
      }
    }
    diagnostics.set(node.expressionId, diagnostic);
    if (isCompound(node)) {
      node.children.forEach(visit);
    }
  };
  visit(expression);
  return diagnostics;
};

const describeExpressionLabel = (expression: LogicalExpression, conceptLabel: (id: string) => string): string => {
  if (isCompound(expression)) {
    return `Compound ${expression.operator}`;
  }
  if (isTaxonomy(expression)) {
    return `Taxonomy · ${conceptLabel(expression.taxonomyConceptId) || expression.taxonomyConceptId || "Unassigned"}`;
  }
  if (isFeatureExpression(expression)) {
    return `Feature · ${expression.featureId || "Unassigned"}`;
  }
  if (isProductExpression(expression)) {
    return `Product · ${expression.productId || "Unassigned"}`;
  }
  if (isQuantityExpression(expression)) {
    return `Quantity · ${expression.itemId || "Unassigned"}`;
  }
  if (isDateTime(expression)) {
    return `Date/Time · ${expression.operator}`;
  }
  return "Unsupported expression";
};

const buildExpressionOutline = (
  expression: LogicalExpression,
  diagnostics: Map<string, ExpressionDiagnostic>,
  conceptLabel: (id: string) => string
): OutlineNode[] => {
  const nodes: OutlineNode[] = [];
  const visit = (node: LogicalExpression, depth: number) => {
    nodes.push({
      expressionId: node.expressionId,
      label: describeExpressionLabel(node, conceptLabel),
      depth,
      diagnostic: diagnostics.get(node.expressionId) ?? { status: "ok" },
    });
    if (isCompound(node)) {
      node.children.forEach((child) => visit(child, depth + 1));
    }
  };
  visit(expression, 0);
  return nodes;
};

const collectValueSuggestions = (feature?: FeatureOption) => {
  if (!feature) return [];
  const suggestions = new Set<string>();
  for (const value of feature.values) {
    if (!value) continue;
    if (value.kind === "SingleValue") {
      suggestions.add(String(value.value));
    } else if (value.kind === "DiscreteSet") {
      value.values.forEach((entry) => suggestions.add(String(entry)));
    } else if (value.kind === "ValueRange") {
      suggestions.add(`${value.min}-${value.max}`);
    }
  }
  return Array.from(suggestions).filter(Boolean);
};

const outlineStatusIcon = (status: ExpressionDiagnostic["status"]) => {
  if (status === "error") return <ErrorOutlineIcon color="error" fontSize="small" />;
  if (status === "warning") return <WarningAmberIcon color="warning" fontSize="small" />;
  return <CheckCircleOutlineIcon color="success" fontSize="small" />;
};

const ExpressionEditor: React.FC<ExpressionEditorProps> = ({
  expression,
  onChange,
  onRemove,
  conceptLabel,
  concepts,
  featureOptions,
  productOptions,
  quantityOptions,
  diagnostics,
}) => {
  const [wizardOpen, setWizardOpen] = useState(false);
  const diagnostic = diagnostics.get(expression.expressionId);

  const diagnosticBanner =
    diagnostic && diagnostic.status !== "ok" ? (
      <Alert
        severity={diagnostic.status === "error" ? "error" : "warning"}
        variant="outlined"
        sx={{ borderRadius: 2 }}
      >
        {diagnostic.message}
      </Alert>
    ) : null;

  if (isCompound(expression)) {
    const appendChild = (child: LogicalExpression) => {
      onChange({ ...expression, children: [...expression.children, child] });
    };

    const handleAddChild = (kind: ConditionKind | "Compound") => {
      if (kind === "Taxonomy") {
        appendChild({
          kind: "Taxonomy",
          expressionId: nextExpressionId(),
          subjectRef: "currentProduct",
          taxonomyConceptId: "",
          taxonomyScheme: "apmwg:product_taxonomy_scheme",
        });
        return;
      }
      if (kind === "DateTime") {
        appendChild({
          kind: "DateTime",
          expressionId: nextExpressionId(),
          subjectRef: "offer",
          operator: "IN",
          value: "",
        });
        return;
      }
      if (kind === "Feature") {
      appendChild({
        kind: "Feature",
        expressionId: nextExpressionId(),
        subjectRef: "currentProduct",
        featureId: "",
        operator: "EQUALS",
        value: "",
        featureTagId: undefined,
      });
        return;
      }
      if (kind === "Product") {
        appendChild({
          kind: "Product",
          expressionId: nextExpressionId(),
          subjectRef: "currentProduct",
          productId: "",
          operator: "EQUALS",
        });
        return;
      }
      if (kind === "Quantity") {
        appendChild({
          kind: "Quantity",
          expressionId: nextExpressionId(),
          subjectRef: "currentProduct",
          itemId: "",
          quantity: 0,
          operator: "EQUALS",
        });
        return;
      }
      appendChild({
        kind: "Compound",
        expressionId: nextExpressionId(),
        operator: "AND",
        description: "",
        children: [],
      });
    };
    const handleChildUpdate = (index: number, updated: LogicalExpression) => {
      onChange({
        ...expression,
        children: expression.children.map((child, idx) => (idx === index ? updated : child)),
      });
    };

    const handleRemoveChild = (index: number) => {
      onChange({
        ...expression,
        children: expression.children.filter((_, idx) => idx !== index),
      });
    };

    return (
      <Stack spacing={2} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Operator</InputLabel>
            <Select
              label="Operator"
              value={expression.operator}
              onChange={(event) =>
                onChange({ ...expression, operator: event.target.value as CompoundExpression["operator"] })
              }
            >
              {LOGICAL_OPERATORS.map((operator) => (
                <MenuItem key={operator} value={operator}>
                  {operator}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            size="small"
            label="Description"
            value={expression.description ?? ""}
            onChange={(event) => onChange({ ...expression, description: event.target.value })}
          />
          {onRemove && (
            <IconButton onClick={onRemove} aria-label="Remove group">
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
        {diagnosticBanner}
        <Stack spacing={2}>
          {expression.children.map((child, index) => (
            <ExpressionEditor
              key={child.expressionId}
              expression={child}
              onChange={(updated) => handleChildUpdate(index, updated)}
              onRemove={() => handleRemoveChild(index)}
              conceptLabel={conceptLabel}
              concepts={concepts}
              featureOptions={featureOptions}
              productOptions={productOptions}
              quantityOptions={quantityOptions}
              diagnostics={diagnostics}
            />
          ))}
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <Button size="small" variant="outlined" startIcon={<AddIcon fontSize="small" />} onClick={() => setWizardOpen(true)}>
            Add condition
          </Button>
          <Button size="small" variant="outlined" startIcon={<AddIcon fontSize="small" />} onClick={() => handleAddChild("Compound")}>
            Add nested group
          </Button>
        </Stack>
        <ConditionWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onSelect={(kind) => {
            setWizardOpen(false);
            handleAddChild(kind);
          }}
        />
      </Stack>
    );
  }

  const renderSubjectPicker = () => (
    <FormControl size="small" sx={{ minWidth: 160 }}>
      <InputLabel>Subject</InputLabel>
      <Select
        label="Subject"
        value={(expression as TaxonomyExpression | FeatureExpression | ProductExpression | QuantityExpression | DateTimeExpression).subjectRef}
        onChange={(event) =>
          onChange({
            ...expression,
            subjectRef: event.target.value as (typeof CONTEXT_REFS)[number],
          } as LogicalExpression)
        }
      >
        {CONTEXT_REFS.map((ref) => (
          <MenuItem key={ref} value={ref}>
            {ref}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  if (isTaxonomy(expression)) {
    const label = expression.taxonomyConceptId ? conceptLabel(expression.taxonomyConceptId) : "";
    return (
      <Stack spacing={2} sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            Taxonomy condition
          </Typography>
          {onRemove && (
            <IconButton onClick={onRemove} aria-label="Remove taxonomy condition">
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
        {diagnosticBanner}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-start">
          {renderSubjectPicker()}
          <Autocomplete<Concept, false, false, true>
            freeSolo
            size="small"
            options={concepts}
            sx={{ flex: 1 }}
            ListboxProps={{ style: { maxHeight: 320, minWidth: 320 } }}
            value={
              concepts.find((concept) => concept.id === expression.taxonomyConceptId) ??
              (expression.taxonomyConceptId ? expression.taxonomyConceptId : null)
            }
            onChange={(_, newValue) => {
              if (!newValue) {
                onChange({ ...expression, taxonomyConceptId: "" });
              } else if (typeof newValue === "string") {
                onChange({ ...expression, taxonomyConceptId: newValue });
              } else {
                onChange({ ...expression, taxonomyConceptId: newValue.id });
              }
            }}
            isOptionEqualToValue={(option, value) =>
              typeof value === "string" ? option.id === value : option.id === value.id
            }
            getOptionLabel={(option) => (typeof option === "string" ? option : option.label || option.id)}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Typography variant="body2">{option.label || option.id}</Typography>
              </li>
            )}
            renderInput={(params) => (
              <TextField {...params} label="Taxonomy concept" placeholder="Search by label or ID" fullWidth />
            )}
          />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <ToggleButtonGroup
            size="small"
            value={expression.selectionScope ?? ""}
            exclusive
            onChange={(_, value) =>
              onChange({ ...expression, selectionScope: (value as SelectionScope) || undefined })
            }
          >
            <ToggleButton value="">Default</ToggleButton>
            {SELECTION_SCOPES.map((scope) => (
              <ToggleButton key={scope} value={scope}>
                {scope.replace("_", " ")}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <TextField
            fullWidth
            size="small"
            label="Description"
            value={expression.description ?? ""}
            onChange={(event) => onChange({ ...expression, description: event.target.value })}
          />
        </Stack>
        {label && <Chip label={label} size="small" variant="outlined" sx={{ alignSelf: "flex-start" }} />}
      </Stack>
    );
  }

  if (isDateTime(expression)) {
    return (
      <Stack spacing={2} sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            Date/time condition
          </Typography>
          {onRemove && (
            <IconButton onClick={onRemove} aria-label="Remove date condition">
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
        {diagnosticBanner}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          {renderSubjectPicker()}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Operator</InputLabel>
            <Select
              label="Operator"
              value={expression.operator}
              onChange={(event) =>
                onChange({ ...expression, operator: event.target.value as typeof expression.operator })
              }
            >
              {VALUE_OPERATORS.map((operator) => (
                <MenuItem key={operator} value={operator}>
                  {operator}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Value / range"
            placeholder="e.g. 2025-10-01/2025-12-31"
            value={expression.value}
            onChange={(event) => onChange({ ...expression, value: event.target.value })}
            helperText="Use ISO date or range"
          />
        </Stack>
        <TextField
          fullWidth
          size="small"
          label="Description"
          value={expression.description ?? ""}
          onChange={(event) => onChange({ ...expression, description: event.target.value })}
        />
      </Stack>
    );
  }

  if (isFeatureExpression(expression)) {
    const selectedFeature = featureOptions.find(
      (option) =>
        option.identifier === expression.featureId ||
        option.id === expression.featureId ||
        option.name === expression.featureId
    );
    const valueSuggestions = collectValueSuggestions(selectedFeature);
    return (
      <Stack spacing={2} sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            Feature condition
          </Typography>
          {onRemove && (
            <IconButton onClick={onRemove} aria-label="Remove feature condition">
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
        {diagnosticBanner}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          {renderSubjectPicker()}
          <Autocomplete<FeatureOption, false, false, true>
            freeSolo
            size="small"
            options={featureOptions}
            sx={{ flex: 1 }}
            ListboxProps={{ style: { maxHeight: 320, minWidth: 320 } }}
            value={selectedFeature ?? (expression.featureId ? expression.featureId : null)}
            onChange={(_, newValue) => {
              if (!newValue) {
                onChange({ ...expression, featureId: "" });
              } else if (typeof newValue === "string") {
                onChange({ ...expression, featureId: newValue });
              } else {
                onChange({ ...expression, featureId: newValue.identifier });
              }
            }}
            getOptionLabel={(option) =>
              typeof option === "string" ? option : `${option.name} (${option.source === "schema" ? "Schema" : "Product"})`
            }
            renderInput={(params) => <TextField {...params} label="Feature" placeholder="Search feature" fullWidth />}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Operator</InputLabel>
            <Select
              label="Operator"
              value={expression.operator}
              onChange={(event) =>
                onChange({ ...expression, operator: event.target.value as typeof expression.operator })
              }
            >
              {VALUE_OPERATORS.map((operator) => (
                <MenuItem key={operator} value={operator}>
                  {operator}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <Autocomplete<string, false, false, true>
          freeSolo
          options={valueSuggestions}
          value={expression.value ?? ""}
          onChange={(_, newValue) => onChange({ ...expression, value: newValue ?? "" })}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="Comparison value"
              placeholder={valueSuggestions.length ? "Select or type" : "Type a value"}
            />
          )}
        />
        <Autocomplete<Concept, false, false, true>
          freeSolo
          size="small"
          options={concepts}
          value={
            expression.featureTagId
              ? concepts.find((concept) => concept.id === expression.featureTagId) ?? expression.featureTagId
              : null
          }
          onChange={(_, newValue) => {
            if (!newValue) {
              onChange({ ...expression, featureTagId: undefined });
            } else if (typeof newValue === "string") {
              onChange({ ...expression, featureTagId: newValue });
            } else {
              onChange({ ...expression, featureTagId: newValue.id });
            }
          }}
          isOptionEqualToValue={(option, value) =>
            typeof value === "string" ? option.id === value : option.id === value.id
          }
          getOptionLabel={(option) => (typeof option === "string" ? option : option.label || option.id)}
          ListboxProps={{ style: { maxHeight: 320, minWidth: 320 } }}
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              <Typography variant="body2">{option.label || option.id}</Typography>
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Required taxonomy tag"
              placeholder="Optional – ensure feature carries tag"
            />
          )}
        />
        <TextField
          fullWidth
          size="small"
          label="Description"
          value={expression.description ?? ""}
          onChange={(event) => onChange({ ...expression, description: event.target.value })}
        />
        {selectedFeature?.tags?.length ? (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {selectedFeature.tags.map((tag) => (
              <Chip key={tag} label={conceptLabel(tag) || tag} size="small" variant="outlined" />
            ))}
          </Stack>
        ) : null}
      </Stack>
    );
  }

  if (isProductExpression(expression)) {
    const selectedProduct = productOptions.find((option) => option.id === expression.productId);
    return (
      <Stack spacing={2} sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            Product condition
          </Typography>
          {onRemove && (
            <IconButton onClick={onRemove} aria-label="Remove product condition">
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
        {diagnosticBanner}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          {renderSubjectPicker()}
          <Autocomplete<ProductOption, false, false, true>
            freeSolo
            size="small"
            options={productOptions}
            value={selectedProduct ?? (expression.productId ? expression.productId : null)}
            onChange={(_, newValue) => {
              if (!newValue) {
                onChange({ ...expression, productId: "" });
              } else if (typeof newValue === "string") {
                onChange({ ...expression, productId: newValue });
              } else {
                onChange({ ...expression, productId: newValue.id });
              }
            }}
            getOptionLabel={(option) => (typeof option === "string" ? option : option.label)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Product"
                placeholder="Search product"
                fullWidth
                sx={{ minWidth: { sm: 260, md: 320 } }}
              />
            )}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Operator</InputLabel>
            <Select
              label="Operator"
              value={expression.operator}
              onChange={(event) =>
                onChange({ ...expression, operator: event.target.value as typeof expression.operator })
              }
            >
              {VALUE_OPERATORS.map((operator) => (
                <MenuItem key={operator} value={operator}>
                  {operator}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <TextField
          fullWidth
          size="small"
          label="Description"
          value={expression.description ?? ""}
          onChange={(event) => onChange({ ...expression, description: event.target.value })}
        />
      </Stack>
    );
  }

  if (isQuantityExpression(expression)) {
    const selectedItem = quantityOptions.find((option) => option.id === expression.itemId);
    return (
      <Stack spacing={2} sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            Quantity condition
          </Typography>
          {onRemove && (
            <IconButton onClick={onRemove} aria-label="Remove quantity condition">
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
        {diagnosticBanner}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          {renderSubjectPicker()}
          <Autocomplete<QuantityOption, false, false, true>
            freeSolo
            size="small"
            options={quantityOptions}
            value={selectedItem ?? (expression.itemId ? expression.itemId : null)}
            onChange={(_, newValue) => {
              if (!newValue) {
                onChange({ ...expression, itemId: "" });
              } else if (typeof newValue === "string") {
                onChange({ ...expression, itemId: newValue });
              } else {
                onChange({ ...expression, itemId: newValue.id });
              }
            }}
            getOptionLabel={(option) => (typeof option === "string" ? option : option.label)}
            renderInput={(params) => <TextField {...params} label="Item" placeholder="Bundle item identifier" />}
          />
          <TextField
            size="small"
            type="number"
            label="Quantity"
            value={expression.quantity}
            onChange={(event) => onChange({ ...expression, quantity: Number(event.target.value) || 0 })}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Operator</InputLabel>
            <Select
              label="Operator"
              value={expression.operator}
              onChange={(event) =>
                onChange({ ...expression, operator: event.target.value as typeof expression.operator })
              }
            >
              {VALUE_OPERATORS.map((operator) => (
                <MenuItem key={operator} value={operator}>
                  {operator}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <TextField
          fullWidth
          size="small"
          label="Description"
          value={expression.description ?? ""}
          onChange={(event) => onChange({ ...expression, description: event.target.value })}
        />
      </Stack>
    );
  }

  return (
    <Stack spacing={1} sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Unsupported expression type: {(expression as LogicalExpression).kind}
        </Typography>
        {onRemove && (
          <IconButton onClick={onRemove} aria-label="Remove expression">
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary">
        The demo editor does not yet support editing this expression kind.
      </Typography>
    </Stack>
  );
};

type ConditionWizardProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (kind: ConditionKind | "Compound") => void;
};

const CONDITION_CHOICES: { label: string; description: string; value: ConditionKind | "Compound" }[] = [
  { label: "Taxonomy condition", description: "Match classification tags", value: "Taxonomy" },
  { label: "Feature condition", description: "Inspect feature values", value: "Feature" },
  { label: "Product condition", description: "Reference another product", value: "Product" },
  { label: "Quantity condition", description: "Require item counts", value: "Quantity" },
  { label: "Date/time condition", description: "Schedule-based logic", value: "DateTime" },
  { label: "Compound group", description: "Nest AND/OR groups", value: "Compound" },
];

const ConditionWizard: React.FC<ConditionWizardProps> = ({ open, onClose, onSelect }) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>Select condition type</DialogTitle>
    <DialogContent dividers>
      <List disablePadding>
        {CONDITION_CHOICES.map((choice) => (
          <ListItemButton
            key={choice.value}
            onClick={() => {
              onSelect(choice.value);
            }}
          >
            <ListItemText primary={choice.label} secondary={choice.description} />
          </ListItemButton>
        ))}
      </List>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
    </DialogActions>
  </Dialog>
);

const formatList = (values: string[]) => values.join(", ");
const parseList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const formatWindow = (from?: string, to?: string) => {
  if (!from && !to) return "";
  if (from && to) return `${from} → ${to}`;
  return from ? `${from} → …` : `… → ${to}`;
};

const RulesWorkspace: React.FC<RulesWorkspaceProps> = ({
  rules,
  selectedRuleId,
  onSelectRule,
  onCreateRule,
  onChange,
  ruleLinks,
  onChangeRuleLinks,
  schemas,
  instances,
  conceptLabel,
  concepts,
  onRunRule,
}) => {
  const schemaOptions = useMemo(
    () => schemas.map((schema) => ({ id: schema.id, label: schema.name })),
    [schemas]
  );
  const productOptions = useMemo(
    () =>
      instances.map((instance) => ({
        id: instance.product.id,
        label: instance.product.name || `Product ${instance.id}`,
      })),
    [instances]
  );
  const visibleRules = useMemo(
    () => (selectedRuleId ? rules.filter((rule) => rule.id === selectedRuleId) : rules),
    [rules, selectedRuleId]
  );

  const schemaById = useMemo(() => new Map(schemas.map((schema) => [schema.id, schema])), [schemas]);
  const productById = useMemo(
    () => new Map(instances.map((instance) => [instance.product.id, instance.product])),
    [instances]
  );

  const [simulationProductId, setSimulationProductId] = useState<string>(instances[0]?.product.id ?? "");
  useEffect(() => {
    if (!simulationProductId && instances[0]) {
      setSimulationProductId(instances[0].product.id);
    } else if (simulationProductId && !productById.has(simulationProductId) && instances[0]) {
      setSimulationProductId(instances[0].product.id);
    }
  }, [instances, productById, simulationProductId]);
  const simulationProduct = simulationProductId ? productById.get(simulationProductId) : undefined;

  const updateRule = useCallback(
    (ruleId: string, updater: (rule: Rule) => Rule) => {
      onChange(
        rules.map((rule) => (rule.id === ruleId ? updateTimestamp(updater(rule)) : rule))
      );
    },
    [onChange, rules]
  );

  const updateRuleLink = useCallback(
    (linkId: string, updater: (link: RuleLink) => RuleLink) => {
      onChangeRuleLinks(
        ruleLinks.map((link) => (link.id === linkId ? updateTimestamp(updater(link)) : link))
      );
    },
    [onChangeRuleLinks, ruleLinks]
  );

  const handleDeleteRule = (ruleId: string) => {
    onChange(rules.filter((rule) => rule.id !== ruleId));
    const nextLinks = ruleLinks.filter((link) => link.ruleRef !== ruleId);
    if (nextLinks.length !== ruleLinks.length) {
      onChangeRuleLinks(nextLinks);
    }
  };

  const handleAddLink = (ruleRef: string, kind: RuleLinkKind) => {
    const link = createRuleLink(ruleRef, kind);
    if (kind === "Schema" && schemaOptions.length) {
      link.targetId = schemaOptions[0]?.id ?? "";
    }
    if (kind === "Product" && productOptions.length) {
      link.targetId = productOptions[0]?.id ?? "";
    }
    onChangeRuleLinks([...ruleLinks, link]);
  };

  const handleDeleteLink = (linkId: string) => {
    onChangeRuleLinks(ruleLinks.filter((link) => link.id !== linkId));
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardHeader
        title="Rules"
        action={
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Selected rule</InputLabel>
              <Select
                label="Selected rule"
                value={selectedRuleId ?? ""}
                onChange={(event) => onSelectRule(event.target.value || null)}
              >
                {rules.map((rule) => (
                  <MenuItem key={rule.id} value={rule.id}>
                    {rule.name || rule.ruleId}
                  </MenuItem>
                ))}
                {!rules.length && <MenuItem value="">No rules yet</MenuItem>}
              </Select>
            </FormControl>
            <Button size="small" startIcon={<AddIcon />} onClick={onCreateRule}>
              Create rule
            </Button>
          </Stack>
        }
      />
      <CardContent>
        <Stack spacing={3}>
          {visibleRules.map((rule) => {
            const scope = rule.scope ?? {
              scopeId: `SCOPE-${uid().toUpperCase()}`,
              description: "",
              definition: defaultScopeDefinition(),
            };
            const linksForRule = ruleLinks.filter((link) => link.ruleRef === rule.id);
            const assignedSchemas = linksForRule
              .filter((link) => link.kind === "Schema" && link.targetId)
              .map((link) => schemaById.get(link.targetId!))
              .filter((item): item is ProductSchema => Boolean(item));
            const assignedProducts = linksForRule
              .filter((link) => link.kind === "Product" && link.targetId)
              .map((link) => productById.get(link.targetId!))
              .filter((item): item is Product => Boolean(item));
            const featureOptionsForRule = gatherFeatureOptions(assignedSchemas, assignedProducts);
            const productOptionsForConditions = assignedProducts.length
              ? assignedProducts.map((product) => ({ id: product.id, label: product.name || product.id }))
              : productOptions;
            const quantityOptionsForRule = assignedProducts.length
              ? assignedProducts.flatMap((product) =>
                  product.features.map((feature) => ({
                    id: feature.id || feature.name,
                    label: `${feature.name || feature.id} · ${product.name || product.id}`,
                  }))
                )
              : [];
            const diagnostics = collectExpressionDiagnostics(rule.expression, {
              featureOptions: featureOptionsForRule,
              productOptions: productOptionsForConditions,
              conceptLabel,
              simulationProduct,
            });
            const outlineNodes = buildExpressionOutline(rule.expression, diagnostics, conceptLabel);

            return (
              <Card key={rule.id} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardHeader
                  title={
                    <Stack spacing={1}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <TextField
                          label="Rule ID"
                          size="small"
                          value={rule.ruleId}
                          sx={{ width: { xs: "100%", sm: 220 } }}
                          onChange={(event) =>
                            updateRule(rule.id, (current) => ({ ...current, ruleId: event.target.value }))
                          }
                        />
                        <TextField
                          label="Rule name"
                          size="small"
                          fullWidth
                          sx={{ maxWidth: 420 }}
                          value={rule.name}
                          onChange={(event) =>
                            updateRule(rule.id, (current) => ({ ...current, name: event.target.value }))
                          }
                        />
                      </Stack>
                      <TextField
                        label="Description"
                        size="small"
                        fullWidth
                        sx={{ maxWidth: 600 }}
                        multiline
                        minRows={2}
                        value={rule.description}
                        onChange={(event) =>
                          updateRule(rule.id, (current) => ({ ...current, description: event.target.value }))
                        }
                      />
                    </Stack>
                  }
                  action={
                    <Stack spacing={1} alignItems="flex-start">
                      {onRunRule && (
                        <Button size="small" variant="outlined" onClick={() => onRunRule(rule.id)}>
                          Run
                        </Button>
                      )}
                      <IconButton onClick={() => handleDeleteRule(rule.id)} aria-label="Delete rule">
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  }
                />
                <CardContent>
                  <Stack spacing={3}>
                    <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="stretch">
                      <Box sx={{ flex: 2 }}>
                        <Stack spacing={2}>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                            <FormControl size="small" sx={{ minWidth: 200 }}>
                              <InputLabel>Rule type</InputLabel>
                              <Select
                                label="Rule type"
                                value={rule.type}
                                onChange={(event) =>
                                  updateRule(rule.id, (current) => ({
                                    ...current,
                                    type: event.target.value as Rule["type"],
                                  }))
                                }
                              >
                                {RULE_TYPES.map((type) => (
                                  <MenuItem key={type} value={type}>
                                    {type}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <TextField
                              size="small"
                              type="number"
                              label="Priority"
                              value={rule.priority}
                              onChange={(event) =>
                                updateRule(rule.id, (current) => ({
                                  ...current,
                                  priority: Number(event.target.value),
                                }))
                              }
                            />
                          </Stack>
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              Logical expression
                            </Typography>
                            <ExpressionEditor
                              expression={rule.expression}
                              onChange={(expressionValue) =>
                                updateRule(rule.id, (current) => ({ ...current, expression: expressionValue }))
                              }
                              conceptLabel={conceptLabel}
                              concepts={concepts}
                              featureOptions={featureOptionsForRule}
                              productOptions={productOptionsForConditions}
                              quantityOptions={quantityOptionsForRule}
                              diagnostics={diagnostics}
                            />
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              Targets
                            </Typography>
                            <Stack spacing={2}>
                              {rule.targets.length === 0 && (
                                <Alert severity="warning">No targets defined yet.</Alert>
                              )}
                              {rule.targets.map((target, index) => (
                                <Stack
                                  key={target.targetId}
                                  spacing={2}
                                  sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2 }}
                                >
                                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                                    <TextField
                                      size="small"
                                      label="Target ID"
                                      value={target.targetId}
                                      onChange={(event) =>
                                        updateRule(rule.id, (current) => ({
                                          ...current,
                                          targets: current.targets.map((existing, idx) =>
                                            idx === index ? { ...existing, targetId: event.target.value } : existing
                                          ),
                                        }))
                                      }
                                    />
                                    <FormControl size="small" sx={{ minWidth: 160 }}>
                                      <InputLabel>Action</InputLabel>
                                      <Select
                                        label="Action"
                                        value={target.action}
                                        onChange={(event) =>
                                          updateRule(rule.id, (current) => ({
                                            ...current,
                                            targets: current.targets.map((existing, idx) =>
                                              idx === index
                                                ? { ...existing, action: event.target.value as typeof target.action }
                                                : existing
                                            ),
                                          }))
                                        }
                                      >
                                        {TARGET_ACTIONS.map((action) => (
                                          <MenuItem key={action} value={action}>
                                            {action}
                                          </MenuItem>
                                        ))}
                                      </Select>
                                    </FormControl>
                                    <IconButton
                                      onClick={() =>
                                        updateRule(rule.id, (current) => ({
                                          ...current,
                                          targets: current.targets.filter((_, idx) => idx !== index),
                                        }))
                                      }
                                      aria-label="Remove target"
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Stack>
                                  {target.kind === "Taxonomy" ? (
                                    <Autocomplete<Concept, false, false, true>
                                      freeSolo
                                      size="small"
                                      sx={{ maxWidth: 420 }}
                                      options={concepts}
                                      value={
                                        target.conceptId
                                          ? concepts.find((concept) => concept.id === target.conceptId) ?? target.conceptId
                                          : null
                                      }
                                      onChange={(_, newValue) => {
                                        if (!newValue) {
                                          updateRule(rule.id, (current) => ({
                                            ...current,
                                            targets: current.targets.map((existing, idx) =>
                                              idx === index ? { ...existing, conceptId: "" } : existing
                                            ),
                                          }));
                                        } else if (typeof newValue === "string") {
                                          updateRule(rule.id, (current) => ({
                                            ...current,
                                            targets: current.targets.map((existing, idx) =>
                                              idx === index ? { ...existing, conceptId: newValue } : existing
                                            ),
                                          }));
                                        } else {
                                          updateRule(rule.id, (current) => ({
                                            ...current,
                                            targets: current.targets.map((existing, idx) =>
                                              idx === index ? { ...existing, conceptId: newValue.id } : existing
                                            ),
                                          }));
                                        }
                                      }}
                                      isOptionEqualToValue={(option, value) =>
                                        typeof value === "string" ? option.id === value : option.id === value.id
                                      }
                                      getOptionLabel={(option) => (typeof option === "string" ? option : option.label || option.id)}
                                      ListboxProps={{ style: { maxHeight: 320, minWidth: 320 } }}
                                      renderOption={(props, option) => (
                                        <li {...props} key={option.id}>
                                          <Typography variant="body2">{option.label || option.id}</Typography>
                                        </li>
                                      )}
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          label="Taxonomy concept"
                                          placeholder="Select concept to target"
                                          helperText={conceptLabel(target.conceptId) || "Enter a concept ID"}
                                        />
                                      )}
                                    />
                                  ) : (
                                    <TextField
                                      size="small"
                                      label="Product ID"
                                      value={target.productId}
                                      onChange={(event) =>
                                        updateRule(rule.id, (current) => ({
                                          ...current,
                                          targets: current.targets.map((existing, idx) =>
                                            idx === index ? { ...existing, productId: event.target.value } : existing
                                          ),
                                        }))
                                      }
                                    />
                                  )}
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Description"
                                    value={target.description ?? ""}
                                    onChange={(event) =>
                                      updateRule(rule.id, (current) => ({
                                        ...current,
                                        targets: current.targets.map((existing, idx) =>
                                          idx === index ? { ...existing, description: event.target.value } : existing
                                        ),
                                      }))
                                    }
                                  />
                                </Stack>
                              ))}
                              <Button
                                size="small"
                                startIcon={<AddIcon fontSize="small" />}
                                onClick={() =>
                                  updateRule(rule.id, (current) => ({
                                    ...current,
                                    targets: [
                                      ...current.targets,
                                      {
                                        kind: "Taxonomy" as const,
                                        targetId: `TARGET-${uid().toUpperCase()}`,
                                        action: "DISABLE",
                                        conceptId: "",
                                        description: "",
                                      },
                                    ],
                                  }))
                                }
                              >
                                Add target
                              </Button>
                            </Stack>
                          </Box>
                        </Stack>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 280 }}>
                        <Stack spacing={2}>
                          <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Expression outline
                            </Typography>
                            {outlineNodes.length ? (
                              <List dense>
                                {outlineNodes.map((node) => (
                                  <ListItem key={node.expressionId} sx={{ pl: 2 + node.depth * 2 }}>
                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                      {outlineStatusIcon(node.diagnostic.status)}
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={node.label}
                                      secondary={node.diagnostic.message}
                                      secondaryTypographyProps={{ color: node.diagnostic.status === "ok" ? "text.secondary" : "warning.main" }}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No expressions yet.
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Simulation preview
                            </Typography>
                            <FormControl size="small" fullWidth>
                              <InputLabel>Preview product</InputLabel>
                              <Select
                                label="Preview product"
                                value={simulationProductId}
                                onChange={(event) => setSimulationProductId(event.target.value)}
                              >
                                {instances.map((instance) => (
                                  <MenuItem key={instance.product.id} value={instance.product.id}>
                                    {instance.product.name}
                                  </MenuItem>
                                ))}
                                {!instances.length && <MenuItem value="">No products available</MenuItem>}
                              </Select>
                            </FormControl>
                            <Typography variant="caption" color="text.secondary">
                              Diagnostics highlight conditions missing data for the selected product.
                            </Typography>
                          </Box>
                          <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2 }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                              <Typography variant="subtitle2">Assignments</Typography>
                              <Button size="small" onClick={() => handleAddLink(rule.id, "Global")}>+ Global</Button>
                            </Stack>
                            <Stack spacing={2}>
                              {linksForRule.map((link) => {
                                const window = formatWindow(link.effectiveFrom, link.effectiveTo);
                                return (
                                  <Stack
                                    key={link.id}
                                    spacing={2}
                                    sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2 }}
                                  >
                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                                      <FormControl size="small" sx={{ minWidth: 160 }}>
                                        <InputLabel>Scope</InputLabel>
                                        <Select
                                          label="Scope"
                                          value={link.kind}
                                          onChange={(event) => {
                                            const nextKind = event.target.value as RuleLinkKind;
                                            updateRuleLink(link.id, (current) => ({
                                              ...current,
                                              kind: nextKind,
                                              targetId: nextKind === "Global" ? undefined : current.targetId ?? "",
                                            }));
                                          }}
                                        >
                                          <MenuItem value="Global">Global</MenuItem>
                                          <MenuItem value="Schema">Schema</MenuItem>
                                          <MenuItem value="Product">Product</MenuItem>
                                        </Select>
                                      </FormControl>
                                      {link.kind === "Schema" && (
                                        <FormControl size="small" sx={{ minWidth: 200 }}>
                                          <InputLabel>Schema</InputLabel>
                                          <Select
                                            label="Schema"
                                            value={link.targetId ?? ""}
                                            onChange={(event) =>
                                              updateRuleLink(link.id, (current) => ({
                                                ...current,
                                                targetId: event.target.value,
                                              }))
                                            }
                                          >
                                            {schemaOptions.map((option) => (
                                              <MenuItem key={option.id} value={option.id}>
                                                {option.label}
                                              </MenuItem>
                                            ))}
                                          </Select>
                                        </FormControl>
                                      )}
                                      {link.kind === "Product" && (
                                        <FormControl size="small" sx={{ minWidth: 200 }}>
                                          <InputLabel>Product</InputLabel>
                                          <Select
                                            label="Product"
                                            value={link.targetId ?? ""}
                                            onChange={(event) =>
                                              updateRuleLink(link.id, (current) => ({
                                                ...current,
                                                targetId: event.target.value,
                                              }))
                                            }
                                          >
                                            {productOptions.map((option) => (
                                              <MenuItem key={option.id} value={option.id}>
                                                {option.label}
                                              </MenuItem>
                                            ))}
                                          </Select>
                                        </FormControl>
                                      )}
                                      <IconButton onClick={() => handleDeleteLink(link.id)} aria-label="Remove assignment">
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Stack>
                                    <TextField
                                      size="small"
                                      label="Description"
                                      value={link.description ?? ""}
                                      onChange={(event) =>
                                        updateRuleLink(link.id, (current) => ({
                                          ...current,
                                          description: event.target.value,
                                        }))
                                      }
                                    />
                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                                      <TextField
                                        size="small"
                                        type="date"
                                        label="Effective from"
                                        InputLabelProps={{ shrink: true }}
                                        value={link.effectiveFrom ?? ""}
                                        onChange={(event) =>
                                          updateRuleLink(link.id, (current) => ({
                                            ...current,
                                            effectiveFrom: event.target.value || undefined,
                                          }))
                                        }
                                      />
                                      <TextField
                                        size="small"
                                        type="date"
                                        label="Effective to"
                                        InputLabelProps={{ shrink: true }}
                                        value={link.effectiveTo ?? ""}
                                        onChange={(event) =>
                                          updateRuleLink(link.id, (current) => ({
                                            ...current,
                                            effectiveTo: event.target.value || undefined,
                                          }))
                                        }
                                      />
                                    </Stack>
                                    {window && (
                                      <Typography variant="caption" color="text.secondary">
                                        Active {window}
                                      </Typography>
                                    )}
                                  </Stack>
                                );
                              })}
                              {!linksForRule.length && (
                                <Alert severity="info">No assignments yet.</Alert>
                              )}
                              <Stack direction="row" spacing={1}>
                                <Button size="small" onClick={() => handleAddLink(rule.id, "Schema")}>
                                  + Schema
                                </Button>
                                <Button size="small" onClick={() => handleAddLink(rule.id, "Product")}>
                                  + Product
                                </Button>
                              </Stack>
                            </Stack>
                          </Box>
                          <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Scope
                            </Typography>
                            <Stack spacing={2}>
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                                <TextField
                                  size="small"
                                  label="Scope ID"
                                  value={scope.scopeId}
                                  onChange={(event) =>
                                    updateRule(rule.id, (current) => ({
                                      ...current,
                                      scope: {
                                        ...(current.scope ?? scope),
                                        scopeId: event.target.value,
                                        definition: { ...(current.scope?.definition ?? scope.definition) },
                                      },
                                    }))
                                  }
                                />
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="Description"
                                  value={scope.description ?? ""}
                                  onChange={(event) =>
                                    updateRule(rule.id, (current) => ({
                                      ...current,
                                      scope: {
                                        ...(current.scope ?? scope),
                                        description: event.target.value,
                                        definition: { ...(current.scope?.definition ?? scope.definition) },
                                      },
                                    }))
                                  }
                                />
                              </Stack>
                              <TextField
                                size="small"
                                label="Channels"
                                placeholder="comma separated"
                                value={formatList(scope.definition.channels)}
                                onChange={(event) => {
                                  const channels = parseList(event.target.value);
                                  updateRule(rule.id, (current) => ({
                                    ...current,
                                    scope: {
                                      ...(current.scope ?? scope),
                                      definition: { ...(current.scope?.definition ?? scope.definition), channels },
                                    },
                                  }));
                                }}
                              />
                              <TextField
                                size="small"
                                label="Markets"
                                placeholder="comma separated"
                                value={formatList(scope.definition.markets)}
                                onChange={(event) => {
                                  const markets = parseList(event.target.value);
                                  updateRule(rule.id, (current) => ({
                                    ...current,
                                    scope: {
                                      ...(current.scope ?? scope),
                                      definition: { ...(current.scope?.definition ?? scope.definition), markets },
                                    },
                                  }));
                                }}
                              />
                              <TextField
                                size="small"
                                label="Customer segments"
                                placeholder="comma separated"
                                value={formatList(scope.definition.customerSegments)}
                                onChange={(event) => {
                                  const customerSegments = parseList(event.target.value);
                                  updateRule(rule.id, (current) => ({
                                    ...current,
                                    scope: {
                                      ...(current.scope ?? scope),
                                      definition: {
                                        ...(current.scope?.definition ?? scope.definition),
                                        customerSegments,
                                      },
                                    },
                                  }));
                                }}
                              />
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                                <TextField
                                  size="small"
                                  label="Effective from"
                                  type="date"
                                  InputLabelProps={{ shrink: true }}
                                  value={scope.definition.effectiveFrom ?? ""}
                                  onChange={(event) => {
                                    const effectiveFrom = event.target.value || undefined;
                                    updateRule(rule.id, (current) => ({
                                      ...current,
                                      scope: {
                                        ...(current.scope ?? scope),
                                        definition: {
                                          ...(current.scope?.definition ?? scope.definition),
                                          effectiveFrom,
                                        },
                                      },
                                    }));
                                  }}
                                />
                                <TextField
                                  size="small"
                                  label="Effective to"
                                  type="date"
                                  InputLabelProps={{ shrink: true }}
                                  value={scope.definition.effectiveTo ?? ""}
                                  onChange={(event) => {
                                    const effectiveTo = event.target.value || undefined;
                                    updateRule(rule.id, (current) => ({
                                      ...current,
                                      scope: {
                                        ...(current.scope ?? scope),
                                        definition: {
                                          ...(current.scope?.definition ?? scope.definition),
                                          effectiveTo,
                                        },
                                      },
                                    }));
                                  }}
                                />
                              </Stack>
                            </Stack>
                          </Box>
                        </Stack>
                      </Box>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
          {visibleRules.length === 0 && rules.length > 0 && (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                Select a rule to edit.
              </Typography>
            </Box>
          )}
          {rules.length === 0 && (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                No rules defined yet. Use the Add button to create your first rule.
              </Typography>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default RulesWorkspace;
