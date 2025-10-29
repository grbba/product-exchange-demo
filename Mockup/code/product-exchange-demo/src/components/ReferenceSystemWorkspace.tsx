import React, { useEffect, useMemo, useState } from "react";
import {
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
  ExternalReferenceSource,
  InternalReferenceSource,
  ReferenceSystem,
  ReferenceSystemDraft,
  ReferenceSystemType,
} from "../domain";

type ReferenceSystemWorkspaceProps = {
  referenceSystems: ReferenceSystem[];
  systemTypes: ReferenceSystemType[];
  onCreate: (input: ReferenceSystemDraft) => string;
  onUpdate: (referenceSystemId: string, updater: (referenceSystem: ReferenceSystem) => ReferenceSystem) => void;
  onDelete: (referenceSystemId: string) => void;
};

const createDraft = (): ReferenceSystemDraft => ({
  identifier: "",
  description: "",
  systemType: "Other",
  source: {
    kind: "External",
    authority: "",
    resourceName: "",
    resourceType: "",
    url: "",
  },
});

const ReferenceSystemWorkspace: React.FC<ReferenceSystemWorkspaceProps> = ({
  referenceSystems,
  systemTypes,
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

  const updateSelected = (updater: (referenceSystem: ReferenceSystem) => ReferenceSystem) => {
    if (!selectedSystem) return;
    onUpdate(selectedSystem.id, updater);
  };

  const updateSource = (
    updater: (
      source: ReferenceSystem["source"]
    ) => ExternalReferenceSource | InternalReferenceSource
  ) => {
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
                        updateSource((current) => {
                          const base = {
                            authority: current.authority,
                            resourceName: current.resourceName,
                            resourceType: current.resourceType,
                          };
                          if (value === "External") {
                            return {
                              kind: "External",
                              ...base,
                              url: current.kind === "External" ? current.url : "",
                            };
                          }
                          return {
                            kind: "Internal",
                            ...base,
                            repositoryName: current.kind === "Internal" ? current.repositoryName : "",
                            version: current.kind === "Internal" ? current.version : "",
                          };
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
                      <TextField
                        label="Repository name"
                        value={selectedSystem.source.repositoryName}
                        onChange={(event) =>
                          updateSource((current) =>
                            current.kind === "Internal"
                              ? { ...current, repositoryName: event.target.value }
                              : current
                          )
                        }
                        fullWidth
                      />
                      <TextField
                        label="Version"
                        value={selectedSystem.source.version}
                        onChange={(event) =>
                          updateSource((current) =>
                            current.kind === "Internal" ? { ...current, version: event.target.value } : current
                          )
                        }
                        fullWidth
                      />
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
