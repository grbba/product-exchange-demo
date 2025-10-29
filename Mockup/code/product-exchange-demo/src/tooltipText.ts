export const schemaTooltips = {
  createSchemaCategory: {
    target: "Create Schema • Product type selector",
    text: "Choose the base product type to specialize; it sets the default context for the schema.",
  },
  createSchemaName: {
    target: "Create Schema • Schema name field",
    text: "Provide a short, unique name so you can find this schema quickly later on.",
  },
  createSchemaDescription: {
    target: "Create Schema • Description field",
    text: "Summarize the intent of the schema in one or two sentences for collaborators.",
  },
  createSchemaButton: {
    target: "Create Schema • Create button",
    text: "Add the schema using the details above; you can refine it immediately in the details panel.",
  },
  schemaList: {
    target: "Schemas list",
    text: "Select a schema to view or edit its details on the right-hand side.",
  },
  schemaDetailName: {
    target: "Schema details • Name field",
    text: "Adjust the schema name shown across the workbench and in exported files.",
  },
  schemaDetailDescription: {
    target: "Schema details • Description field",
    text: "Capture guidance or assumptions that apply whenever this schema is reused.",
  },
  schemaDetailTags: {
    target: "Schema details • Taxonomy tags",
    text: "Tags applied here are inherited by every product instantiated from this schema.",
  },
  schemaDetailAddTag: {
    target: "Schema details • Add taxonomy concept",
    text: "Search the taxonomy for a concept and add it to enrich the schema metadata.",
  },
  schemaCollections: {
    target: "Schema details • Collections section",
    text: "Assign taxonomy collections to apply all of their concepts automatically to products.",
  },
  schemaAssignCollection: {
    target: "Schema details • Assign collection control",
    text: "Choose a collection to link; its members will be added as tags to the schema and future products.",
  },
  featureTemplates: {
    target: "Schema features section",
    text: "Define the features that will pre-populate when you instantiate products from this schema.",
  },
  addFeatureButton: {
    target: "Schema features • Add feature button",
    text: "Insert a new feature template, then configure its description and expected value structure.",
  },
} as const;

export type SchemaTooltipKey = keyof typeof schemaTooltips;
