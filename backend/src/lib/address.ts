import { z } from "zod";
import {
  getBarangayByCode, getMunicipalityByCode, getProvinceByCode, getRegionByCode,
} from "@aivangogh/ph-address";
import { AppError } from "./errors";

// Philippine addresses are picked as Region > Province > City/Municipality > Barangay
// from the official PSGC list (bundled in the @aivangogh/ph-address package, so the
// choices are the same on the server and in the browser). The browser sends CODES only;
// the names and the readable address text are produced here, so a made-up or
// mismatched address (for example a barangay that is not in that city) is rejected.

const code10 = z.string().regex(/^\d{10}$/, "Choose a valid address.");

export const addressInputSchema = z.object({
  street: z.string().trim().max(120, "Street / house number is too long.").optional(),
  regionCode: code10,
  provinceCode: code10,
  cityCode: code10,
  barangayCode: code10,
});

export type AddressInput = z.infer<typeof addressInputSchema>;

export interface AddressDetails {
  street: string;
  region: { code: string; name: string };
  province: { code: string; name: string };
  city: { code: string; name: string };
  barangay: { code: string; name: string };
}

// Common names people know the regions by (the dataset only says "Region II").
const REGION_NICKNAME: Record<string, string> = {
  "01": "Ilocos Region", "02": "Cagayan Valley", "03": "Central Luzon", "04": "CALABARZON",
  "05": "Bicol Region", "06": "Western Visayas", "07": "Central Visayas", "08": "Eastern Visayas",
  "09": "Zamboanga Peninsula", "10": "Northern Mindanao", "11": "Davao Region", "12": "SOCCSKSARGEN",
  "13": "NCR", "14": "CAR", "16": "Caraga", "17": "MIMAROPA", "18": "Negros Island Region", "19": "BARMM",
};

export function regionLabel(code: string, name: string): string {
  const nick = REGION_NICKNAME[code.slice(0, 2)];
  return nick && !name.toLowerCase().includes(nick.toLowerCase()) ? `${name} (${nick})` : name;
}

const NCR = "13";

export function resolveAddress(input: AddressInput): { address: string; details: AddressDetails } {
  const bad = (msg: string) => new AppError(400, msg);

  const region = getRegionByCode(input.regionCode);
  if (!region) throw bad("Choose a valid region.");

  const barangay = getBarangayByCode(input.barangayCode);
  if (!barangay) throw bad("Choose a valid barangay.");
  const city = getMunicipalityByCode(input.cityCode);
  if (!city) throw bad("Choose a valid city or municipality.");
  if (barangay.municipalCityCode !== city.psgcCode) throw bad("That barangay does not belong to the chosen city or municipality.");

  let provinceName: string;
  if (input.regionCode.startsWith(NCR)) {
    // Metro Manila has no provinces in PSGC: its cities sit directly under the region.
    if (!city.psgcCode.startsWith(NCR)) throw bad("That city or municipality is not in the chosen region.");
    if (input.provinceCode !== input.regionCode) throw bad("Choose a valid province.");
    provinceName = "Metro Manila";
  } else {
    const province = getProvinceByCode(input.provinceCode);
    if (!province || province.regionCode !== region.psgcCode) throw bad("That province is not in the chosen region.");
    if (city.provinceCode !== province.psgcCode) throw bad("That city or municipality is not in the chosen province.");
    provinceName = province.name;
  }

  const details: AddressDetails = {
    street: input.street ?? "",
    region: { code: region.psgcCode, name: regionLabel(region.psgcCode, region.name) },
    province: { code: input.provinceCode, name: provinceName },
    city: { code: city.psgcCode, name: city.name },
    barangay: { code: barangay.psgcCode, name: barangay.name },
  };
  return { address: composeAddress(details), details };
}

export function composeAddress(d: AddressDetails): string {
  return [d.street, `Brgy. ${d.barangay.name}`, d.city.name, d.province.name, d.region.name]
    .filter((p) => p && p.trim())
    .join(", ");
}

// Shows only the barangay and city: enough to be useful without exposing the street.
export function shortAddress(details: unknown, fallback: string): string {
  const d = details as Partial<AddressDetails> | null;
  if (d?.barangay?.name && d.city?.name) return `Brgy. ${d.barangay.name}, ${d.city.name}`;
  // Older records only have free text: hide everything before the last two parts.
  const parts = fallback.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 2 ? parts.slice(-3).join(", ") : fallback ? "Address on file" : "";
}
