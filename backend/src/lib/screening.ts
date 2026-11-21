// The screening tests every unit must go through. A result is only accepted
// when ALL of them are recorded, so a unit can never be cleared with a test skipped.
export const REQUIRED_TESTS = [
  { name: "Hepatitis B Surface Antigen (HBsAg)", short: "HBsAg" },
  { name: "Anti-HCV (Hepatitis C)", short: "Anti-HCV" },
  { name: "HIV 1 & 2 Ag/Ab Combo", short: "HIV" },
  { name: "Syphilis (VDRL/RPR)", short: "Syphilis" },
  { name: "Malaria (MP-RDT)", short: "Malaria" },
] as const;

export const REQUIRED_TEST_NAMES: string[] = REQUIRED_TESTS.map((t) => t.name);
