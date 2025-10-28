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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import SaveIcon from "@mui/icons-material/Save";
import type {
  Concept,
  Partner,
  PartnerProductMap,
  ProductInstance,
  ProductSchema,
  ReferenceSystem,
} from "../domain";
import { updateTimestamp } from "../domain";
import FeatureEditor from "./FeatureEditor";
import DiagramCard from "./DiagramCard";

type ProductWorkspaceProps = {
  schemas: ProductSchema[];
  instances: ProductInstance[];
  selectedSchemaId: string | null;
  onSelectSchema: (schemaId: string) => void;
  selectedInstanceId: string | null;
  onSelectInstance: (instanceId: string) => void;
  onInstantiate: (schemaId: string, name: string) => void;
  onUpdateInstance: (instanceId: string, updater: (instance: ProductInstance) => ProductInstance) => void;
  onDeleteInstance: (instanceId: string) => void;
  onExportInstance: (instance: ProductInstance) => void;
  onPersistInstances: () => void;
  onTagProduct: (instanceId: string, conceptId: string) => void;
  onRemoveProductTag: (instanceId: string, conceptId: string) => void;
  retailerPartners: Partner[];
  partnerAssociations: PartnerProductMap;
  conceptLabel: (id: string) => string;
  orderedConcepts: Concept[];
  referenceSystems: ReferenceSystem[];
};

const ProductWorkspace: React.FC<ProductWorkspaceProps> = ({
  schemas,
  instances,
  selectedSchemaId,
  onSelectSchema,
  selectedInstanceId,
  onSelectInstance,
  onInstantiate,
  onUpdateInstance,
  onDeleteInstance,
  onExportInstance,
  onPersistInstances,
  onTagProduct,
  onRemoveProductTag,
  retailerPartners,
  partnerAssociations,
  conceptLabel,
  orderedConcepts,
  referenceSystems,
}) => {
  const [newProductName, setNewProductName] = useState("");
  const [conceptSelection, setConceptSelection] = useState("");
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);

  const selectedSchema = useMemo(
    () => schemas.find((schema) => schema.id === selectedSchemaId) ?? null,
    [schemas, selectedSchemaId]
  );
  const filteredInstances = useMemo(
    () => instances.filter((instance) => instance.schemaId === selectedSchemaId),
    [instances, selectedSchemaId]
  );
  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedInstanceId) ?? null,
    [instances, selectedInstanceId]
  );

  const assignedRetailPartners = useMemo(() => {
    if (!selectedInstance) return [];
    return retailerPartners.filter((partner) =>
      (partnerAssociations[partner.id] ?? []).includes(selectedInstance.id)
    );
  }, [partnerAssociations, retailerPartners, selectedInstance]);

  useEffect(() => {
    setSelectedFeatureId(selectedInstance?.product.features[0]?.id ?? null);
  }, [selectedInstance]);

  const handleInstantiate = () => {
    if (!selectedSchema) return;
    const name = newProductName.trim() || `${selectedSchema.name} product`;
    onInstantiate(selectedSchema.id, name);
    setNewProductName("");
  };

  const handleProductFieldChange = <K extends keyof ProductInstance["product"]>(
    field: K,
    value: ProductInstance["product"][K]
  ) => {
    if (!selectedInstance) return;
    onUpdateInstance(selectedInstance.id, (instance) =>
      updateTimestamp({
        ...instance,
        product: { ...instance.product, [field]: value },
      })
    );
  };

  const handleFeaturesChange = (features: ProductInstance["product"]["features"]) => {
    if (!selectedInstance) return;
    onUpdateInstance(selectedInstance.id, (instance) =>
      updateTimestamp({
        ...instance,
        product: { ...instance.product, features },
      })
    );
  };

  const handleAddTag = () => {
    if (!selectedInstance || !conceptSelection) return;
    onTagProduct(selectedInstance.id, conceptSelection);
    setConceptSelection("");
  };

  const handleAddFeatureTag = (featureId: string, conceptId: string) => {
    if (!selectedInstance) return;
    onUpdateInstance(selectedInstance.id, (instance) => {
      const features = instance.product.features.map((feature) =>
        feature.id === featureId && !feature.tags.includes(conceptId)
          ? { ...feature, tags: [...feature.tags, conceptId] }
          : feature
      );
      return updateTimestamp({ ...instance, product: { ...instance.product, features } });
    });
  };

  const handleRemoveFeatureTag = (featureId: string, tagId: string) => {
    if (!selectedInstance) return;
    onUpdateInstance(selectedInstance.id, (instance) => {
      const features = instance.product.features.map((feature) =>
        feature.id === featureId ? { ...feature, tags: feature.tags.filter((tag) => tag !== tagId) } : feature
      );
      return updateTimestamp({ ...instance, product: { ...instance.product, features } });
    });
  };

  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
      <Box sx={{ flexBasis: { md: "30%" }, flexShrink: 0 }}>
        <Card variant="outlined" sx={{ borderRadius: 3, mb: 3 }}>
          <CardHeader title="Select schema" subheader="Choose a schema to instantiate products." />
          <CardContent>
            <List dense disablePadding>
              {schemas.map((schema) => (
                <ListItem key={schema.id} disablePadding>
                  <ListItemButton
                    selected={schema.id === selectedSchemaId}
                    onClick={() => onSelectSchema(schema.id)}
                    sx={{ borderRadius: 2, mb: 0.5 }}
                  >
                    <ListItemText primary={schema.name} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
            {!schemas.length && (
              <Typography variant="body2" color="text.secondary">
                Define a product schema before creating specified products.
              </Typography>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderRadius: 3, mb: 3 }}>
          <CardHeader title="Instantiate product" />
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                {selectedSchema
                  ? `Create a product instance from '${selectedSchema.name}'.`
                  : "Select a schema to instantiate products."}
              </Typography>
              <TextField
                size="small"
                label="Product name"
                value={newProductName}
                onChange={(event) => setNewProductName(event.target.value)}
                disabled={!selectedSchema}
              />
              <Button variant="contained" onClick={handleInstantiate} disabled={!selectedSchema}>
                Create product
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardHeader
            title="Products"
            subheader={selectedSchema ? `${filteredInstances.length} for schema` : undefined}
          />
          <CardContent>
            <List dense disablePadding>
              {filteredInstances.map((instance) => (
                <ListItem key={instance.id} disablePadding>
                  <ListItemButton
                    selected={instance.id === selectedInstanceId}
                    onClick={() => onSelectInstance(instance.id)}
                    sx={{ borderRadius: 2, mb: 0.5 }}
                  >
                    <ListItemText primary={instance.product.name} secondary={instance.product.type} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
            {!filteredInstances.length && (
              <Typography variant="body2" color="text.secondary">
                No products instantiated for this schema yet.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ flex: 1 }}>
        {selectedInstance && selectedSchema ? (
          <Stack spacing={3}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardHeader
                title={selectedInstance.product.name}
                action={
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => onExportInstance(selectedInstance)}>
                      Export
                    </Button>
                    <Button variant="outlined" startIcon={<SaveIcon />} onClick={onPersistInstances}>
                      Save
                    </Button>
                    <IconButton color="error" onClick={() => onDeleteInstance(selectedInstance.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                }
              />
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Product name"
                      value={selectedInstance.product.name}
                      onChange={(event) => handleProductFieldChange("name", event.target.value)}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label="Product type"
                      value={selectedInstance.product.type ?? ""}
                      onChange={(event) => handleProductFieldChange("type", event.target.value)}
                    />
                  </Stack>
                  <ToggleButtonGroup
                    size="small"
                    value={selectedInstance.product.lifecycleStatus}
                    exclusive
                    onChange={(_, value) => value && handleProductFieldChange("lifecycleStatus", value)}
                  >
                    <ToggleButton value="Draft">Draft</ToggleButton>
                    <ToggleButton value="Active">Active</ToggleButton>
                    <ToggleButton value="EndOfLife">End-of-life</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
                <Divider sx={{ my: 2 }} />
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Taxonomy tags
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 2 }}>
                      {selectedInstance.product.tags.map((tag) => (
                        <Chip
                          key={tag}
                          label={conceptLabel(tag)}
                          onDelete={() => onRemoveProductTag(selectedInstance.id, tag)}
                          size="small"
                        />
                      ))}
                      {!selectedInstance.product.tags.length && (
                        <Typography variant="body2" color="text.secondary">
                          No product-level tags.
                        </Typography>
                      )}
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-end">
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel id="product-tag-select">Assign taxonomy concept</InputLabel>
                        <Select
                          labelId="product-tag-select"
                          label="Assign taxonomy concept"
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
                      <Button variant="outlined" onClick={handleAddTag} disabled={!conceptSelection}>
                        Add tag
                      </Button>
                    </Stack>
                  </Box>

                  <Box
                    sx={{
                      flex: 1,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      p: 2,
                      bgcolor: "background.default",
                    }}
                  >
                    <Typography variant="subtitle2" gutterBottom>
                      Retail partners with access
                    </Typography>
                    {assignedRetailPartners.length ? (
                      <List dense disablePadding>
                        {assignedRetailPartners.map((partner) => (
                          <ListItem key={partner.id} disablePadding sx={{ py: 0.5 }}>
                            <ListItemText primary={partner.name} secondary={`ID: ${partner.externalId}`} />
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No retail partners associated with this product.
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
                      Manage access under the Partners tab.
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <FeatureEditor
              title="Product features"
              features={selectedInstance.product.features}
              selectedFeatureId={selectedFeatureId}
              onSelectFeature={setSelectedFeatureId}
              onChange={handleFeaturesChange}
              conceptLabel={conceptLabel}
              referenceSystems={referenceSystems}
              conceptOptions={orderedConcepts}
              onAddTag={handleAddFeatureTag}
              onRemoveTag={handleRemoveFeatureTag}
            />

            <DiagramCard
              title="Product diagram"
              subtitle={`${selectedInstance.product.name} • based on ${selectedSchema.name}`}
              features={selectedInstance.product.features}
              conceptLabel={conceptLabel}
            />
          </Stack>
        ) : (
          <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 3, p: 4 }}>
            <Typography variant="h6" gutterBottom>
              Select a product to configure
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Choose a schema and instantiate a product. You can then edit its features, tags, and lifecycle status before exporting it.
            </Typography>
          </Box>
        )}
      </Box>
    </Stack>
  );
};

export default ProductWorkspace;
