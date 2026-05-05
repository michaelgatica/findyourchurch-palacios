import type {
  CityRegion,
  CountyRegion,
  LaunchMarket,
  StateRegion,
} from "@/lib/types/directory";

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
  {
    id: "calhoun-county",
    name: "Calhoun County",
    slug: "calhoun-county",
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
  {
    id: "blessing-texas",
    name: "Blessing",
    slug: "blessing",
    stateCode: "TX",
    stateId: "texas",
    countyId: "matagorda-county",
  },
  {
    id: "collegeport-texas",
    name: "Collegeport",
    slug: "collegeport",
    stateCode: "TX",
    stateId: "texas",
    countyId: "matagorda-county",
  },
  {
    id: "markham-texas",
    name: "Markham",
    slug: "markham",
    stateCode: "TX",
    stateId: "texas",
    countyId: "matagorda-county",
  },
  {
    id: "matagorda-texas",
    name: "Matagorda",
    slug: "matagorda",
    stateCode: "TX",
    stateId: "texas",
    countyId: "matagorda-county",
  },
  {
    id: "wadsworth-texas",
    name: "Wadsworth",
    slug: "wadsworth",
    stateCode: "TX",
    stateId: "texas",
    countyId: "matagorda-county",
  },
  {
    id: "olivia-texas",
    name: "Olivia",
    slug: "olivia",
    stateCode: "TX",
    stateId: "texas",
    countyId: "calhoun-county",
  },
];

export const launchMarkets: LaunchMarket[] = [
  {
    id: "palacios",
    name: "Palacios",
    launchName: "Find Your Church Palacios",
    primaryCityId: "palacios-texas",
    nearbyCityIds: [
      "blessing-texas",
      "collegeport-texas",
      "markham-texas",
      "matagorda-texas",
      "olivia-texas",
      "wadsworth-texas",
    ],
    stateId: "texas",
    countyIds: ["matagorda-county", "calhoun-county"],
    contactEmail: "support@findyourchurchpalacios.org",
    localAreaLabel: "Palacios area",
    communityLabel: "Palacios community",
    heroTitle: "Find a Church in Palacios, Texas",
    heroLead:
      "Find service times, contact information, and helpful details for local churches in the Palacios area.",
    heroPanelTitle: "A clear place to explore churches in the Palacios community",
    directoryHeading: "Find churches near you in Palacios and nearby communities",
    directoryLead:
      "Search by church name, pastor, ministry, worship style, or service time, then use the map and filters below to narrow your results across Palacios and the surrounding area.",
    launchDescription:
      "Find Your Church Palacios helps residents, visitors, and families discover local churches, view service times, and connect with church communities in Palacios and nearby communities.",
    directoryDescription:
      "Browse published church listings in Palacios, Texas and nearby communities, compare service times, and connect with local church communities.",
    currentListingScope:
      "We are currently accepting church listings in Palacios, Texas and nearby communities within a 20-mile radius, including Blessing, Collegeport, Markham, Matagorda, Olivia, and Wadsworth.",
    launchVision:
      "Palacios is our first local launch. Our long-term vision is to help more communities make local church information easy to find, accurate, and accessible.",
    brandAssets: {
      landscapeLogoSrc: "/assets/logos/find-your-church-palacios-landscape.png",
      squareLogoSrc: "/assets/logos/find-your-church-palacios-512.png",
    },
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

export function findCountyByName(countyName: string) {
  return (
    counties.find(
      (county) => county.name.toLowerCase() === countyName.trim().toLowerCase(),
    ) ?? null
  );
}

export function getCityById(cityId: string) {
  return cities.find((city) => city.id === cityId) ?? null;
}

export function getLaunchMarketById(marketId: string) {
  return launchMarkets.find((market) => market.id === marketId) ?? null;
}

export function getActiveLaunchMarket() {
  const configuredMarketId = process.env.NEXT_PUBLIC_ACTIVE_MARKET_KEY?.trim().toLowerCase();

  if (configuredMarketId) {
    return getLaunchMarketById(configuredMarketId) ?? launchMarkets[0];
  }

  return launchMarkets[0];
}

export function getCitiesForLaunchMarket(market: LaunchMarket) {
  const primaryCity = getCityById(market.primaryCityId);
  const nearbyCities = market.nearbyCityIds
    .map((cityId) => getCityById(cityId))
    .filter((city): city is CityRegion => city !== null);

  return primaryCity ? [primaryCity, ...nearbyCities] : nearbyCities;
}

export function findCityByNameAndStateCode(cityName: string, stateCode: string) {
  return cities.find(
    (city) =>
      city.name.toLowerCase() === cityName.trim().toLowerCase() &&
      city.stateCode.toLowerCase() === stateCode.trim().toLowerCase(),
  );
}

export function getActiveLaunchCity() {
  const activeMarket = getActiveLaunchMarket();
  return getCityById(activeMarket.primaryCityId) ?? cities[0];
}
