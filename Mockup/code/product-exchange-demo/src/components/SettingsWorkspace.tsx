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
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import RefreshIcon from "@mui/icons-material/Refresh";
import type {
  AppIdentity,
  AppSettings,
  ChannelConfiguration,
  ExchangeProtocol,
  IdentityCapability,
} from "../domain";
import { EXCHANGE_PROTOCOLS, IDENTITY_CAPABILITIES, createDefaultSettings, normalizeAppSettings, uid } from "../domain";

type SettingsWorkspaceProps = {
  settings: AppSettings;
  capabilityOptions?: IdentityCapability[];
  protocolOptions?: ExchangeProtocol[];
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
  onSave,
}) => {
  const [draft, setDraft] = useState<AppSettings>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

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

  return (
    <Stack spacing={2}>
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
            <Typography variant="subtitle1">Capabilities</Typography>
            <FormGroup>
              {capabilityOptions.map((capability) => (
                <FormControlLabel
                  key={capability}
                  control={
                    <Checkbox
                      checked={capabilityMap.has(capability)}
                      onChange={(event) => toggleCapability(capability, event.target.checked)}
                    />
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

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardHeader
          title="Outbound channel"
          subheader="Define how updates leave this node. These values will be used when establishing a streaming/push connection."
        />
        <CardContent>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="channel-protocol">Protocol</InputLabel>
              <Select
                labelId="channel-protocol"
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
          </Stack>
        </CardContent>
      </Card>

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
