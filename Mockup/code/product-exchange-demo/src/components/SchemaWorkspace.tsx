import React, { useEffect, useMemo, useState } from "react";
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
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import SaveIcon from "@mui/icons-material/Save";
import type { Concept, MetamodelAsset, ProductSchema, ReferenceSystem } from "../domain";
import { updateTimestamp } from "../domain";
import FeatureEditor from "./FeatureEditor";
import DiagramCard from "./DiagramCard";

type SchemaWorkspaceProps = {
  assets: MetamodelAsset[];
  schemas: ProductSchema[];
  selectedSchemaId: string | null;
  onSelectSchema: (schemaId: string) => void;
  onCreateSchema: (assetId: string, name: string, description: string) => void;
  onUpdateSchema: (schemaId: string, updater: (schema: ProductSchema) => ProductSchema) => void;
  onDeleteSchema: (schemaId: string) => void;
  onExportSchema: (schema: ProductSchema) => void;
  onPersistSchemas: () => void;
  onTagSchema: (schemaId: string, conceptId: string) => void;
  onRemoveSchemaTag: (schemaId: string, conceptId: string) => void;
  conceptLabel: (id: string) => string;
  orderedConcepts: Concept[];
  referenceSystems: ReferenceSystem[];
};

const SchemaWorkspace: React.FC<SchemaWorkspaceProps> = ({
  assets,
  schemas,
  selectedSchemaId,
  onSelectSchema,
  onCreateSchema,
  onUpdateSchema,
  onDeleteSchema,
  onExportSchema,
  onPersistSchemas,
  onTagSchema,
  onRemoveSchemaTag,
  conceptLabel,
  orderedConcepts,
  referenceSystems,
}) => {
  const selectedSchema = useMemo(
    () => schemas.find((schema) => schema.id === selectedSchemaId) ?? null,
    [schemas, selectedSchemaId]
  );

  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  useEffect(() => {
    setSelectedFeatureId(selectedSchema?.featureTemplates[0]?.id ?? null);
  }, [selectedSchema]);

  const [newSchemaAssetId, setNewSchemaAssetId] = useState<string>(() => assets[0]?.id ?? "");
  const [newSchemaName, setNewSchemaName] = useState("");
  const [newSchemaDescription, setNewSchemaDescription] = useState("");
  const [conceptSelection, setConceptSelection] = useState("");

  const handleCreate = () => {
    const name = newSchemaName.trim();
    if (!name || !newSchemaAssetId) return;
    onCreateSchema(newSchemaAssetId, name, newSchemaDescription.trim());
    setNewSchemaName("");
    setNewSchemaDescription("");
  };

  const updateSchema = (updater: (schema: ProductSchema) => ProductSchema) => {
    if (!selectedSchema) return;
    onUpdateSchema(selectedSchema.id, (schema) => updateTimestamp(updater(schema)));
  };

  const handleAddConcept = () => {
    if (!selectedSchema || !conceptSelection) return;
    onTagSchema(selectedSchema.id, conceptSelection);
    setConceptSelection("");
  };

  const handleFeaturesChange = (features: ProductSchema["featureTemplates"]) => {
    updateSchema((schema) => ({ ...schema, featureTemplates: features }));
  };

  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
      <Box sx={{ flexBasis: { md: "30%" }, flexShrink: 0 }}>
        <Card variant="outlined" sx={{ borderRadius: 3, mb: 3 }}>
          <CardHeader title="Create schema" subheader="Choose a metamodel asset and provide a name." />
          <CardContent>
            <Stack spacing={1.5}>
              <FormControl size="small">
                <InputLabel id="schema-asset-label">Base metamodel</InputLabel>
                <Select
                  labelId="schema-asset-label"
                  label="Base metamodel"
                  value={newSchemaAssetId}
                  onChange={(event) => setNewSchemaAssetId(event.target.value)}
                >
                  {assets.map((asset) => (
                    <MenuItem key={asset.id} value={asset.id}>
                      {asset.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Schema name"
                value={newSchemaName}
                onChange={(event) => setNewSchemaName(event.target.value)}
              />
              <TextField
                size="small"
                label="Description"
                value={newSchemaDescription}
                onChange={(event) => setNewSchemaDescription(event.target.value)}
                multiline
                minRows={2}
              />
              <Button variant="contained" onClick={handleCreate} disabled={!newSchemaName.trim()}>
                Create schema
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardHeader title="Schemas" subheader={`${schemas.length} defined`} />
          <CardContent>
            <List dense disablePadding>
              {schemas.map((schema) => (
                <ListItem key={schema.id} disablePadding>
                  <ListItemButton
                    selected={schema.id === selectedSchemaId}
                    onClick={() => onSelectSchema(schema.id)}
                    sx={{ borderRadius: 2, mb: 0.5 }}
                  >
                    <ListItemText
                      primary={schema.name}
                      secondary={assets.find((asset) => asset.id === schema.baseAssetId)?.name ?? schema.baseAssetId}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
            {!schemas.length && (
              <Typography variant="body2" color="text.secondary">
                No schemas yet. Create one using the form above.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ flex: 1 }}>
        {selectedSchema ? (
          <Stack spacing={3}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardHeader
                title="Schema details"
                action={
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => onExportSchema(selectedSchema)}>
                      Export
                    </Button>
                    <Button variant="outlined" startIcon={<SaveIcon />} onClick={onPersistSchemas}>
                      Save
                    </Button>
                    <IconButton color="error" onClick={() => onDeleteSchema(selectedSchema.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                }
              />
              <CardContent>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Schema name"
                    value={selectedSchema.name}
                    onChange={(event) => updateSchema((schema) => ({ ...schema, name: event.target.value }))}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Description"
                    value={selectedSchema.description ?? ""}
                    multiline
                    minRows={3}
                    onChange={(event) => updateSchema((schema) => ({ ...schema, description: event.target.value }))}
                  />
                </Stack>
                <Divider sx={{ my: 2 }} />
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 2 }}>
                  {selectedSchema.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={conceptLabel(tag)}
                      onDelete={() => onRemoveSchemaTag(selectedSchema.id, tag)}
                      size="small"
                    />
                  ))}
                  {!selectedSchema.tags.length && (
                    <Typography variant="body2" color="text.secondary">
                      No taxonomy tags yet.
                    </Typography>
                  )}
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-end">
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel id="schema-tag-select">Add taxonomy concept</InputLabel>
                    <Select
                      labelId="schema-tag-select"
                      label="Add taxonomy concept"
                      value={conceptSelection}
                      onChange={(event) => setConceptSelection(event.target.value)}
                    >
                      <MenuItem value="">
                        <em>— choose —</em>
                      </MenuItem>
                      {orderedConcepts.map((concept) => (
                        <MenuItem key={concept.id} value={concept.id}>
                          {concept.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button variant="outlined" onClick={handleAddConcept} disabled={!conceptSelection}>
                    Add tag
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <FeatureEditor
              title="Feature templates"
              features={selectedSchema.featureTemplates}
              selectedFeatureId={selectedFeatureId}
              onSelectFeature={setSelectedFeatureId}
              onChange={handleFeaturesChange}
              conceptLabel={conceptLabel}
              referenceSystems={referenceSystems}
            />

            <DiagramCard
              title="Schema diagram"
              subtitle={selectedSchema.name}
              features={selectedSchema.featureTemplates}
              conceptLabel={conceptLabel}
            />
          </Stack>
        ) : (
          <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 3, p: 4 }}>
            <Typography variant="h6" gutterBottom>
              Select a schema to configure
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create a schema or choose an existing one from the list to start defining features and taxonomy tags.
            </Typography>
          </Box>
        )}
      </Box>
    </Stack>
  );
};

export default SchemaWorkspace;
