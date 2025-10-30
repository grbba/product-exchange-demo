import React, { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import type {
  Concept,
  ReferenceSource,
  ReferenceSystem,
  ReferenceSystemCardinality,
  ReferenceSystemDraft,
  ReferenceSystemType,
  TaxonomyConceptSetReference,
} from "../domain";
import { createExternalReferenceSource, createTaxonomyReferenceSource } from "../domain";

const isTaxonomySource = (source: ReferenceSource): source is TaxonomyConceptSetReference =>
  source.kind === "Internal" && source.repositoryType === "TaxonomyConceptSet";

type ReferenceSystemWorkspaceProps = {
  referenceSystems: ReferenceSystem[];
  systemTypes: ReferenceSystemType[];
  concepts: Concept[];
  conceptLabel: (id: string) => string;
  onCreate: (input: ReferenceSystemDraft) => string;
  onUpdate: (referenceSystemId: string, updater: (referenceSystem: ReferenceSystem) => ReferenceSystem) => void;
  onDelete: (referenceSystemId: string) => void;
};

const createDraft = (): ReferenceSystemDraft => ({
  identifier: "",
  description: "",
  systemType: "Other",
  cardinality: "single",
  source: createExternalReferenceSource(),
});

const ReferenceSystemWorkspace: React.FC<ReferenceSystemWorkspaceProps> = ({
  referenceSystems,
  systemTypes,
  concepts,
  conceptLabel,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(referenceSystems[0]?.id ?? null);

  useEffect(() => {
    if (!referenceSystems.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      if (current && referenceSystems.some((system) => system.id === current)) return current;
      return referenceSystems[0].id;
    });
  }, [referenceSystems]);

  const selectedSystem = useMemo(
    () => referenceSystems.find((system) => system.id === selectedId) ?? null,
    [referenceSystems, selectedId]
  );

  const conceptById = useMemo(() => new Map(concepts.map((concept) => [concept.id, concept])), [concepts]);

  const taxonomySource = selectedSystem && isTaxonomySource(selectedSystem.source) ? selectedSystem.source : null;
  const previewConcepts = useMemo(() => {
    if (!taxonomySource || !taxonomySource.anchorConceptIds.length) return [] as Concept[];
    const anchors = taxonomySource.anchorConceptIds
      .map((id) => conceptById.get(id))
      .filter((item): item is Concept => Boolean(item));
    if (!anchors.length) return [] as Concept[];

    const sortConcepts = (concepts: Concept[]) =>
      concepts.sort((a, b) => conceptLabel(a.id).localeCompare(conceptLabel(b.id)));

    if (taxonomySource.closurePolicy === "individual") {
      return sortConcepts([...anchors]);
    }

    if (taxonomySource.closurePolicy === "direct") {
      const children = new Map<string, Concept>();
      for (const anchor of anchors) {
        for (const childId of anchor.narrower ?? []) {
          const child = conceptById.get(childId);
          if (child) children.set(child.id, child);
        }
      }
      return sortConcepts(Array.from(children.values()));
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
        if (child && !visited.has(child.id)) queue.push(child);
      }
    }

    return sortConcepts(Array.from(collected.values()));
  }, [taxonomySource, conceptById, conceptLabel]);

  const updateSelected = (updater: (referenceSystem: ReferenceSystem) => ReferenceSystem) => {
    if (!selectedSystem) return;
    onUpdate(selectedSystem.id, updater);
  };

  const updateSource = (updater: (source: ReferenceSource) => ReferenceSource) => {
    updateSelected((current) => ({
      ...current,
      source: updater(current.source),
    }));
  };

  const handleCreate = () => {
    const newId = onCreate(createDraft());
    setSelectedId(newId);
  };

  const handleDelete = () => {
    if (!selectedSystem) return;
    onDelete(selectedSystem.id);
  };

  return (
    <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
      <Box
        sx={{
          flexBasis: { lg: "28%" },
          flexShrink: 0,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          p: 2,
          minWidth: { lg: 260 },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6">Reference systems</Typography>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleCreate}>
            New
          </Button>
        </Stack>
        {referenceSystems.length ? (
          <List dense disablePadding>
            {referenceSystems.map((system) => (
              <ListItemButton
                key={system.id}
                selected={system.id === selectedId}
                onClick={() => setSelectedId(system.id)}
                sx={{ borderRadius: 2, mb: 0.5 }}
              >
                <ListItemText
                  primary={system.identifier || "Untitled reference system"}
                  secondary={system.systemType}
                />
              </ListItemButton>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No reference systems yet. Create one to begin defining sources used for validation.
          </Typography>
        )}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {selectedSystem ? (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardHeader
              title="Reference system details"
              subheader={`Last updated ${new Date(selectedSystem.updatedAt).toLocaleString()}`}
              action={
                <IconButton color="error" onClick={handleDelete} aria-label="Delete reference system">
                  <DeleteIcon />
                </IconButton>
              }
            />
            <CardContent>
              <Stack spacing={2.5}>
                <Stack spacing={1.5}>
                  <TextField
                    label="Identifier"
                    value={selectedSystem.identifier}
                    onChange={(event) =>
                      updateSelected((current) => ({ ...current, identifier: event.target.value }))
                    }
                    fullWidth
                  />
                  <TextField
                    label="Description"
                    value={selectedSystem.description}
                    onChange={(event) =>
                      updateSelected((current) => ({ ...current, description: event.target.value }))
                    }
                    multiline
                    minRows={3}
                    fullWidth
                  />
                  <FormControl fullWidth>
                    <InputLabel id="reference-system-type-select">System type</InputLabel>
                    <Select
                      labelId="reference-system-type-select"
                      label="System type"
                      value={selectedSystem.systemType}
                      onChange={(event) =>
                        updateSelected((current) => ({
                          ...current,
                          systemType: event.target.value as ReferenceSystemType,
                        }))
                      }
                    >
                      {systemTypes.map((type) => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel id="reference-system-cardinality-select">Cardinality</InputLabel>
                    <Select
                      labelId="reference-system-cardinality-select"
                      label="Cardinality"
                      value={selectedSystem.cardinality}
                      onChange={(event) =>
                        updateSelected((current) => ({
                          ...current,
                          cardinality: event.target.value as ReferenceSystemCardinality,
                        }))
                      }
                    >
                      <MenuItem value="single">Single value</MenuItem>
                      <MenuItem value="multiple">Multiple values</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>

                <Divider />

                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle1">Reference source</Typography>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={selectedSystem.source.kind}
                      onChange={(_, value) => {
                        if (!value) return;
                        if (value === "External") {
                          updateSource((current) => {
                            const base = {
                              authority: current.authority,
                              resourceName: current.resourceName,
                              resourceType: current.resourceType,
                            };
                            const next = createExternalReferenceSource();
                            return {
                              ...next,
                              ...base,
                              url: current.kind === "External" ? current.url : "",
                            };
                          });
                          return;
                        }
                        updateSource((current) => {
                          const base = {
                            authority: current.authority,
                            resourceName: current.resourceName,
                            resourceType: current.resourceType || "Taxonomy",
                          };
                          if (isTaxonomySource(current)) {
                            return { ...current, ...base };
                          }
                          const next = createTaxonomyReferenceSource();
                          return { ...next, ...base };
                        });
                      }}
                    >
                      <ToggleButton value="External">External</ToggleButton>
                      <ToggleButton value="Internal">Internal</ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>

                  <TextField
                    label="Authority"
                    value={selectedSystem.source.authority}
                    onChange={(event) =>
                      updateSource((current) => ({ ...current, authority: event.target.value }))
                    }
                    fullWidth
                  />
                  <TextField
                    label="Resource name"
                    value={selectedSystem.source.resourceName}
                    onChange={(event) =>
                      updateSource((current) => ({ ...current, resourceName: event.target.value }))
                    }
                    fullWidth
                  />
                  <TextField
                    label="Resource type"
                    value={selectedSystem.source.resourceType}
                    onChange={(event) =>
                      updateSource((current) => ({ ...current, resourceType: event.target.value }))
                    }
                    fullWidth
                  />

                  {selectedSystem.source.kind === "External" ? (
                    <TextField
                      label="URL"
                      value={selectedSystem.source.url}
                      onChange={(event) =>
                        updateSource((current) =>
                          current.kind === "External" ? { ...current, url: event.target.value } : current
                        )
                      }
                      fullWidth
                    />
                  ) : (
                    <Stack spacing={1.5}>
                      {taxonomySource ? (
                        <Stack spacing={1.5}>
                          <Autocomplete
                            multiple
                            options={concepts}
                            value={taxonomySource.anchorConceptIds
                              .map((id) => conceptById.get(id))
                              .filter((concept): concept is Concept => Boolean(concept))}
                            onChange={(_, values) =>
                              updateSource((current) =>
                                isTaxonomySource(current)
                                  ? { ...current, anchorConceptIds: values.map((concept) => concept.id) }
                                  : current
                              )
                            }
                            getOptionLabel={(option) => conceptLabel(option.id)}
                            renderInput={(params) => (
                              <TextField {...params} label="Selected concepts" placeholder="Choose one or more concepts" />
                            )}
                          />
                          <FormControl fullWidth>
                            <InputLabel id="closure-policy-select">Closure policy</InputLabel>
                            <Select
                              labelId="closure-policy-select"
                              label="Closure policy"
                              value={taxonomySource.closurePolicy}
                              onChange={(event) =>
                                updateSource((current) =>
                                  isTaxonomySource(current)
                                    ? { ...current, closurePolicy: event.target.value as TaxonomyConceptSetReference["closurePolicy"] }
                                    : current
                                )
                              }
                            >
                              <MenuItem value="individual">Selected concepts only</MenuItem>
                              <MenuItem value="direct">Direct children of selected concepts</MenuItem>
                              <MenuItem value="with_descendants">Selected concepts and descendants</MenuItem>
                              <MenuItem value="transitive_closure">Transitive closure</MenuItem>
                            </Select>
                          </FormControl>
                          {previewConcepts.length ? (
                            <Box>
                              <Typography variant="subtitle2">Previewed reference values ({previewConcepts.length})</Typography>
                              <List
                                dense
                                sx={{ maxHeight: 160, overflow: "auto", border: 1, borderColor: "divider", borderRadius: 1, mt: 1 }}
                              >
                                {previewConcepts.map((concept) => (
                                  <ListItemButton key={concept.id} disableRipple>
                                    <ListItemText primary={conceptLabel(concept.id)} />
                                  </ListItemButton>
                                ))}
                              </List>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Select concepts to preview available values.
                            </Typography>
                          )}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Unsupported internal reference type.
                        </Typography>
                      )}
                    </Stack>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
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
              Select or create a reference system to edit its configuration.
            </Typography>
          </Box>
        )}
      </Box>
    </Stack>
  );
};

export default ReferenceSystemWorkspace;
