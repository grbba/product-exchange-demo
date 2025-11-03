import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import type { AlertColor } from "@mui/material";
import UploadIcon from "@mui/icons-material/Upload";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import type { Collection, Concept } from "../domain";
import { parseTtl } from "../taxonomy";

type TaxonomyWorkspaceProps = {
  concepts: Concept[];
  setConcepts: (concepts: Concept[]) => void;
  collections: Collection[];
  setCollections: (collections: Collection[]) => void;
  conceptLabel: (id: string) => string;
  onNotify: (message: string, severity?: AlertColor) => void;
};

type TreeData = {
  roots: string[];
  children: Map<string, string[]>;
  defaultExpanded: string[];
};

const buildTree = (concepts: Concept[], conceptById: Map<string, Concept>): TreeData => {
  const children = new Map<string, string[]>();
  const childSet = new Set<string>();

  for (const concept of concepts) {
    for (const parentId of concept.broader ?? []) {
      const siblings = children.get(parentId) ?? [];
      siblings.push(concept.id);
      children.set(parentId, siblings);
      childSet.add(concept.id);
    }
  }

  for (const [parentId, list] of children) {
    const filtered = list.filter((childId) => conceptById.has(childId));
    filtered.sort((a, b) => (conceptById.get(a)?.label ?? a).localeCompare(conceptById.get(b)?.label ?? b));
    children.set(parentId, filtered);
  }

  let roots = concepts
    .filter((concept) => !(concept.broader && concept.broader.length))
    .map((concept) => concept.id);

  if (!roots.length) {
    const candidates = new Set(concepts.map((concept) => concept.id));
    for (const child of childSet) {
      candidates.delete(child);
    }
    roots = Array.from(candidates);
  }

  const filteredRoots = roots.filter((id) => conceptById.has(id));
  filteredRoots.sort((a, b) => (conceptById.get(a)?.label ?? a).localeCompare(conceptById.get(b)?.label ?? b));

  return {
    roots: filteredRoots,
    children,
    defaultExpanded: [],
  };
};

const formatConceptLabels = (conceptIds: string[] | undefined, conceptLabel: (id: string) => string) =>
  conceptIds?.map((id) => conceptLabel(id)) ?? [];

const TaxonomyWorkspace: React.FC<TaxonomyWorkspaceProps> = ({
  concepts,
  setConcepts,
  collections,
  setCollections,
  conceptLabel,
  onNotify,
}) => {
  const conceptById = useMemo(() => new Map(concepts.map((concept) => [concept.id, concept])), [concepts]);
  const [selectedId, setSelectedId] = useState<string | null>(concepts[0]?.id ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedId && !conceptById.has(selectedId)) {
      setSelectedId(concepts[0]?.id ?? null);
    }
  }, [concepts, conceptById, selectedId]);

  const tree = useMemo(() => buildTree(concepts, conceptById), [concepts, conceptById]);

  const renderNode = (id: string): React.ReactNode => {
    const concept = conceptById.get(id);
    if (!concept) return null;
    const childIds = tree.children.get(id) ?? [];
    return (
      <TreeItem key={id} itemId={id} label={concept.label}>
        {childIds.map((childId) => renderNode(childId))}
      </TreeItem>
    );
  };

  const handleTriggerImport = () => {
    inputRef.current?.click();
  };

  const handleImport: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseTtl(text);
      if (!parsed.concepts.length) {
        onNotify(`No concepts found in '${file.name}'`, "warning");
        return;
      }
      setConcepts(parsed.concepts);
      if (parsed.collections.length) {
        setCollections(parsed.collections);
      }
      setSelectedId(parsed.concepts[0]?.id ?? null);
      onNotify(`Imported ${parsed.concepts.length} concepts`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onNotify(`Failed to import taxonomy: ${message}`, "error");
    } finally {
      event.target.value = "";
    }
  };

  const selectedConcept = selectedId ? conceptById.get(selectedId) ?? null : null;
  const broaderLabels = selectedConcept ? formatConceptLabels(selectedConcept.broader, conceptLabel) : [];
  const narrowerLabels = selectedConcept ? formatConceptLabels(selectedConcept.narrower, conceptLabel) : [];
  const relatedLabels = selectedConcept ? formatConceptLabels(selectedConcept.related, conceptLabel) : [];
  const selectedCollections = useMemo(
    () => (selectedId ? collections.filter((collection) => collection.members.includes(selectedId)) : []),
    [collections, selectedId]
  );

  return (
    <Stack spacing={3} sx={{ height: "100%" }}>
      <Box>
        <input
          ref={inputRef}
          type="file"
          accept=".ttl"
          style={{ display: "none" }}
          onChange={handleImport}
        />
        <Button variant="outlined" startIcon={<UploadIcon />} onClick={handleTriggerImport}>
          Import SKOS TTL
        </Button>
      </Box>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="stretch">
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardHeader title="Concept hierarchy" subheader={`${concepts.length} concepts`} />
          <CardContent sx={{ maxHeight: 520, overflow: "auto" }}>
            {concepts.length ? (
              <SimpleTreeView
                key={tree.roots.join("|")}
                aria-label="taxonomy tree"
                selectedItems={selectedId ?? null}
                defaultExpandedItems={tree.defaultExpanded}
                onSelectedItemsChange={(_, itemIds) => {
                  if (Array.isArray(itemIds)) {
                    setSelectedId(itemIds[0] ?? null);
                  } else {
                    setSelectedId(itemIds ?? null);
                  }
                }}
              >
                {tree.roots.map((rootId) => renderNode(rootId))}
              </SimpleTreeView>
            ) : (
              <Alert severity="info">Import a SKOS TTL file to view the taxonomy hierarchy.</Alert>
            )}
          </CardContent>
        </Card>

        <Stack spacing={3} sx={{ flex: { xs: 1, lg: 0.9 } }}>
          <Card variant="outlined">
            <CardHeader title="Concept details" />
            <CardContent>
              {selectedConcept ? (
                <Stack spacing={1.5}>
                  <Typography variant="h6">{selectedConcept.label}</Typography>
                  <Typography variant="body2" color="text.secondary">ID: {selectedConcept.id}</Typography>
                  {selectedConcept.definition && (
                    <Typography variant="body2" color="text.secondary">
                      {selectedConcept.definition}
                    </Typography>
                  )}
                  {selectedConcept.altLabels?.length ? (
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                      {selectedConcept.altLabels.map((label) => (
                        <Chip key={label} label={label} size="small" />
                      ))}
                    </Stack>
                  ) : null}
                  <Divider />
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="subtitle2">Broader concepts</Typography>
                      {broaderLabels.length ? (
                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                          {broaderLabels.map((label) => (
                            <Chip key={label} label={label} size="small" variant="outlined" />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No broader concepts.
                        </Typography>
                      )}
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">Narrower concepts</Typography>
                      {narrowerLabels.length ? (
                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                          {narrowerLabels.map((label) => (
                            <Chip key={label} label={label} size="small" variant="outlined" />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No narrower concepts.
                        </Typography>
                      )}
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">Related concepts</Typography>
                      {relatedLabels.length ? (
                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                          {relatedLabels.map((label) => (
                            <Chip key={label} label={label} size="small" variant="outlined" />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No related concepts.
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                  {selectedCollections.length ? (
                    <>
                      <Divider />
                      <Typography variant="subtitle2">Collections</Typography>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                        {selectedCollections.map((collection) => (
                          <Chip key={collection.id} label={collection.label} size="small" color="primary" variant="outlined" />
                        ))}
                      </Stack>
                    </>
                  ) : null}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Select a concept from the hierarchy to inspect its details.
                </Typography>
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader
              title="Collections"
              subheader={collections.length ? `${collections.length} available` : undefined}
            />
            <CardContent sx={{ maxHeight: 260, overflow: "auto" }}>
              {collections.length ? (
                <List dense disablePadding sx={{ pr: 1 }}>
                  {collections.map((collection) => {
                    const previewMembers = collection.members.slice(0, 10);
                    return (
                      <ListItem key={collection.id} alignItems="flex-start" sx={{ mb: 1 }}>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle2">
                              {collection.label} · {collection.members.length} members
                            </Typography>
                          }
                          secondary={
                            collection.members.length ? (
                              <Box sx={{ mt: 0.5, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                {previewMembers.map((member) => (
                                  <Chip
                                    key={`${collection.id}-${member}`}
                                    label={conceptLabel(member)}
                                    size="small"
                                    variant="outlined"
                                  />
                                ))}
                                {collection.members.length > 10 && (
                                  <Typography variant="caption" color="text.secondary">
                                    +{collection.members.length - 10} more
                                  </Typography>
                                )}
                              </Box>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No members listed.
                              </Typography>
                            )
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No collections defined in the current taxonomy.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Stack>
    </Stack>
  );
};

export default TaxonomyWorkspace;
