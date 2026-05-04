import { NextResponse } from "next/server";

import { geocodeLocationSearchQuery } from "@/lib/services/church-map-service";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const locationQuery = requestUrl.searchParams.get("query")?.trim() ?? "";

  if (!locationQuery) {
    return NextResponse.json(
      {
        error: "A location query is required.",
      },
      { status: 400 },
    );
  }

  if (locationQuery.length > 160) {
    return NextResponse.json(
      {
        error: "Please keep the location search under 160 characters.",
      },
      { status: 400 },
    );
  }

  const coordinates = await geocodeLocationSearchQuery(locationQuery);

  return NextResponse.json({
    found: Boolean(coordinates),
    coordinates,
  });
}
