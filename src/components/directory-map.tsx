"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import {
  buildDirectionsUrl,
  formatAddress,
  getPrimaryServiceTime,
  type GeoPoint,
} from "@/lib/church-utils";
import { buildChurchProfilePath } from "@/lib/config/site";
import type { ChurchRecord } from "@/lib/types/directory";

interface DirectoryMapProps {
  churches: ChurchRecord[];
  referencePoint: GeoPoint | null;
  selectedChurchId: string | null;
  onSelectChurch: (churchId: string | null) => void;
}

function DirectoryMapViewport({
  churches,
  referencePoint,
}: Pick<DirectoryMapProps, "churches" | "referencePoint">) {
  const map = useMap();

  useEffect(() => {
    const points = churches
      .map((church) =>
        typeof church.address.latitude === "number" &&
        typeof church.address.longitude === "number"
          ? [church.address.latitude, church.address.longitude] as [number, number]
          : null,
      )
      .filter((point): point is [number, number] => Boolean(point));

    if (referencePoint) {
      points.push([referencePoint.latitude, referencePoint.longitude]);
    }

    if (points.length === 0) {
      map.setView([28.7047, -96.2175], 12);
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }

    map.fitBounds(points, {
      padding: [36, 36],
    });
  }, [churches, map, referencePoint]);

  return null;
}

export function DirectoryMap({
  churches,
  referencePoint,
  selectedChurchId,
  onSelectChurch,
}: DirectoryMapProps) {
  return (
    <div className="directory-map">
      <MapContainer
        center={[28.7047, -96.2175]}
        zoom={12}
        scrollWheelZoom={false}
        className="directory-map__canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <DirectoryMapViewport churches={churches} referencePoint={referencePoint} />

        {referencePoint ? (
          <CircleMarker
            center={[referencePoint.latitude, referencePoint.longitude]}
            radius={9}
            pathOptions={{
              color: "#D9A21B",
              fillColor: "#D9A21B",
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Popup>
              <strong>Search center</strong>
              <p>Your map search is centered here.</p>
            </Popup>
          </CircleMarker>
        ) : null}

        {churches.map((church) => {
          if (
            typeof church.address.latitude !== "number" ||
            typeof church.address.longitude !== "number"
          ) {
            return null;
          }

          const isSelected = selectedChurchId === church.id;
          const primaryServiceTime = getPrimaryServiceTime(church);

          return (
            <CircleMarker
              key={church.id}
              center={[church.address.latitude, church.address.longitude]}
              radius={isSelected ? 11 : 8}
              eventHandlers={{
                click: () => onSelectChurch(church.id),
              }}
              pathOptions={{
                color: isSelected ? "#D9A21B" : "#0B4A24",
                fillColor: isSelected ? "#D9A21B" : "#0B4A24",
                fillOpacity: isSelected ? 0.95 : 0.82,
                weight: 2,
              }}
            >
              <Popup>
                <div className="directory-map__popup">
                  <p className="directory-map__popup-denomination">{church.denomination}</p>
                  <h3>{church.name}</h3>
                  <p>{formatAddress(church.address)}</p>
                  {primaryServiceTime ? (
                    <p>
                      <strong>Service:</strong> {primaryServiceTime.label}
                    </p>
                  ) : null}
                  <div className="directory-map__popup-actions">
                    <Link href={buildChurchProfilePath(church.slug)}>View church</Link>
                    <Link
                      href={buildDirectionsUrl(church.address)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Directions
                    </Link>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
