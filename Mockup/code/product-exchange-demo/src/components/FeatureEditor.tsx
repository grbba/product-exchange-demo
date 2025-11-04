import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import type {
  Concept,
  Feature,
  FeatureValue,
  ReferenceSystem,
  ReferenceValidationProvider,
  SingleValue,
  ValueRange,
  DiscreteSet,
  InternalReferenceSource,
  TaxonomyConceptSetReference,
} from "../domain";
import { uid } from "../domain";
import InfoTooltipIcon from "./InfoTooltipIcon";
import { validateIataAirport } from "../validateIataAirport";

type ConceptOption = { id: string; label: string };

const asTaxonomyConceptSet = (system: ReferenceSystem): TaxonomyConceptSetReference | null => {
  if (system.source.kind !== "Internal") return null;
  const internal = system.source as InternalReferenceSource;
  return internal.repositoryType === "TaxonomyConceptSet"
    ? (internal as TaxonomyConceptSetReference)
    : null;
};

const collectTaxonomyConcepts = (
  source: TaxonomyConceptSetReference,
  conceptById: Map<string, Concept>
): Concept[] => {
  const anchors = source.anchorConceptIds
    .map((id) => conceptById.get(id))
    .filter((concept): concept is Concept => Boolean(concept));
  if (!anchors.length) return [];

  if (source.closurePolicy === "individual") {
    return anchors;
  }

  if (source.closurePolicy === "direct") {
    const children = new Map<string, Concept>();
    for (const anchor of anchors) {
      for (const childId of anchor.narrower ?? []) {
        const child = conceptById.get(childId);
        if (child) {
          children.set(child.id, child);
        }
      }
    }
    return Array.from(children.values());
  }

  const collected = new Map<string, Concept>();
  const visited = new Set<string>();
  const queue: Concept[] = [...anchors];

  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    collected.set(current.id, current);

    for (const childId of current.narrower ?? []) {
      const child = conceptById.get(childId);
      if (child && !visited.has(child.id)) {
        queue.push(child);
      }
    }
  }

  return Array.from(collected.values());
};

type FeatureEditorProps = {
  title: string;
  features: Feature[];
  selectedFeatureId: string | null;
  onSelectFeature: (featureId: string | null) => void;
  onChange: (features: Feature[]) => void;
  conceptLabel: (id: string) => string;
  referenceSystems: ReferenceSystem[];
  conceptOptions?: Concept[];
  onAddTag?: (featureId: string, conceptId: string) => void;
  onRemoveTag?: (featureId: string, conceptId: string) => void;
  titleTooltip?: string;
  addButtonTooltip?: string;
  splitView?: boolean;
  hideAddFeature?: boolean;
  lockStructure?: boolean;
};

const createValue = (kind: FeatureValue["kind"]): FeatureValue => {
  if (kind === "SingleValue") return { kind, value: "" };
  if (kind === "ValueRange") return { kind, min: "", max: "" };
  return { kind, values: [] };
};

const FeatureEditor: React.FC<FeatureEditorProps> = ({
  title,
  features,
  selectedFeatureId,
  onSelectFeature,
  onChange,
  conceptLabel,
  referenceSystems,
  conceptOptions,
  onAddTag,
  onRemoveTag,
  titleTooltip,
  addButtonTooltip,
  splitView = false,
  hideAddFeature = false,
  lockStructure = false,
}) => {
  const [tagSelections, setTagSelections] = useState<Record<string, string>>({});
  const [discreteInputs, setDiscreteInputs] = useState<Record<string, string>>({});
  const [valueErrors, setValueErrors] = useState<Record<string, string | null>>({});
  const validationRequests = useRef<Record<string, number>>({});

  const discreteKey = (featureId: string, index: number) => `${featureId}:${index}`;

  const validationProviderByReference = useMemo(() => {
    const map = new Map<string, ReferenceValidationProvider | undefined>();
    for (const system of referenceSystems) {
      map.set(system.id, system.validationProvider);
    }
    return map;
  }, [referenceSystems]);

  const conceptById = useMemo(() => {
    if (!conceptOptions?.length) return new Map<string, Concept>();
    return new Map(conceptOptions.map((concept) => [concept.id, concept] as const));
  }, [conceptOptions]);

  const taxonomyConceptChoices = useMemo(() => {
    const map = new Map<string, ConceptOption[]>();
    if (!conceptOptions?.length) return map;

    for (const system of referenceSystems) {
      const taxonomySource = asTaxonomyConceptSet(system);
      if (!taxonomySource) continue;
      const concepts = collectTaxonomyConcepts(taxonomySource, conceptById);
      if (!concepts.length) {
        map.set(system.id, []);
        continue;
      }
      const sorted = concepts
        .map((concept) => ({ id: concept.id, label: concept.label }))
        .sort((a, b) => a.label.localeCompare(b.label));
      map.set(system.id, sorted);
    }

    return map;
  }, [conceptOptions, referenceSystems, conceptById]);

  useEffect(() => {
    setTagSelections((previous) => {
      const next = { ...previous };
      for (const key of Object.keys(next)) {
        if (!features.some((feature) => feature.id === key)) {
          delete next[key];
        }
      }
      return next;
    });

    setDiscreteInputs((previous) => {
      const next: Record<string, string> = {};
      for (const feature of features) {
        feature.values.forEach((value, index) => {
          if (value.kind !== "DiscreteSet") return;
          const key = discreteKey(feature.id, index);
          const taxonomyChoices = value.referenceSystemId
            ? taxonomyConceptChoices.get(value.referenceSystemId)
            : undefined;
          if (taxonomyChoices && taxonomyChoices.length) {
            return;
          }
          next[key] = previous[key] ?? value.values.join(", ");
        });
      }
      return next;
    });
  }, [features, taxonomyConceptChoices]);

  const singleValueKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const feature of features) {
      feature.values.forEach((value, index) => {
        if (value.kind === "SingleValue") {
          keys.add(`${feature.id}:${index}`);
        }
      });
    }
    return keys;
  }, [features]);

  useEffect(() => {
    setValueErrors((previous) => {
      const next: Record<string, string | null> = {};
      let changed = false;
      for (const key of Object.keys(previous)) {
        if (singleValueKeys.has(key)) {
          next[key] = previous[key];
        } else {
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [singleValueKeys]);

  const clearError = useCallback((key: string) => {
    setValueErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }, []);

  const runValidation = useCallback(async (
    key: string,
    provider: ReferenceValidationProvider | undefined,
    rawValue: string
  ) => {
    if (!lockStructure || !provider) return;
    if (provider !== "amadeus-airport") return;

    const value = rawValue.trim().toUpperCase();
    if (!value) {
      setValueErrors((previous) => ({ ...previous, [key]: "Code is required." }));
      return;
    }

    const requestId = (validationRequests.current[key] ?? 0) + 1;
    validationRequests.current[key] = requestId;

    const result = await validateIataAirport(value);
    if (validationRequests.current[key] !== requestId) return;

    setValueErrors((previous) => ({
      ...previous,
      [key]: result.valid ? null : result.reason ?? "Invalid airport code.",
    }));
  }, [lockStructure]);

  useEffect(() => {
    if (!splitView) return;
    if (!features.length) {
      if (selectedFeatureId) onSelectFeature(null);
      return;
    }
    if (!selectedFeatureId || !features.some((feature) => feature.id === selectedFeatureId)) {
      onSelectFeature(features[0].id);
    }
  }, [features, selectedFeatureId, onSelectFeature, splitView]);

  const addFeature = () => {
    const feature: Feature = { id: uid(), name: "New Feature", description: "", values: [], tags: [] };
    onChange([...features, feature]);
    onSelectFeature(feature.id);
  };

  const setFeature = (featureId: string, updater: (feature: Feature) => Feature) => {
    onChange(features.map((feature) => (feature.id === featureId ? updater(feature) : feature)));
  };

  const removeFeature = (featureId: string) => {
    const remaining = features.filter((feature) => feature.id !== featureId);
    onChange(remaining);
    if (selectedFeatureId === featureId) {
      onSelectFeature(remaining[0]?.id ?? null);
    }
  };

  const addValue = (featureId: string, kind: FeatureValue["kind"]) => {
    setFeature(featureId, (feature) => ({
      ...feature,
      values: [...feature.values, createValue(kind)],
    }));
  };

  const removeValue = (featureId: string, index: number) => {
    setFeature(featureId, (feature) => {
      const next = [...feature.values];
      next.splice(index, 1);
      return { ...feature, values: next };
    });
  };

  const renderFeatureCard = (feature: Feature, options: { highlight: boolean; onClick?: () => void }) => (
    <Card
      key={feature.id}
      variant="outlined"
      sx={{
        borderRadius: 3,
        borderColor: options.highlight ? "primary.main" : undefined,
      }}
      onClick={options.onClick}
    >
      <CardHeader
        title={
          <TextField
            size="small"
            label="Feature name"
            value={feature.name}
            onChange={(event) => {
              if (lockStructure) return;
              setFeature(feature.id, (current) => ({ ...current, name: event.target.value }));
            }}
            disabled={lockStructure}
          />
        }
        action={
          <IconButton
            aria-label="delete feature"
            onClick={() => !lockStructure && removeFeature(feature.id)}
            disabled={lockStructure}
          >
            <DeleteIcon />
          </IconButton>
        }
      />
      <CardContent>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            size="small"
            label="Description"
            multiline
            minRows={2}
            value={feature.description ?? ""}
            onChange={(event) =>
              setFeature(feature.id, (current) => ({ ...current, description: event.target.value }))
            }
          />
          {feature.tags.length ? (
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              {feature.tags.map((tag) => (
                <Chip
                  key={tag}
                  label={conceptLabel(tag)}
                  size="small"
                  onDelete={onRemoveTag ? () => onRemoveTag(feature.id, tag) : undefined}
                />
              ))}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">
              No taxonomy tags.
            </Typography>
          )}

          {conceptOptions && onAddTag ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-end">
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel id={`feature-tag-${feature.id}`}>Add taxonomy concept</InputLabel>
                <Select
                  labelId={`feature-tag-${feature.id}`}
                  label="Add taxonomy concept"
                  value={tagSelections[feature.id] ?? ""}
                  onChange={(event) =>
                    setTagSelections((previous) => ({ ...previous, [feature.id]: event.target.value }))
                  }
                  disabled={lockStructure}
                >
                  <MenuItem value="">
                    <em>— choose —</em>
                  </MenuItem>
                  {conceptOptions.map((concept) => (
                    <MenuItem key={concept.id} value={concept.id}>
                      {concept.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
                <Button
                  variant="outlined"
                  onClick={() => {
                    const selection = tagSelections[feature.id];
                    if (!selection) return;
                    onAddTag(feature.id, selection);
                    setTagSelections((previous) => ({ ...previous, [feature.id]: "" }));
                  }}
                  disabled={lockStructure || !tagSelections[feature.id]}
                >
                  Add tag
                </Button>
            </Stack>
          ) : null}
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
          }}
        >
          {feature.values.map((value, index) => {
            const key = discreteKey(feature.id, index);
            const validationProvider =
              value.kind === "SingleValue" && value.referenceSystemId
                ? validationProviderByReference.get(value.referenceSystemId)
                : undefined;
            const errorMessage = valueErrors[key] ?? null;
            return (
              <Card key={`${feature.id}-${index}`} variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Chip label={value.kind} size="small" />
                  <IconButton onClick={() => removeValue(feature.id, index)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Box sx={{ mt: 2 }}>
                  {value.kind === "SingleValue" && (
                    <Stack spacing={1.5}>
                      {(() => {
                        const taxonomyChoices = value.referenceSystemId
                          ? taxonomyConceptChoices.get(value.referenceSystemId)
                          : undefined;
                        const hasTaxonomyChoices = Boolean(taxonomyChoices && taxonomyChoices.length);
                        if (hasTaxonomyChoices) {
                          return (
                            <FormControl size="small">
                              <InputLabel id={`single-value-${feature.id}-${index}`}>Value</InputLabel>
                              <Select
                                labelId={`single-value-${feature.id}-${index}`}
                                label="Value"
                                value={value.value ?? ""}
                                onChange={(event) =>
                                  setFeature(feature.id, (current) => {
                                    const next = [...current.values];
                                    (next[index] as SingleValue).value = event.target.value;
                                    return { ...current, values: next };
                                  })
                                }
                              >
                                <MenuItem value="">
                                  <em>— choose —</em>
                                </MenuItem>
                                {taxonomyChoices!.map((option) => (
                                  <MenuItem key={option.id} value={option.id}>
                                    {option.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          );
                        }
                        if (value.referenceSystemId && taxonomyChoices && !taxonomyChoices.length) {
                          return (
                            <Typography variant="body2" color="text.secondary">
                              No taxonomy concepts available for the selected reference system.
                            </Typography>
                          );
                        }
                        return (
                          <TextField
                            size="small"
                            label="Value"
                            value={value.value}
                            onChange={(event) => {
                              const input = event.target.value;
                              const normalized =
                                lockStructure && validationProvider === "amadeus-airport"
                                  ? input.toUpperCase()
                                  : input;
                              setFeature(feature.id, (current) => {
                                const next = [...current.values];
                                (next[index] as SingleValue).value = normalized;
                                return { ...current, values: next };
                              });
                              clearError(key);
                            }}
                            onBlur={(event) => {
                              if (validationProvider === "amadeus-airport") {
                                runValidation(key, validationProvider, event.target.value);
                              }
                            }}
                            error={Boolean(errorMessage)}
                            helperText={errorMessage ?? undefined}
                          />
                        );
                      })()}
                      <FormControl size="small">
                        <InputLabel id={`single-ref-${feature.id}-${index}`}>Reference</InputLabel>
                        <Select
                          labelId={`single-ref-${feature.id}-${index}`}
                          label="Reference"
                          value={value.referenceSystemId ?? ""}
                          onChange={(event) => {
                            setFeature(feature.id, (current) => {
                              const next = [...current.values];
                              const selectedRef = event.target.value || undefined;
                              const single = next[index] as SingleValue;
                              single.referenceSystemId = selectedRef;
                              if (selectedRef) {
                                const taxonomyChoices = taxonomyConceptChoices.get(selectedRef);
                                if (taxonomyChoices && taxonomyChoices.length) {
                                  if (!taxonomyChoices.some((option) => option.id === single.value)) {
                                    single.value = taxonomyChoices[0]?.id ?? "";
                                  }
                                }
                              }
                              return { ...current, values: next };
                            });
                            clearError(key);
                          }}
                          onBlur={() => {
                            if (validationProvider === "amadeus-airport") {
                              runValidation(key, validationProvider, value.value ?? "");
                            }
                          }}
                          disabled={lockStructure}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {referenceSystems.map((ref) => (
                            <MenuItem
                              key={ref.id}
                              value={ref.id}
                            >{`${ref.identifier || ref.description || ref.id} (${ref.systemType})`}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                  )}
                  {value.kind === "ValueRange" && (
                    <Stack spacing={1.5}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                        <TextField
                          size="small"
                          label="Min"
                          value={value.min}
                          onChange={(event) =>
                            setFeature(feature.id, (current) => {
                              const next = [...current.values];
                              (next[index] as ValueRange).min = event.target.value;
                              return { ...current, values: next };
                            })
                          }
                        />
                        <TextField
                          size="small"
                          label="Max"
                          value={value.max}
                          onChange={(event) =>
                            setFeature(feature.id, (current) => {
                              const next = [...current.values];
                              (next[index] as ValueRange).max = event.target.value;
                              return { ...current, values: next };
                            })
                          }
                        />
                      </Stack>
                      <FormControl size="small">
                        <InputLabel id={`range-ref-${feature.id}-${index}`}>Reference</InputLabel>
                        <Select
                          labelId={`range-ref-${feature.id}-${index}`}
                          label="Reference"
                          value={value.referenceSystemId ?? ""}
                          onChange={(event) =>
                            setFeature(feature.id, (current) => {
                              const next = [...current.values];
                              (next[index] as ValueRange).referenceSystemId =
                                event.target.value || undefined;
                              return { ...current, values: next };
                            })
                          }
                          disabled={lockStructure}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {referenceSystems.map((ref) => (
                            <MenuItem
                              key={ref.id}
                              value={ref.id}
                            >{`${ref.identifier || ref.description || ref.id} (${ref.systemType})`}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                  )}
                  {value.kind === "DiscreteSet" && (
                    <Stack spacing={1.5}>
                      {(() => {
                        const taxonomyChoices = value.referenceSystemId
                          ? taxonomyConceptChoices.get(value.referenceSystemId)
                          : undefined;
                        const hasTaxonomyChoices = Boolean(taxonomyChoices && taxonomyChoices.length);
                        if (hasTaxonomyChoices) {
                          return (
                            <FormControl size="small">
                              <InputLabel id={`set-values-${feature.id}-${index}`}>Values</InputLabel>
                              <Select
                                labelId={`set-values-${feature.id}-${index}`}
                                label="Values"
                                multiple
                                value={value.values}
                                onChange={(event) => {
                                  const selections = Array.isArray(event.target.value)
                                    ? (event.target.value as string[])
                                    : [event.target.value as string];
                                  setFeature(feature.id, (current) => {
                                    const next = [...current.values];
                                    (next[index] as DiscreteSet).values = selections;
                                    return { ...current, values: next };
                                  });
                                }}
                                renderValue={(selected) => (
                                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                    {(selected as string[]).map((item) => (
                                      <Chip key={item} label={conceptLabel(item)} size="small" />
                                    ))}
                                  </Box>
                                )}
                              >
                                {taxonomyChoices!.map((option) => (
                                  <MenuItem key={option.id} value={option.id}>
                                    {option.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          );
                        }
                        if (value.referenceSystemId && taxonomyChoices && !taxonomyChoices.length) {
                          return (
                            <Typography variant="body2" color="text.secondary">
                              No taxonomy concepts available for the selected reference system.
                            </Typography>
                          );
                        }
                        return (
                          <TextField
                            size="small"
                            label="Comma separated values"
                            value={discreteInputs[key] ?? value.values.join(", ")}
                            onChange={(event) => {
                              const raw = event.target.value;
                              setDiscreteInputs((previous) => ({ ...previous, [key]: raw }));
                              const values = raw
                                .split(",")
                                .map((entry) => entry.trim())
                                .filter(Boolean);
                              setFeature(feature.id, (current) => {
                                const next = [...current.values];
                                (next[index] as DiscreteSet).values = values;
                                return { ...current, values: next };
                              });
                            }}
                          />
                        );
                      })()}
                      <FormControl size="small">
                        <InputLabel id={`set-ref-${feature.id}-${index}`}>Reference</InputLabel>
                        <Select
                          labelId={`set-ref-${feature.id}-${index}`}
                          label="Reference"
                          value={value.referenceSystemId ?? ""}
                          onChange={(event) =>
                            setFeature(feature.id, (current) => {
                              const next = [...current.values];
                              const selectedRef = event.target.value || undefined;
                              const setValue = next[index] as DiscreteSet;
                              setValue.referenceSystemId = selectedRef;
                              if (selectedRef) {
                                const taxonomyChoices = taxonomyConceptChoices.get(selectedRef);
                                if (taxonomyChoices && taxonomyChoices.length) {
                                  setValue.values = setValue.values.filter((item) =>
                                    taxonomyChoices.some((option) => option.id === item)
                                  );
                                }
                              }
                              return { ...current, values: next };
                            })
                          }
                          disabled={lockStructure}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {referenceSystems.map((ref) => (
                            <MenuItem
                              key={ref.id}
                              value={ref.id}
                            >{`${ref.identifier || ref.description || ref.id} (${ref.systemType})`}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                  )}
                </Box>
              </Card>
            );
          })}
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => addValue(feature.id, "SingleValue")}
          >
            Add single value
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => addValue(feature.id, "ValueRange")}
          >
            Add range
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => addValue(feature.id, "DiscreteSet")}
          >
            Add discrete set
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );

  const header = (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
      <Typography variant="h6" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
        {title}
        {titleTooltip ? <InfoTooltipIcon title={titleTooltip} /> : null}
      </Typography>
      {!hideAddFeature && !lockStructure && (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Button variant="contained" startIcon={<AddIcon />} onClick={addFeature}>
            Add feature
          </Button>
          {addButtonTooltip ? <InfoTooltipIcon title={addButtonTooltip} /> : null}
        </Stack>
      )}
    </Stack>
  );

  if (splitView) {
    const activeFeature =
      features.find((feature) => feature.id === selectedFeatureId) ?? features[0] ?? null;

    return (
      <Box>
        {header}
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Box
            sx={{
              flexBasis: { md: "30%" },
              flexGrow: 0,
              flexShrink: 0,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              p: 2,
              maxHeight: { md: 420 },
              overflowY: "auto",
              bgcolor: "background.paper",
              minWidth: { md: 240 },
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {title}
            </Typography>
            <Divider sx={{ mb: 1 }} />
            {features.length ? (
              <List dense disablePadding>
                {features.map((feature) => (
                  <ListItemButton
                    key={feature.id}
                    selected={feature.id === activeFeature?.id}
                    onClick={() => onSelectFeature(feature.id)}
                    sx={{ borderRadius: 2, mb: 0.5 }}
                  >
                    <ListItemText
                      primary={feature.name}
                      secondary={feature.tags.length ? `${feature.tags.length} tags` : undefined}
                    />
                  </ListItemButton>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No features yet. Use “Add feature” to start defining the schema.
              </Typography>
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {activeFeature ? (
              renderFeatureCard(activeFeature, { highlight: true })
            ) : (
              <Box
                sx={{
                  border: "1px dashed",
                  borderColor: "divider",
                  borderRadius: 3,
                  p: 4,
                  textAlign: "center",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Select a feature to edit its properties.
                </Typography>
              </Box>
            )}
          </Box>
        </Stack>
      </Box>
    );
  }

  return (
    <Box>
      {header}
      <Stack spacing={2}>
        {features.map((feature) =>
          renderFeatureCard(feature, {
            highlight: feature.id === selectedFeatureId,
            onClick: () => onSelectFeature(feature.id),
          })
        )}
        {!features.length && (
          <Box
            sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 3, p: 4, textAlign: "center" }}
          >
            <Typography variant="body2" color="text.secondary">
              No features yet. Create one to start defining structure and allowed values.
            </Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default FeatureEditor;
