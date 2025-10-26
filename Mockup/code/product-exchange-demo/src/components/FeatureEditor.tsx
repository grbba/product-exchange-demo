import React from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import type { Feature, FeatureValue, ReferenceSystem, SingleValue, ValueRange, DiscreteSet } from "../domain";
import { uid } from "../domain";

type FeatureEditorProps = {
  title: string;
  features: Feature[];
  selectedFeatureId: string | null;
  onSelectFeature: (featureId: string | null) => void;
  onChange: (features: Feature[]) => void;
  conceptLabel: (id: string) => string;
  referenceSystems: ReferenceSystem[];
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
}) => {
  const setFeature = (featureId: string, updater: (feature: Feature) => Feature) => {
    onChange(features.map((feature) => (feature.id === featureId ? updater(feature) : feature)));
  };

  const addFeature = () => {
    const feature: Feature = { id: uid(), name: "New Feature", description: "", values: [], tags: [] };
    onChange([...features, feature]);
    onSelectFeature(feature.id);
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

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6">{title}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={addFeature}>
          Add feature
        </Button>
      </Stack>
      <Stack spacing={2}>
        {features.map((feature) => (
          <Card
            key={feature.id}
            variant="outlined"
            sx={{
              borderRadius: 3,
              borderColor: feature.id === selectedFeatureId ? "primary.main" : undefined,
            }}
            onClick={() => onSelectFeature(feature.id)}
          >
            <CardHeader
              title={
                <TextField
                  size="small"
                  label="Feature name"
                  value={feature.name}
                  onChange={(event) =>
                    setFeature(feature.id, (current) => ({ ...current, name: event.target.value }))
                  }
                />
              }
              action={
                <IconButton aria-label="delete feature" onClick={() => removeFeature(feature.id)}>
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
                      <Chip key={tag} label={conceptLabel(tag)} size="small" />
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No taxonomy tags.
                  </Typography>
                )}
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                }}
              >
                {feature.values.map((value, index) => (
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
                            <TextField
                              size="small"
                              label="Value"
                              value={value.value}
                              onChange={(event) =>
                                setFeature(feature.id, (current) => {
                                  const next = [...current.values];
                                  (next[index] as SingleValue).value = event.target.value;
                                  return { ...current, values: next };
                                })
                              }
                            />
                            <FormControl size="small">
                              <InputLabel id={`single-ref-${feature.id}-${index}`}>Reference</InputLabel>
                              <Select
                                labelId={`single-ref-${feature.id}-${index}`}
                                label="Reference"
                                value={value.referenceSystemId ?? ""}
                                onChange={(event) =>
                                  setFeature(feature.id, (current) => {
                                    const next = [...current.values];
                                    (next[index] as SingleValue).referenceSystemId =
                                      event.target.value || undefined;
                                    return { ...current, values: next };
                                  })
                                }
                              >
                                <MenuItem value="">
                                  <em>None</em>
                                </MenuItem>
                                {referenceSystems.map((ref) => (
                                  <MenuItem key={ref.id} value={ref.id}>{`${ref.name} (${ref.type})`}</MenuItem>
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
                              >
                                <MenuItem value="">
                                  <em>None</em>
                                </MenuItem>
                                {referenceSystems.map((ref) => (
                                  <MenuItem key={ref.id} value={ref.id}>{`${ref.name} (${ref.type})`}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Stack>
                        )}
                        {value.kind === "DiscreteSet" && (
                          <Stack spacing={1.5}>
                            <TextField
                              size="small"
                              label="Comma separated values"
                              value={value.values.join(", ")}
                              onChange={(event) => {
                                const values = event.target.value
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
                            <FormControl size="small">
                              <InputLabel id={`set-ref-${feature.id}-${index}`}>Reference</InputLabel>
                              <Select
                                labelId={`set-ref-${feature.id}-${index}`}
                                label="Reference"
                                value={value.referenceSystemId ?? ""}
                                onChange={(event) =>
                                  setFeature(feature.id, (current) => {
                                    const next = [...current.values];
                                    (next[index] as DiscreteSet).referenceSystemId =
                                      event.target.value || undefined;
                                    return { ...current, values: next };
                                  })
                                }
                              >
                                <MenuItem value="">
                                  <em>None</em>
                                </MenuItem>
                                {referenceSystems.map((ref) => (
                                  <MenuItem key={ref.id} value={ref.id}>{`${ref.name} (${ref.type})`}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Stack>
                        )}
                      </Box>
                    </Card>
                ))}
              </Box>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => addValue(feature.id, "SingleValue")}>
                  Add single value
                </Button>
                <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => addValue(feature.id, "ValueRange")}>
                  Add range
                </Button>
                <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => addValue(feature.id, "DiscreteSet")}>
                  Add discrete set
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
        {!features.length && (
          <Box sx={{ p: 4, border: "1px dashed", borderColor: "divider", borderRadius: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              No features yet. Use “Add feature” to start modelling.
            </Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default FeatureEditor;
