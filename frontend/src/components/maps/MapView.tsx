"use client"

import React, { useState, useEffect } from 'react';
import { Map } from 'react-map-gl/maplibre';
import { AmbientLight, PointLight, LightingEffect, Color } from '@deck.gl/core';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { DeckGL } from '@deck.gl/react';
import { IMapDataPoint } from '@/types/map-view';

// Source data CSV
const DATA_URL = 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/3d-heatmap/heatmap-data.csv';

const ambientLight = new AmbientLight({
  color: [255, 255, 255],
  intensity: 1.0
});

const pointLight1 = new PointLight({
  color: [255, 255, 255],
  intensity: 0.8,
  position: [-0.144528, 49.739968, 80000]
});

const pointLight2 = new PointLight({
  color: [255, 255, 255],
  intensity: 0.8,
  position: [-3.807751, 54.104682, 8000]
});


const lightingEffect = new LightingEffect({ ambientLight, pointLight1, pointLight2 });



const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

const colorRange: Color[] = [
  [1, 152, 189],
  [73, 227, 206],
  [216, 254, 181],
  [254, 237, 177],
  [254, 173, 84],
  [209, 55, 78]
];

// function getTooltip({  }) {
//   if (!object) {
//     return null;
//   }
//   const lat = object.position[1];
//   const lng = object.position[0];
//   const count = object.count;
//   return `
//     latitude: ${Number.isFinite(lat) ? lat.toFixed(6) : ''}
//     longitude: ${Number.isFinite(lng) ? lng.toFixed(6) : ''}
//     ${count} Accidents`;
// }

interface MapViewProps {
  hexagonData: IMapDataPoint[]; // Optional prop for hexagon data
}

const MapView: React.FC<MapViewProps> = ({ hexagonData }) => {


  const mapStyle = MAP_STYLE;



  const INITIAL_VIEW_STATE = {
    longitude: hexagonData[0].COORDINATES[1],
    latitude: hexagonData[0].COORDINATES[0],
    zoom: 6.6,
    minZoom: 5,
    maxZoom: 15,
    pitch: 40.5,
    bearing: -27
  };



  const layers = [
    new HexagonLayer({

      id: 'hexagon-layer',
      data: hexagonData,
      pickable: true,
      upperPercentile: 100,
      extruded: true,
      radius: 10000,
      elevationScale: 50,
      getPosition: (d: IMapDataPoint) => [d.COORDINATES[1], d.COORDINATES[0]], // [longitude, latitude]
      coverage: 1,
      getElevationScale: (d: IMapDataPoint) => d.NUMERICAL_DATA || 1,
      getElevationWeight: (d: IMapDataPoint) => d.NUMERICAL_DATA || 1,
      getColorWeight: d => d.NUMERICAL_DATA || 0,
      getFillColor: (d: IMapDataPoint) => {
        const value = d.NUMERICAL_DATA;
        if (value < 10) {
          return [0, 140, 255]; // Blue color for low values
        } else if (value < 20) {
          return [255, 255, 0]; // Yellow color for medium values
        } else {
          return [255, 0, 0];
         }}, // Red color for high values
      material: {
        ambient: 0.64,
        diffuse: 0.6,
        shininess: 32,
        specularColor: [51, 51, 51]
      },
      transitions: {
        elevationScale: 3000
      }


    })
  ]

  return (
    <div className="w-full relative 2xl:h-[62dvh] h-[50vh] rounded-2xl overflow-hidden">

      <DeckGL
        layers={layers}
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        //   getTooltip={getTooltip}
        effects={[lightingEffect]}
      >
        <Map mapStyle={mapStyle} />
      </DeckGL>

    </div>
  );
}

export default React.memo(MapView);