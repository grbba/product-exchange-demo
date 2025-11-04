export type AirportValidationResult = {
  valid: boolean;
  record?: unknown;
  reason?: string;
};

const IATA_REGEX = /^[A-Za-z]{3}$/;

export const validateIataAirport = async (code: string): Promise<AirportValidationResult> => {
  const trimmed = code.trim().toUpperCase();

  if (!trimmed) {
    return { valid: false, reason: "Code is required." };
  }

  if (!IATA_REGEX.test(trimmed)) {
    return { valid: false, reason: "IATA codes must be exactly three letters." };
  }

  try {
    const response = await fetch(`/api/airports/validate?code=${trimmed}`);
    if (!response.ok) {
      throw new Error(`Validation request failed: ${response.status}`);
    }
    const payload = await response.json();
    if (payload?.valid) {
      return { valid: true, record: payload.match };
    }
    return { valid: false, reason: "No matching airport found in Amadeus." };
  } catch (error) {
    console.error("Airport validation error", error);
    return { valid: false, reason: "Failed to validate airport code." };
  }
};

