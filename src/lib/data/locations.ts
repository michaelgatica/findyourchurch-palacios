import type { CityRegion, CountyRegion, StateRegion } from "@/lib/types/directory";

export const states: StateRegion[] = [
  {
    id: "texas",
    name: "Texas",
    code: "TX",
    slug: "texas",
  },
];

export const counties: CountyRegion[] = [
  {
    id: "matagorda-county",
    name: "Matagorda County",
    slug: "matagorda-county",
    stateId: "texas",
  },
];

export const cities: CityRegion[] = [
  {
    id: "palacios-texas",
    name: "Palacios",
    slug: "palacios",
    stateCode: "TX",
    stateId: "texas",
    countyId: "matagorda-county",
  },
];

export function getStateByCode(stateCode: string) {
  return states.find(
    (state) => state.code.toLowerCase() === stateCode.trim().toLowerCase(),
  );
}

export function getStateById(stateId: string) {
  return states.find((state) => state.id === stateId) ?? null;
}

export function getCountyById(countyId: string) {
  return counties.find((county) => county.id === countyId) ?? null;
}

export function getCityById(cityId: string) {
  return cities.find((city) => city.id === cityId) ?? null;
}

export function findCityByNameAndStateCode(cityName: string, stateCode: string) {
  return cities.find(
    (city) =>
      city.name.toLowerCase() === cityName.trim().toLowerCase() &&
      city.stateCode.toLowerCase() === stateCode.trim().toLowerCase(),
  );
}

export function getActiveLaunchCity() {
  return cities[0];
}
