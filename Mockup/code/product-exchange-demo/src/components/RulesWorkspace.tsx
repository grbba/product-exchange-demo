import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import type { SelectChangeEvent } from "@mui/material/Select";
import {
  CONTEXT_REFS,
  LOGICAL_OPERATORS,
  RULE_TYPES,
  SELECTION_SCOPES,
  VALUE_OPERATORS,
  createRuleLink,
  defaultScopeDefinition,
  updateTimestamp,
  type CompoundExpression,
  type DateTimeExpression,
  type FeatureExpression,
  type LogicalExpression,
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
};

type ExpressionEditorProps = {
  expression: LogicalExpression;
  onChange: (expression: LogicalExpression) => void;
  onRemove?: () => void;
  conceptLabel: (id: string) => string;
  concepts: Concept[];
};

type ConditionKind = "Taxonomy" | "DateTime" | "Feature" | "Product" | "Quantity";

const nextExpressionId = () => `EXP-${uid().toUpperCase()}`;

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

const ExpressionEditor: React.FC<ExpressionEditorProps> = ({
  expression,
  onChange,
  onRemove,
  conceptLabel,
  concepts,
}) => {
  const [conditionKind, setConditionKind] = useState<ConditionKind>("Taxonomy");

  if (isCompound(expression)) {
    const handleChildUpdate = (index: number, updated: LogicalExpression) => {
      onChange({
        ...expression,
        children: expression.children.map((child, idx) => (idx === index ? updated : child)),
      });
    };

    const handleAddChild = (kind: ConditionKind | "Compound") => {
      if (kind === "Taxonomy") {
        const next: TaxonomyExpression = {
          kind: "Taxonomy",
          expressionId: nextExpressionId(),
          subjectRef: "currentProduct",
          taxonomyConceptId: "",
          taxonomyScheme: "apmwg:product_taxonomy_scheme",
        };
        onChange({ ...expression, children: [...expression.children, next] });
      } else if (kind === "DateTime") {
        const next: DateTimeExpression = {
          kind: "DateTime",
          expressionId: nextExpressionId(),
          subjectRef: "offer",
          operator: "IN",
          value: "",
        };
        onChange({ ...expression, children: [...expression.children, next] });
      } else if (kind === "Feature") {
        const next: FeatureExpression = {
          kind: "Feature",
          expressionId: nextExpressionId(),
          subjectRef: "currentProduct",
          featureId: "",
          operator: "EQUALS",
          value: "",
        };
        onChange({ ...expression, children: [...expression.children, next] });
      } else if (kind === "Product") {
        const next: ProductExpression = {
          kind: "Product",
          expressionId: nextExpressionId(),
          subjectRef: "currentProduct",
          productId: "",
          operator: "EQUALS",
        };
        onChange({ ...expression, children: [...expression.children, next] });
      } else if (kind === "Quantity") {
        const next: QuantityExpression = {
          kind: "Quantity",
          expressionId: nextExpressionId(),
          subjectRef: "currentProduct",
          itemId: "",
          quantity: 0,
          operator: "EQUALS",
        };
        onChange({ ...expression, children: [...expression.children, next] });
      } else {
        const next: CompoundExpression = {
          kind: "Compound",
          expressionId: nextExpressionId(),
          operator: "AND",
          description: "",
          children: [],
        };
        onChange({ ...expression, children: [...expression.children, next] });
      }
    };

    const handleRemoveChild = (index: number) => {
      onChange({
        ...expression,
        children: expression.children.filter((_, idx) => idx !== index),
      });
    };

    return (
      <Stack spacing={2} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
        <Stack direction="row" spacing={2}>
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
        <Stack spacing={2}>
          {expression.children.map((child, index) => (
            <ExpressionEditor
              key={child.expressionId}
              expression={child}
              onChange={(updated) => handleChildUpdate(index, updated)}
              onRemove={() => handleRemoveChild(index)}
              conceptLabel={conceptLabel}
              concepts={concepts}
            />
          ))}
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Condition type</InputLabel>
            <Select
              label="Condition type"
              value={conditionKind}
              onChange={(event) => setConditionKind(event.target.value as ConditionKind)}
            >
              <MenuItem value="Taxonomy">Taxonomy condition</MenuItem>
              <MenuItem value="DateTime">Date/time condition</MenuItem>
              <MenuItem value="Feature">Feature condition</MenuItem>
              <MenuItem value="Product">Product condition</MenuItem>
              <MenuItem value="Quantity">Quantity condition</MenuItem>
            </Select>
          </FormControl>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() => handleAddChild(conditionKind)}
          >
            Add condition
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() => handleAddChild("Compound")}
          >
            Add nested group
          </Button>
        </Stack>
      </Stack>
    );
  }

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
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Subject</InputLabel>
            <Select
              label="Subject"
              value={expression.subjectRef}
              onChange={(event) =>
                onChange({ ...expression, subjectRef: event.target.value as typeof expression.subjectRef })
              }
            >
              {CONTEXT_REFS.map((ref) => (
                <MenuItem key={ref} value={ref}>
                  {ref}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Autocomplete<Concept, false, false, true>
            freeSolo
            size="small"
            options={concepts}
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
                <Stack spacing={0}>
                  <Typography variant="body2">{option.label || option.id}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.id}
                  </Typography>
                </Stack>
              </li>
            )}
            renderInput={(params) => (
              <TextField {...params} label="Taxonomy concept" placeholder="Search by label or ID" />
            )}
          />
          <TextField
            size="small"
            label="Taxonomy scheme"
            value={expression.taxonomyScheme}
            onChange={(event) => onChange({ ...expression, taxonomyScheme: event.target.value })}
          />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Selection scope</InputLabel>
            <Select
              label="Selection scope"
              value={expression.selectionScope ?? ""}
              onChange={(event: SelectChangeEvent<string>) => {
                const scope = event.target.value as SelectionScope | "";
                onChange({ ...expression, selectionScope: scope || undefined });
              }}
            >
              <MenuItem value="">
                <em>Not specified</em>
              </MenuItem>
              {SELECTION_SCOPES.map((scope) => (
                <MenuItem key={scope} value={scope}>
                  {scope}
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
        </Stack>
        {label && (
          <Typography variant="caption" color="text.secondary">
            Concept label: {label}
          </Typography>
        )}
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
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Subject</InputLabel>
            <Select
              label="Subject"
              value={expression.subjectRef}
              onChange={(event) =>
                onChange({ ...expression, subjectRef: event.target.value as typeof expression.subjectRef })
              }
            >
              {CONTEXT_REFS.map((ref) => (
                <MenuItem key={ref} value={ref}>
                  {ref}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Subject</InputLabel>
            <Select
              label="Subject"
              value={expression.subjectRef}
              onChange={(event) =>
                onChange({ ...expression, subjectRef: event.target.value as typeof expression.subjectRef })
              }
            >
              {CONTEXT_REFS.map((ref) => (
                <MenuItem key={ref} value={ref}>
                  {ref}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Feature name or ID"
            value={expression.featureId}
            onChange={(event) => onChange({ ...expression, featureId: event.target.value })}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Operator</InputLabel>
            <Select
              label="Operator"
              value={expression.operator}
              onChange={(event) => onChange({ ...expression, operator: event.target.value as typeof expression.operator })}
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
            label="Value"
            value={expression.value ?? ""}
            onChange={(event) => onChange({ ...expression, value: event.target.value })}
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

  if (isProductExpression(expression)) {
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
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Subject</InputLabel>
            <Select
              label="Subject"
              value={expression.subjectRef}
              onChange={(event) =>
                onChange({ ...expression, subjectRef: event.target.value as typeof expression.subjectRef })
              }
            >
              {CONTEXT_REFS.map((ref) => (
                <MenuItem key={ref} value={ref}>
                  {ref}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Product ID"
            value={expression.productId}
            onChange={(event) => onChange({ ...expression, productId: event.target.value })}
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
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Subject</InputLabel>
            <Select
              label="Subject"
              value={expression.subjectRef}
              onChange={(event) =>
                onChange({ ...expression, subjectRef: event.target.value as typeof expression.subjectRef })
              }
            >
              {CONTEXT_REFS.map((ref) => (
                <MenuItem key={ref} value={ref}>
                  {ref}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Item ID"
            value={expression.itemId}
            onChange={(event) => onChange({ ...expression, itemId: event.target.value })}
          />
          <TextField
            size="small"
            type="number"
            label="Quantity"
            value={expression.quantity}
            onChange={(event) =>
              onChange({ ...expression, quantity: Number(event.target.value) || 0 })
            }
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
  const schemaName = useCallback(
    (id?: string) => {
      if (!id) return "Not set";
      return schemaOptions.find((option) => option.id === id)?.label ?? id;
    },
    [schemaOptions]
  );
  const productName = useCallback(
    (id?: string) => {
      if (!id) return "Not set";
      return productOptions.find((option) => option.id === id)?.label ?? id;
    },
    [productOptions]
  );
  const visibleRules = useMemo(
    () => (selectedRuleId ? rules.filter((rule) => rule.id === selectedRuleId) : rules),
    [rules, selectedRuleId]
  );

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
                          onChange={(event) =>
                            updateRule(rule.id, (current) => ({ ...current, ruleId: event.target.value }))
                          }
                        />
                        <TextField
                          label="Rule name"
                          size="small"
                          fullWidth
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
                    <IconButton onClick={() => handleDeleteRule(rule.id)} aria-label="Delete rule">
                      <DeleteIcon />
                    </IconButton>
                  }
                />
                <CardContent>
                  <Stack spacing={3}>
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
                      />
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Assignments
                      </Typography>
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
                              <Typography variant="caption" color="text.secondary">
                                {link.kind === "Global"
                                  ? "Applies globally"
                                  : link.kind === "Schema"
                                  ? `Schema: ${schemaName(link.targetId)}`
                                  : `Product: ${productName(link.targetId)}`}
                                {window ? ` · ${window}` : ""}
                              </Typography>
                            </Stack>
                          );
                        })}
                        {linksForRule.length === 0 && (
                          <Typography variant="body2" color="text.secondary">
                            No assignments yet. Add at least one to activate this rule.
                          </Typography>
                        )}
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button
                            size="small"
                            startIcon={<AddIcon fontSize="small" />}
                            onClick={() => handleAddLink(rule.id, "Global")}
                          >
                            Add global assignment
                          </Button>
                          <Button
                            size="small"
                            startIcon={<AddIcon fontSize="small" />}
                            onClick={() => handleAddLink(rule.id, "Schema")}
                            disabled={!schemaOptions.length}
                          >
                            Add schema assignment
                          </Button>
                          <Button
                            size="small"
                            startIcon={<AddIcon fontSize="small" />}
                            onClick={() => handleAddLink(rule.id, "Product")}
                            disabled={!productOptions.length}
                          >
                            Add product assignment
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                    <Box>
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
