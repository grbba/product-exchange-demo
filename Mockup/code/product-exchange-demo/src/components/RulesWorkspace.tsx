import React, { useCallback } from "react";
import { Box, Button, Card, CardContent, CardHeader, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import type { SelectChangeEvent } from "@mui/material/Select";
import {
  CONTEXT_REFS,
  LOGICAL_OPERATORS,
  RULE_TYPES,
  SELECTION_SCOPES,
  TARGET_ACTIONS,
  VALUE_OPERATORS,
  createRule,
  defaultScopeDefinition,
  type CompoundExpression,
  type DateTimeExpression,
  type LogicalExpression,
  type SelectionScope,
  type TaxonomyExpression,
  uid,
} from "../domain";
import type { Rule, RuleTarget } from "../domain";

type RulesWorkspaceProps = {
  rules: Rule[];
  onChange: (rules: Rule[]) => void;
  conceptLabel: (id: string) => string;
};

const nextExpressionId = () => `EXP-${uid().toUpperCase()}`;
const nextTargetId = () => `TARGET-${uid().toUpperCase()}`;

type ExpressionEditorProps = {
  expression: LogicalExpression;
  onChange: (expression: LogicalExpression) => void;
  onRemove?: () => void;
  conceptLabel: (id: string) => string;
};

const isCompound = (expression: LogicalExpression): expression is CompoundExpression =>
  expression.kind === "Compound";
const isTaxonomy = (expression: LogicalExpression): expression is TaxonomyExpression =>
  expression.kind === "Taxonomy";
const isDateTime = (expression: LogicalExpression): expression is DateTimeExpression =>
  expression.kind === "DateTime";

const ExpressionEditor: React.FC<ExpressionEditorProps> = ({ expression, onChange, onRemove, conceptLabel }) => {
  if (isCompound(expression)) {
    const handleChildUpdate = (index: number, updated: LogicalExpression) => {
      onChange({
        ...expression,
        children: expression.children.map((child, idx) => (idx === index ? updated : child)),
      });
    };

    const handleAddChild = (kind: LogicalExpression["kind"]) => {
      if (kind === "Taxonomy") {
        const next: TaxonomyExpression = {
          kind: "Taxonomy",
          expressionId: nextExpressionId(),
          subjectRef: "currentProduct",
          taxonomyConceptId: "",
          taxonomyScheme: "",
        };
        onChange({ ...expression, children: [...expression.children, next] });
      } else if (kind === "DateTime") {
        const next: DateTimeExpression = {
          kind: "DateTime",
          expressionId: nextExpressionId(),
          subjectRef: "order",
          operator: "IN",
          value: "",
        };
        onChange({ ...expression, children: [...expression.children, next] });
      } else if (kind === "Compound") {
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
            />
          ))}
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() => handleAddChild("Taxonomy")}
          >
            Add taxonomy condition
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() => handleAddChild("DateTime")}
          >
            Add date window
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
          <TextField
            size="small"
            label="Concept ID"
            value={expression.taxonomyConceptId}
            onChange={(event) => onChange({ ...expression, taxonomyConceptId: event.target.value })}
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

  return (
    <Stack spacing={1} sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Unsupported expression type: {expression.kind}
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

const RulesWorkspace: React.FC<RulesWorkspaceProps> = ({ rules, onChange, conceptLabel }) => {
  const updateRule = useCallback(
    (ruleId: string, updater: (rule: Rule) => Rule) => {
      onChange(rules.map((rule) => (rule.id === ruleId ? updater(rule) : rule)));
    },
    [onChange, rules]
  );

  const handleDeleteRule = (ruleId: string) => {
    onChange(rules.filter((rule) => rule.id !== ruleId));
  };

  const handleAddRule = () => {
    onChange([...rules, createRule()]);
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardHeader
        title="Rules"
        action={
          <Button size="small" startIcon={<AddIcon />} onClick={handleAddRule}>
            Add
          </Button>
        }
      />
      <CardContent>
        <Stack spacing={3}>
          {rules.map((rule) => {
            const bindingEntries = Object.entries(rule.context.bindings);
            const scope = rule.scope ?? {
              scopeId: `SCOPE-${uid().toUpperCase()}`,
              description: "",
              definition: defaultScopeDefinition(),
            };

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
                        Evaluation context
                      </Typography>
                      <Stack spacing={2}>
                        <TextField
                          size="small"
                          label="Context ID"
                          value={rule.context.contextId}
                          onChange={(event) =>
                            updateRule(rule.id, (current) => ({
                              ...current,
                              context: { ...current.context, contextId: event.target.value },
                            }))
                          }
                        />
                        <Stack spacing={1}>
                          {bindingEntries.map(([ref, value]) => (
                            <Stack key={ref} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                              <FormControl size="small" sx={{ minWidth: 160 }}>
                                <InputLabel>Reference</InputLabel>
                                <Select
                                  label="Reference"
                                  value={ref}
                                  onChange={(event) => {
                                    const nextRef = event.target.value as keyof Rule["context"]["bindings"];
                                    updateRule(rule.id, (current) => {
                                      const bindings = { ...current.context.bindings };
                                      const currentValue = bindings[ref as keyof typeof bindings];
                                      delete bindings[ref as keyof typeof bindings];
                                      if (bindings[nextRef] !== undefined) {
                                        return current;
                                      }
                                      bindings[nextRef] = currentValue;
                                      return {
                                        ...current,
                                        context: { ...current.context, bindings },
                                      };
                                    });
                                  }}
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
                                onChange={(event) =>
                                  updateRule(rule.id, (current) => ({
                                    ...current,
                                    context: {
                                      ...current.context,
                                      bindings: { ...current.context.bindings, [ref]: event.target.value },
                                    },
                                  }))
                                }
                              />
                              <IconButton
                                onClick={() =>
                                  updateRule(rule.id, (current) => {
                                    const nextBindings = { ...current.context.bindings };
                                    delete nextBindings[ref as keyof typeof nextBindings];
                                    return {
                                      ...current,
                                      context: { ...current.context, bindings: nextBindings },
                                    };
                                  })
                                }
                                aria-label="Remove binding"
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          ))}
                          {bindingEntries.length < CONTEXT_REFS.length && (
                            <Button
                              size="small"
                              startIcon={<AddIcon fontSize="small" />}
                              onClick={() =>
                                updateRule(rule.id, (current) => {
                                  const available = CONTEXT_REFS.find(
                                    (ref) => current.context.bindings[ref] === undefined
                                  );
                                  if (!available) return current;
                                  return {
                                    ...current,
                                    context: {
                                      ...current.context,
                                      bindings: { ...current.context.bindings, [available]: "" },
                                    },
                                  };
                                })
                              }
                            >
                              Add binding
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Logical expression
                      </Typography>
                      <ExpressionEditor
                        expression={rule.expression}
                        onChange={(expression) => updateRule(rule.id, (current) => ({ ...current, expression }))}
                        conceptLabel={conceptLabel}
                      />
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Targets
                      </Typography>
                      <Stack spacing={2}>
                        {rule.targets.map((target, index) => (
                          <Stack
                            key={target.targetId}
                            spacing={2}
                            sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2 }}
                          >
                            <Stack direction="row" spacing={2} alignItems="center">
                              <FormControl size="small" sx={{ minWidth: 160 }}>
                                <InputLabel>Target type</InputLabel>
                                <Select
                                  label="Target type"
                                  value={target.kind}
                                  onChange={(event) =>
                                    updateRule(rule.id, (current) => {
                                      const nextKind = event.target.value as RuleTarget["kind"];
                                      const nextTargets = current.targets.map((existing, idx) => {
                                        if (idx !== index) return existing;
                                        if (nextKind === "Taxonomy") {
                                          return {
                                            kind: "Taxonomy" as const,
                                            targetId: existing.targetId,
                                            action: existing.action,
                                            description: existing.description,
                                            conceptId: "apmwg:66B0BOM6",
                                          };
                                        }
                                        return {
                                          kind: "Product" as const,
                                          targetId: existing.targetId,
                                          action: existing.action,
                                          description: existing.description,
                                          productId: "",
                                        };
                                      });
                                      return { ...current, targets: nextTargets };
                                    })
                                  }
                                >
                                  <MenuItem value="Taxonomy">Taxonomy</MenuItem>
                                  <MenuItem value="Product">Product</MenuItem>
                                </Select>
                              </FormControl>
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
                                          ? { ...existing, action: event.target.value as RuleTarget["action"] }
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
                            {target.kind === "Taxonomy" ? (
                              <TextField
                                size="small"
                                label="Taxonomy concept ID"
                                value={target.conceptId}
                                onChange={(event) =>
                                  updateRule(rule.id, (current) => ({
                                    ...current,
                                    targets: current.targets.map((existing, idx) =>
                                      idx === index ? { ...existing, conceptId: event.target.value } : existing
                                    ),
                                  }))
                                }
                                helperText={conceptLabel(target.conceptId) || "Enter a concept ID"}
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
                                  targetId: nextTargetId(),
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
