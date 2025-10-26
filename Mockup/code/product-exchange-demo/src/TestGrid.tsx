import { Box, Grid, Typography } from "@mui/material";

export default function TestGrid() {
  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1, textAlign: "center" }}>
            <Typography>Box 1</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1, textAlign: "center" }}>
            <Typography>Box 2</Typography>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}