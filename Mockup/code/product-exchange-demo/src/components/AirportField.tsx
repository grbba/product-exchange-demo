import React, { useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import type { AutocompleteChangeReason } from "@mui/material/Autocomplete";
import type { AirportSuggestion } from "../useAirportSearch";
import { useAirportSearch } from "../useAirportSearch";

type AirportFieldProps = {
  value?: string;
  onChange: (iataCode: string | null) => void;
  label?: string;
  placeholder?: string;
  limit?: number;
};

const renderOptionLabel = (option: AirportSuggestion) => {
  const code = option.iataCode ?? option.id;
  const parts = [
    option.name,
    option.cityName,
    option.countryCode,
  ].filter(Boolean);
  const details = parts.length ? ` — ${Array.from(new Set(parts)).join(", ")}` : "";
  return `${code}${details}`;
};

export const AirportField: React.FC<AirportFieldProps> = ({
  value = "",
  onChange,
  label = "Airport",
  placeholder = "Search airport or city",
  limit = 10,
}) => {
  const [inputValue, setInputValue] = useState(value);
  const { results, loading } = useAirportSearch(inputValue, limit);

  const options: AirportSuggestion[] = useMemo(() => {
    if (!results.length && value && !inputValue) {
      return [{ id: value, iataCode: value }];
    }
    return results;
  }, [results, value, inputValue]);

  const selectedOption = useMemo(() => {
    if (!value) return null;
    return (
      options.find(
        (option) => option.iataCode?.toUpperCase() === value.toUpperCase() || option.id === value
      ) ?? null
    );
  }, [options, value]);

  return (
    <Autocomplete<AirportSuggestion, false, false, false>
      fullWidth
      options={options}
      loading={loading}
      value={selectedOption}
      autoHighlight
      inputValue={inputValue}
      getOptionLabel={(option) => renderOptionLabel(option)}
      isOptionEqualToValue={(option, val) =>
        option.iataCode === val.iataCode && option.id === val.id
      }
      onInputChange={(_, newValue) => {
        setInputValue(newValue);
      }}
      onChange={(_, newValue: AirportSuggestion | null, reason: AutocompleteChangeReason) => {
        if (reason === "clear") {
          onChange(null);
          return;
        }
        const nextCode = newValue?.iataCode ?? newValue?.id ?? null;
        if (nextCode) {
          onChange(nextCode);
          setInputValue(nextCode);
        }
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};

export default AirportField;
