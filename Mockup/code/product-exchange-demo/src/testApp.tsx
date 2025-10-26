// src/App.tsx
import { Box, Grid, Typography } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const theme = createTheme({
  palette: { mode: "light" },
  typography: { fontSize: 14 },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Grid probe</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ p: 2, border: "1px solid", borderRadius: 1, textAlign: "center" }}>Box 1</Box>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ p: 2, border: "1px solid", borderRadius: 1, textAlign: "center" }}>Box 2</Box>
          </Grid>
        </Grid>
      </Box>
    </ThemeProvider>
  );
}