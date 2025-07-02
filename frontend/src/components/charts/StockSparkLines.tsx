"use client"

import React from "react";
import {
  Sparklines,
  SparklinesLine,
} from "react-sparklines";


function darkenHexColor(hex: string, amount = 20) {
  let color = hex.startsWith('#') ? hex.slice(1) : hex;
  if (color.length === 3) {
    color = color.split('').map(c => c + c).join('');
  }

  const num = parseInt(color, 16);
  let r = Math.max(0, (num >> 16) - amount);
  let g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
  let b = Math.max(0, (num & 0x0000FF) - amount);

  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

const StockSparkLines: React.FC<{ data: number[]; fillColor: string }> = ({
  data,
  fillColor,
}) => {
  const darkerStroke = darkenHexColor(fillColor, 30);

  return (
    // parent must have width, here we take full width of container
    <div className="xs:w-32 w-24">
      <Sparklines data={data} height={40}>
        <SparklinesLine style={{ stroke: darkerStroke, fill: fillColor, fillOpacity: "0.5" }} />
      </Sparklines>
    </div>
  );
};

export default React.memo(StockSparkLines);
