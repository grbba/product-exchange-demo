import React, { useEffect, useMemo, useRef, useState } from "react";
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
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import type { Collection, Concept, ProductSchema, ReferenceSystem, SchemaCategory } from "../domain";
import { schemaCategoryLabel, updateTimestamp } from "../domain";
import FeatureEditor from "./FeatureEditor";
import InfoTooltipIcon from "./InfoTooltipIcon";
import { schemaTooltips } from "../tooltipText";

type SchemaWorkspaceProps = {
  categories: SchemaCategory[];
  schemas: ProductSchema[];
  selectedSchemaId: string | null;
  onSelectSchema: (schemaId: string) => void;
  onCreateSchema: (category: SchemaCategory, name: string, description: string) => void;
  onUpdateSchema: (schemaId: string, updater: (schema: ProductSchema) => ProductSchema) => void;
  onDeleteSchema: (schemaId: string) => void;
  onExportSchema: (schema: ProductSchema) => void;
  onTagSchema: (schemaId: string, conceptId: string) => void;
  onRemoveSchemaTag: (schemaId: string, conceptId: string) => void;
  onAssignCollection: (schemaId: string, collectionId: string) => void;
  onRemoveCollection: (schemaId: string, collectionId: string) => void;
  onPersistSchemas: () => void;
  collections: Collection[];
  conceptLabel: (id: string) => string;
  orderedConcepts: Concept[];
  referenceSystems: ReferenceSystem[];
};

const SchemaWorkspace: React.FC<SchemaWorkspaceProps> = ({
  categories,
  schemas,
  selectedSchemaId,
  onSelectSchema,
  onCreateSchema,
  onUpdateSchema,
  onDeleteSchema,
  onExportSchema,
  onTagSchema,
  onRemoveSchemaTag,
  onAssignCollection,
  onRemoveCollection,
  onPersistSchemas,
  collections,
  conceptLabel,
  orderedConcepts,
  referenceSystems,
}) => {
  const selectedSchema = useMemo(
    () => schemas.find((schema) => schema.id === selectedSchemaId) ?? null,
    [schemas, selectedSchemaId]
  );

  const [newSchemaCategory, setNewSchemaCategory] = useState<SchemaCategory>(categories[0] ?? "transport");
  const [newSchemaName, setNewSchemaName] = useState("");
  const [newSchemaDescription, setNewSchemaDescription] = useState("");
  const [conceptSelection, setConceptSelection] = useState("");
  const [collectionSelection, setCollectionSelection] = useState("");
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);

  const lastSchemaId = useRef<string | null>(null);

  useEffect(() => {
    const currentSchemaId = selectedSchema?.id ?? null;
    if (currentSchemaId !== lastSchemaId.current) {
      setSelectedFeatureId(selectedSchema?.featureTemplates[0]?.id ?? null);
      setCollectionSelection("");
    } else if (selectedFeatureId && selectedSchema) {
      const stillExists = selectedSchema.featureTemplates.some((feature) => feature.id === selectedFeatureId);
      if (!stillExists) {
        setSelectedFeatureId(selectedSchema.featureTemplates[0]?.id ?? null);
      }
    }
    lastSchemaId.current = currentSchemaId;
  }, [selectedSchema, selectedFeatureId]);

  const handleCreate = () => {
    const name = newSchemaName.trim();
    if (!name) return;
    onCreateSchema(newSchemaCategory, name, newSchemaDescription.trim());
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

  const handleAssignCollection = () => {
    if (!selectedSchema || !collectionSelection) return;
    onAssignCollection(selectedSchema.id, collectionSelection);
    setCollectionSelection("");
  };

  const availableCollections = selectedSchema
    ? collections.filter((collection) => !selectedSchema.assignedCollections.includes(collection.id))
    : collections;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
        <Box sx={{ flexBasis: { md: "60%" }, flexGrow: 1 }}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardHeader title="Create schema" subheader="Select a product type and provide a name." />
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <InfoTooltipIcon title={schemaTooltips.createSchemaCategory.text} />
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel id="schema-category-label">Product type</InputLabel>
                    <Select
                      labelId="schema-category-label"
                      label="Product type"
                      value={newSchemaCategory}
                      onChange={(event) => setNewSchemaCategory(event.target.value as SchemaCategory)}
                      renderValue={(value) => schemaCategoryLabel(value as SchemaCategory)}
                    >
                      {categories.map((category) => (
                        <MenuItem key={category} value={category} sx={{ textTransform: "capitalize" }}>
                          {schemaCategoryLabel(category)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <InfoTooltipIcon title={schemaTooltips.createSchemaName.text} />
                  <TextField
                    size="small"
                    label="Schema name"
                    value={newSchemaName}
                    onChange={(event) => setNewSchemaName(event.target.value)}
                    fullWidth
                  />
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <InfoTooltipIcon title={schemaTooltips.createSchemaDescription.text} />
                  <TextField
                    size="small"
                    label="Description"
                    value={newSchemaDescription}
                    onChange={(event) => setNewSchemaDescription(event.target.value)}
                    multiline
                    minRows={2}
                    fullWidth
                  />
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <InfoTooltipIcon title={schemaTooltips.createSchemaButton.text} />
                  <Button variant="contained" onClick={handleCreate} disabled={!newSchemaName.trim()}>
                    Create schema
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flexBasis: { md: "40%" }, flexShrink: 0 }}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardHeader title="Schemas" subheader={`${schemas.length} defined`} />
            <CardContent>
              {schemas.length ? (
                <FormControl size="small" fullWidth>
                  <InputLabel id="schema-select-label">Select schema</InputLabel>
                  <Select
                    labelId="schema-select-label"
                    label="Select schema"
                    value={selectedSchemaId ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      onSelectSchema(value ? String(value) : "");
                    }}
                  >
                    <MenuItem value="">
                      <em>— choose —</em>
                    </MenuItem>
                    {schemas.map((schema) => (
                      <MenuItem key={schema.id} value={schema.id}>
                        {schema.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No schemas yet. Create one using the form above.
                </Typography>
              )}
              {selectedSchema && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  Type: {schemaCategoryLabel(selectedSchema.category)}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      </Stack>

      <Divider />

      <Box>
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
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <InfoTooltipIcon title={schemaTooltips.schemaDetailName.text} />
                    <TextField
                      fullWidth
                      size="small"
                      label="Schema name"
                      value={selectedSchema.name}
                      onChange={(event) => updateSchema((schema) => ({ ...schema, name: event.target.value }))}
                    />
                  </Stack>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <InfoTooltipIcon title={schemaTooltips.schemaDetailDescription.text} />
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
                  <Typography variant="body2" color="text.secondary">
                    Product type: <strong>{schemaCategoryLabel(selectedSchema.category)}</strong>
                  </Typography>
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
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flex: 1 }}>
                    <InfoTooltipIcon title={schemaTooltips.schemaDetailAddTag.text} />
                    <FormControl size="small" sx={{ minWidth: 200, flex: 1 }}>
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
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <InfoTooltipIcon title={schemaTooltips.schemaDetailTags.text} />
                    <Button variant="outlined" onClick={handleAddConcept} disabled={!conceptSelection}>
                      Add tag
                    </Button>
                  </Stack>
                </Stack>
                <Divider sx={{ my: 2 }} />
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
                  <InfoTooltipIcon title={schemaTooltips.schemaCollections.text} />
                  <Typography variant="subtitle2">Collections</Typography>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 2 }}>
                  {selectedSchema.assignedCollections.length ? (
                    selectedSchema.assignedCollections.map((collectionId) => {
                      const collection = collections.find((item) => item.id === collectionId);
                      const label = collection?.label ?? collectionId;
                      return (
                        <Chip
                          key={collectionId}
                          label={label}
                          onDelete={() => onRemoveCollection(selectedSchema.id, collectionId)}
                          size="small"
                        />
                      );
                    })
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No collections assigned.
                    </Typography>
                  )}
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-end" sx={{ mt: 1.5 }}>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flex: 1 }}>
                    <InfoTooltipIcon title={schemaTooltips.schemaAssignCollection.text} />
                    <FormControl size="small" sx={{ minWidth: 200, flex: 1 }}>
                      <InputLabel id="schema-collection-select">Assign collection</InputLabel>
                      <Select
                        labelId="schema-collection-select"
                        label="Assign collection"
                        value={collectionSelection}
                        onChange={(event) => setCollectionSelection(event.target.value)}
                      >
                        <MenuItem value="">
                          <em>— choose —</em>
                        </MenuItem>
                        {availableCollections.map((collection) => (
                          <MenuItem key={collection.id} value={collection.id}>
                            {collection.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <InfoTooltipIcon title={schemaTooltips.schemaAssignCollection.text} />
                    <Button variant="outlined" onClick={handleAssignCollection} disabled={!collectionSelection}>
                      Assign collection
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <FeatureEditor
              title="Schema features"
              addButtonTooltip={schemaTooltips.addFeatureButton.text}
              features={selectedSchema.featureTemplates}
              selectedFeatureId={selectedFeatureId}
              onSelectFeature={setSelectedFeatureId}
              onChange={handleFeaturesChange}
              conceptLabel={conceptLabel}
              referenceSystems={referenceSystems}
              conceptOptions={orderedConcepts}
              splitView
              showRequirementToggle
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
