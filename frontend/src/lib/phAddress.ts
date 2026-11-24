import {
  getAllRegions, getBarangaysByMunicipality, getAllMunicipalities,
  getMunicipalitiesByProvince, getProvincesByRegion,
} from "@aivangogh/ph-address";

// Official PSGC list (as of 30 June 2026), bundled with the app: no internet needed and
// the same data the backend uses to check the chosen address.
export interface Place { code: string; name: string }

const NCR = "13";

// What people call each region (the list itself only says "Region II").
const NICKNAME: Record<string, string> = {
  "01": "Ilocos Region", "02": "Cagayan Valley", "03": "Central Luzon", "04": "CALABARZON",
  "05": "Bicol Region", "06": "Western Visayas", "07": "Central Visayas", "08": "Eastern Visayas",
  "09": "Zamboanga Peninsula", "10": "Northern Mindanao", "11": "Davao Region", "12": "SOCCSKSARGEN",
  "13": "NCR", "14": "CAR", "16": "Caraga", "17": "MIMAROPA", "18": "Negros Island Region", "19": "BARMM",
};

const byName = (a: Place, b: Place) => a.name.localeCompare(b.name);

let munCache: ReturnType<typeof getAllMunicipalities> | null = null;
const allMunicipalities = () => (munCache ??= getAllMunicipalities());

export function listRegions(): Place[] {
  return [...getAllRegions()]
    .sort((a, b) => a.psgcCode.localeCompare(b.psgcCode))
    .map((r) => {
      const nick = NICKNAME[r.psgcCode.slice(0, 2)];
      const name = nick && !r.name.toLowerCase().includes(nick.toLowerCase()) ? `${r.name} (${nick})` : r.name;
      return { code: r.psgcCode, name };
    });
}

export function listProvinces(regionCode: string): Place[] {
  if (!regionCode) return [];
  // Metro Manila has no provinces in PSGC: its cities sit directly under the region.
  if (regionCode.startsWith(NCR)) return [{ code: regionCode, name: "Metro Manila" }];
  return getProvincesByRegion(regionCode).map((p) => ({ code: p.psgcCode, name: p.name })).sort(byName);
}

export function listCities(regionCode: string, provinceCode: string): Place[] {
  if (!provinceCode) return [];
  const list = regionCode.startsWith(NCR)
    ? allMunicipalities().filter((m) => m.psgcCode.startsWith(NCR))
    : getMunicipalitiesByProvince(provinceCode);
  return list.map((m) => ({ code: m.psgcCode, name: m.name })).sort(byName);
}

export function listBarangays(cityCode: string): Place[] {
  if (!cityCode) return [];
  return getBarangaysByMunicipality(cityCode).map((b) => ({ code: b.psgcCode, name: b.name })).sort(byName);
}

export interface AddressValue {
  street: string;
  regionCode: string;
  provinceCode: string;
  cityCode: string;
  barangayCode: string;
}

export const EMPTY_ADDRESS: AddressValue = { street: "", regionCode: "", provinceCode: "", cityCode: "", barangayCode: "" };

export const isAddressComplete = (a: AddressValue) =>
  !!(a.regionCode && a.provinceCode && a.cityCode && a.barangayCode);
