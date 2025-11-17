import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  Radio,
  RadioGroup,
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
import SaveIcon from "@mui/icons-material/Save";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import UploadIcon from "@mui/icons-material/Upload";
import type {
  AppIdentity,
  AppSettings,
  ChannelConfiguration,
  ExchangeProtocol,
  IdentityCapability,
  InboundProcessingMode,
} from "../domain";
import {
  EXCHANGE_PROTOCOLS,
  IDENTITY_CAPABILITIES,
  INBOUND_PROCESSING_MODES,
  createDefaultSettings,
  normalizeAppSettings,
  uid,
} from "../domain";
import { TAXONOMY_SOURCES } from "../taxonomy";

type ResetAction = {
  key: string;
  label: string;
  description: string;
  onReset: () => void;
};

type DataAction = {
  key: string;
  label: string;
  description: string;
  onExport: () => void;
  onImport: (file: File) => Promise<void> | void;
};

type SectionId = "identity" | "channel" | "taxonomy" | "demo";

const SECTION_DEFINITIONS: { id: SectionId; label: string; description: string }[] = [
  {
    id: "identity",
    label: "App identity",
    description: "Instance profile, capabilities, and contact channels.",
  },
  {
    id: "channel",
    label: "Outbound channel",
    description: "Webhook delivery details and inbound handling.",
  },
  {
    id: "taxonomy",
    label: "Taxonomy defaults",
    description: "Choose the bundled taxonomy loaded at startup.",
  },
  {
    id: "demo",
    label: "Demo data",
    description: "Manage demo backups and restore or reset sample data.",
  },
];

type SettingsWorkspaceProps = {
  settings: AppSettings;
  capabilityOptions?: IdentityCapability[];
  protocolOptions?: ExchangeProtocol[];
  resetActions?: ResetAction[];
  dataActions?: DataAction[];
  onSave: (settings: AppSettings) => void;
};

const capabilityLabel = (capability: IdentityCapability) => {
  switch (capability) {
    case "product-updates":
      return "Products";
    case "schema-updates":
      return "Product schemas";
    case "taxonomy-updates":
      return "Taxonomy";
    case "reference-system-updates":
      return "Reference systems";
    default:
      return capability;
  }
};

const capabilityDescription = (capability: IdentityCapability) => {
  switch (capability) {
    case "product-updates":
      return "Send incremental product updates.";
    case "schema-updates":
      return "Share changes to schema templates.";
    case "taxonomy-updates":
      return "Broadcast taxonomy updates.";
    case "reference-system-updates":
      return "Expose reference-system catalog changes.";
    default:
      return "";
  }
};

const SettingsWorkspace: React.FC<SettingsWorkspaceProps> = ({
  settings,
  capabilityOptions = IDENTITY_CAPABILITIES,
  protocolOptions = EXCHANGE_PROTOCOLS,
  resetActions = [],
  dataActions = [],
  onSave,
}) => {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const availableSections = useMemo(
    () =>
      SECTION_DEFINITIONS.filter((section) => {
        if (section.id === "demo") return resetActions.length > 0 || dataActions.length > 0;
        return true;
      }),
    [dataActions.length, resetActions.length]
  );
  const [activeSection, setActiveSection] = useState<SectionId>(availableSections[0]?.id ?? "identity");

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    if (!availableSections.some((section) => section.id === activeSection)) {
      setActiveSection(availableSections[0]?.id ?? "identity");
    }
  }, [activeSection, availableSections]);

  const capabilityMap = useMemo(() => new Set(draft.identity.capabilities), [draft.identity.capabilities]);

  const setIdentityField = <K extends keyof AppIdentity>(key: K, value: AppIdentity[K]) => {
    setDraft((current) => ({
      ...current,
      identity: {
        ...current.identity,
        [key]: value,
      },
    }));
  };

  const setChannelField = <K extends keyof ChannelConfiguration>(key: K, value: ChannelConfiguration[K]) => {
    setDraft((current) => ({
      ...current,
      channel: {
        ...current.channel,
        [key]: value,
      },
    }));
  };

  const toggleCapability = (capability: IdentityCapability, checked: boolean) => {
    setDraft((current) => {
      const nextCapabilities = checked
        ? Array.from(new Set([...current.identity.capabilities, capability]))
        : current.identity.capabilities.filter((item) => item !== capability);
      return {
        ...current,
        identity: {
          ...current.identity,
          capabilities: nextCapabilities,
        },
      };
    });
  };

  const setDefaultTaxonomy = (value: string | null) => {
    setDraft((current) => ({
      ...current,
      defaultTaxonomyId: value,
    }));
  };

  const regenerateInstanceId = () => {
    setIdentityField("instanceId", `apmwg-node-${uid()}`);
  };

  const resetToDefaults = () => {
    setDraft(createDefaultSettings());
  };

  const revertChanges = () => {
    setDraft(settings);
  };

  const handleSave = () => {
    const next = normalizeAppSettings({
      ...draft,
      updatedAt: new Date().toISOString(),
    });
    onSave(next);
  };

  const renderIdentityCard = () => (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardHeader
        title="App identity"
        subheader="Describe how this instance introduces itself to partners."
        action={
          <Button variant="text" size="small" startIcon={<RefreshIcon />} onClick={regenerateInstanceId}>
            New identifier
          </Button>
        }
      />
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Instance identifier"
              value={draft.identity.instanceId}
              onChange={(event) => setIdentityField("instanceId", event.target.value)}
              helperText="Unique identifier shared with partners."
              fullWidth
            />
            <TextField
              label="Display name"
              value={draft.identity.displayName}
              onChange={(event) => setIdentityField("displayName", event.target.value)}
              helperText="Human readable label."
              fullWidth
            />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Organization"
              value={draft.identity.organization}
              onChange={(event) => setIdentityField("organization", event.target.value)}
              fullWidth
            />
            <TextField
              label="Contact email"
              value={draft.identity.contactEmail}
              onChange={(event) => setIdentityField("contactEmail", event.target.value)}
              fullWidth
              type="email"
            />
          </Stack>
          <TextField
            label="Public description"
            value={draft.identity.description}
            onChange={(event) => setIdentityField("description", event.target.value)}
            multiline
            minRows={2}
            helperText="Provide context so partners know what to expect from updates."
          />
          <TextField
            label="Default endpoint URL"
            value={draft.identity.endpointUrl}
            onChange={(event) => setIdentityField("endpointUrl", event.target.value)}
            helperText="Where this node expects callbacks/webhooks."
            fullWidth
          />
          <Divider flexItem />
          <Typography variant="subtitle1">Role (for demo emphasis)</Typography>
          <FormControl>
            <RadioGroup
              row
              value={draft.identity.role}
              onChange={(event) => setIdentityField("role", event.target.value as AppIdentity["role"])}
            >
              {(["supplier", "retailer", "seller"] as const).map((role) => (
                <FormControlLabel
                  key={role}
                  value={role}
                  control={<Radio size="small" />}
                  label={role.charAt(0).toUpperCase() + role.slice(1)}
                />
              ))}
            </RadioGroup>
          </FormControl>
          <Typography variant="caption" color="text.secondary">
            Choose the role this instance represents to adapt the accent colors in the app chrome.
          </Typography>
          <Divider flexItem />
          <Typography variant="subtitle1">Capabilities</Typography>
          <FormGroup>
            {capabilityOptions.map((capability) => (
              <FormControlLabel
                key={capability}
                control={
                  <Checkbox checked={capabilityMap.has(capability)} onChange={(event) => toggleCapability(capability, event.target.checked)} />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {capabilityLabel(capability)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {capabilityDescription(capability)}
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start" }}
              />
            ))}
          </FormGroup>
        </Stack>
      </CardContent>
    </Card>
  );

  const renderChannelCard = () => (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardHeader title="Outbound channel" subheader="Configure the webhook endpoint and delivery behavior." />
      <CardContent>
        <Stack spacing={2}>
          <FormControl fullWidth>
            <InputLabel id="channel-protocol-label">Protocol</InputLabel>
            <Select
              labelId="channel-protocol-label"
              label="Protocol"
              value={draft.channel.protocol}
              onChange={(event) => setChannelField("protocol", event.target.value as ChannelConfiguration["protocol"])}
            >
              {protocolOptions.map((protocol) => (
                <MenuItem key={protocol} value={protocol}>
                  {protocol.toUpperCase()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Destination URL"
            value={draft.channel.destinationUrl}
            onChange={(event) => setChannelField("destinationUrl", event.target.value)}
            helperText="Partner endpoint that receives push notifications."
            fullWidth
          />
          <TextField
            label="Auth token / credential"
            value={draft.channel.authToken}
            onChange={(event) => setChannelField("authToken", event.target.value)}
            helperText="Optional secret shared with the partner."
            fullWidth
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={draft.channel.requireAcknowledgement}
                onChange={(event) => setChannelField("requireAcknowledgement", event.target.checked)}
              />
            }
            label="Require delivery acknowledgement"
          />
          <TextField
            label="Notes for partner onboarding"
            value={draft.channel.notes}
            onChange={(event) => setChannelField("notes", event.target.value)}
            multiline
            minRows={2}
          />
          <Divider />
          <Typography variant="subtitle2">Inbound handling</Typography>
          <FormControl fullWidth>
            <InputLabel id="inbound-processing-mode-label">Processing mode</InputLabel>
            <Select
              labelId="inbound-processing-mode-label"
              label="Processing mode"
              value={draft.inboundProcessingMode}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  inboundProcessingMode: event.target.value as InboundProcessingMode,
                }))
              }
            >
              {INBOUND_PROCESSING_MODES.map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {mode === "manual" ? "Manual (review inbox)" : "Automatic (apply on receipt)"}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="text.secondary">
              Manual mode keeps inbound payloads in the inbox until you load them. Automatic mode applies supported payloads as soon as they
              arrive.
            </Typography>
          </FormControl>
        </Stack>
      </CardContent>
    </Card>
  );

  const renderTaxonomyCard = () => (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardHeader
        title="Taxonomy defaults"
        subheader="Choose which bundled taxonomy export loads automatically when the workspace opens."
      />
      <CardContent>
        <FormControl fullWidth>
          <InputLabel id="default-taxonomy-label">Default taxonomy</InputLabel>
          <Select
            labelId="default-taxonomy-label"
            label="Default taxonomy"
            value={draft.defaultTaxonomyId ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              setDefaultTaxonomy(typeof value === "string" && value ? value : null);
            }}
          >
            <MenuItem value="">
              <em>Use starter concepts</em>
            </MenuItem>
            {TAXONOMY_SOURCES.map((source) => (
              <MenuItem key={source.id} value={source.id}>
                {source.label}
              </MenuItem>
            ))}
          </Select>
          <Typography variant="caption" color="text.secondary">
            Leave blank to keep the lightweight demo taxonomy. The selected export loads automatically on restart.
          </Typography>
          {draft.defaultTaxonomyId ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              {TAXONOMY_SOURCES.find((source) => source.id === draft.defaultTaxonomyId)?.description ??
                "Load the configured taxonomy via Settings → Reset controls to preview it immediately."}
            </Typography>
          ) : null}
        </FormControl>
      </CardContent>
    </Card>
  );

  const renderDemoCard = () =>
    resetActions.length || dataActions.length ? (
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardHeader title="Demo data reset" subheader="Quickly revert parts of the workspace to factory defaults." />
        <CardContent>
          <Stack spacing={2}>
            {resetActions.length ? (
              <Stack spacing={1.5}>
                {resetActions.map((action) => (
                  <Stack key={action.key} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2">{action.label}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {action.description}
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => {
                        const confirmed = window.confirm(`Reset ${action.label}? This cannot be undone.`);
                        if (confirmed) action.onReset();
                      }}
                    >
                      Reset
                    </Button>
                  </Stack>
                ))}
              </Stack>
            ) : null}

            {dataActions.length ? (
              <Stack spacing={1.5}>
                {dataActions.map((action) => (
                  <Stack key={action.key} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2">{action.label}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {action.description}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" startIcon={<DownloadIcon />} onClick={action.onExport}>
                        Export
                      </Button>
                      <Button component="label" variant="contained" startIcon={<UploadIcon />}>
                        Import
                        <input
                          type="file"
                          accept="application/json"
                          hidden
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (!file) return;
                            try {
                              await action.onImport(file);
                            } catch (error) {
                              console.error("Import failed", error);
                            }
                          }}
                        />
                      </Button>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
    ) : null;

  const renderActiveSection = () => {
    switch (activeSection) {
      case "identity":
        return renderIdentityCard();
      case "channel":
        return renderChannelCard();
      case "taxonomy":
        return renderTaxonomyCard();
      case "demo":
        return renderDemoCard();
      default:
        return null;
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
        <Card
          variant="outlined"
          sx={{
            borderRadius: 3,
            width: { xs: "100%", md: 260 },
            flexShrink: 0,
            position: { md: "sticky" },
            top: { md: 16 },
            alignSelf: { md: "flex-start" },
          }}
        >
          <CardHeader title="Settings topics" subheader="Choose a theme to edit the related settings." />
          <CardContent sx={{ p: 0 }}>
            <List>
              {availableSections.map((section) => (
                <ListItemButton
                  key={section.id}
                  selected={section.id === activeSection}
                  onClick={() => setActiveSection(section.id)}
                  sx={{ alignItems: "flex-start" }}
                >
                  <ListItemText
                    primary={section.label}
                    primaryTypographyProps={{ fontWeight: section.id === activeSection ? 600 : 500 }}
                    secondary={section.description}
                    secondaryTypographyProps={{ variant: "caption" }}
                  />
                </ListItemButton>
              ))}
            </List>
          </CardContent>
        </Card>
        <Box sx={{ flex: 1, minWidth: 0 }}>{renderActiveSection()}</Box>
      </Stack>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          justifyContent: { xs: "stretch", sm: "flex-end" },
        }}
      >
        <Button variant="text" startIcon={<RestartAltIcon />} onClick={resetToDefaults}>
          Reset to defaults
        </Button>
        <Button variant="outlined" onClick={revertChanges}>
          Revert unsaved changes
        </Button>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
          Save settings
        </Button>
      </Box>
    </Stack>
  );
};

export default SettingsWorkspace;
