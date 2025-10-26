import React from "react";
import { Box, Card, CardContent, CardHeader, Chip, Stack, Typography } from "@mui/material";
import type { Feature } from "../domain";

type DiagramCardProps = {
  title: string;
  subtitle?: string;
  features: Feature[];
  conceptLabel: (id: string) => string;
};

const DiagramCard: React.FC<DiagramCardProps> = ({ title, subtitle, features, conceptLabel }) => (
  <Card variant="outlined" sx={{ borderRadius: 3 }}>
    <CardHeader title={title} subheader={subtitle} />
    <CardContent>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        {features.map((feature) => (
          <Stack
            key={feature.id}
            spacing={1}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              p: 2,
              minHeight: 120,
            }}
          >
            <Typography variant="subtitle1">{feature.name}</Typography>
            {feature.description && (
              <Typography variant="body2" color="text.secondary">
                {feature.description}
              </Typography>
            )}
            {feature.values.length ? (
              <Stack spacing={0.5}>
                {feature.values.map((value, index) => (
                  <Typography key={`${feature.id}-${index}`} variant="body2">
                    {value.kind === "SingleValue" && `Value: ${value.value || "—"}`}
                    {value.kind === "ValueRange" && `Range: ${value.min || "—"} → ${value.max || "—"}`}
                    {value.kind === "DiscreteSet" && `Set: ${value.values.join(", ") || "—"}`}
                  </Typography>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No values yet.
              </Typography>
            )}
            {feature.tags.length ? (
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
                {feature.tags.map((tag) => (
                  <Chip key={tag} label={conceptLabel(tag)} size="small" />
                ))}
              </Stack>
            ) : null}
          </Stack>
        ))}
      </Box>
      {!features.length && (
        <Typography variant="body2" color="text.secondary">
          No features defined.
        </Typography>
      )}
    </CardContent>
  </Card>
);

export default DiagramCard;
