"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";
import loadConfig from "next/dist/server/config";

interface StockData {
  date: string;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  volume: string | number;
  timestamp?: string;
}

interface StockChartProps {
  data: StockData[];
  isPositive: boolean;
  loading: boolean;
  symbol: string;
  period: string;
}

const CustomTooltip = ({ active, payload, label, symbol }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2 border rounded-md border-gray-200 shadow-md text-sm">
        <p className="font-medium">{symbol}</p>
        {/* <p className="text-gray-700">{`${Number(payload[0].value).toFixed(2)}`}</p> */}
        <p className="text-gray-700 text-xs font-semibold">
          High: {`${Number(payload[0].payload.high).toFixed(2)}`}
        </p>
        <p className="text-gray-700 text-xs font-semibold">
          Low: {`${Number(payload[0].payload.low).toFixed(2)}`}
        </p>
        <p className="text-gray-700 text-xs font-semibold">
          Open: {`${Number(payload[0].payload.open).toFixed(2)}`}
        </p>
        <p className="text-gray-700 text-xs font-semibold">
          Close: {`${Number(payload[0].payload.close).toFixed(2)}`}
        </p>

        <p className="text-gray-600 text-xs">{label}</p>
      </div>
    );
  }

  return null;
};

const StockChart: React.FC<StockChartProps> = ({
  data,
  isPositive,
  loading,
  symbol,
  period,
}) => {
  const isMobile = useIsMobile();
  const [chartWidth, setChartWidth] = useState(0);
  const [chartHeight, setChartHeight] = useState(0);
  const chartColor = isPositive ? "#22c55e" : "#ef4444"; // Green / Red

  useEffect(() => {
    const updateDimensions = () => {
      const container = document.querySelector(".chart-container");
      if (container) {
        setChartWidth(container.clientWidth);
        setChartHeight(container.clientHeight);
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    return () => {
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  const chartData = useMemo(() => {
    return data.map((item) => ({
      date: typeof item.timestamp === "string" ? item.timestamp : item.date,
      value:
        typeof item.close === "string"
          ? parseFloat(item.close.replace(/,/g, ""))
          : item.close,
      close:
        typeof item.close === "string"
          ? parseFloat(item.close.replace(/,/g, ""))
          : item.close,
      open:
        typeof item.open === "string"
          ? parseFloat(item.open.replace(/,/g, ""))
          : item.open,
      high:
        typeof item.high === "string"
          ? parseFloat(item.high.replace(/,/g, ""))
          : item.high,
      low:
        typeof item.low === "string"
          ? parseFloat(item.low.replace(/,/g, ""))
          : item.low,
      volume:
        typeof item.volume === "string"
          ? parseFloat(item.volume.replace(/,/g, ""))
          : item.volume,
    }));
  }, [data]);

  const maxValue = useMemo(() => {
    const max = Math.max(...chartData.map((item) => item.value));
    return max < 10
      ? parseFloat((Math.ceil((max + 0.0005) * 1000) / 1000).toFixed(3))
      : parseFloat((Math.ceil((max + 0.005) * 100) / 100).toFixed(2));
  }, [chartData]);

  const minValue = useMemo(() => {
    const min = Math.min(...chartData.map((item) => item.value));
    return maxValue < 10
      ? parseFloat((Math.floor(min * 1000) / 1000).toFixed(3))
      : parseFloat((Math.floor(min * 100) / 100).toFixed(2));
  }, [chartData, maxValue]);

  const yAxisTicks = useMemo(() => {
    const isSmallRange = maxValue < 10;
    const stepSize = (maxValue - minValue) / 4;

    return Array.from({ length: 5 }, (_, i) =>
      parseFloat((minValue + i * stepSize).toFixed(isSmallRange ? 3 : 2))
    );
  }, [minValue, maxValue]);

  // Generate tick values for the x-axis based on data length
  const xAxisTicks = useMemo(() => {
    const dataLength = chartData.length;
    const tickCount = isMobile ? 3 : 5;
    const step = Math.floor(dataLength / (tickCount - 1));
    const ticks = [];

    for (let i = 0; i < tickCount; i++) {
      const index = i * step;
      if (index < dataLength) {
        ticks.push(index);
      }
    }

    // Ensure the last tick is the last data point
    if (ticks[ticks.length - 1] !== dataLength - 1) {
      ticks.push(dataLength - 1);
    }
    return ticks;
  }, [chartData.length, isMobile]);

  const gradientId = useMemo(() => {
    return `areaGradient-${isPositive ? "positive" : "negative"}`;
  }, [isPositive]);

  return (
    <div
      className="chart-container"
      style={{
        width: "100%",
        height: "240px",
        minHeight: "240px",
        minWidth: "100%",
        display: "block",
      }}
    >
      {loading ? (
        <EnhancedChartSkeleton />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity={0.8} />
                <stop offset="100%" stopColor="white" stopOpacity={0.8} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              horizontal
              strokeDasharray="3 3"
              stroke="#E0E0E0"
            />

            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              ticks={xAxisTicks.map((idx) => chartData[idx]?.date)}
              tick={{ fontSize: 12, fill: "#666" }}
              tickFormatter={(value) => {
                const date = new Date(value);

                if (period === "1MO" || period === "3MO") {
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  }); // Apr 3
                } else if (["6MO", "YTD", "1Y"].includes(period)) {
                  return date.toLocaleDateString("en-US", { month: "short" }); // Apr
                } else if (["5Y", "MAX"].includes(period)) {
                  return date.getFullYear(); // 2023
                }

                return value;
              }}
            />

            <YAxis
              domain={[minValue, maxValue]}
              axisLine={false}
              tickLine={false}
              ticks={yAxisTicks}
              tickFormatter={(value) => `${value}`}
              tick={{ fontSize: 12, fill: "#666" }}
              interval={0} // force all ticks to be rendered exactly
            />

            <Tooltip content={<CustomTooltip symbol={symbol} />} />

            <Area
              type="monotone"
              dataKey="value"
              fill={`url(#${gradientId})`}
              stroke={chartColor}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default React.memo(StockChart);

export const EnhancedChartSkeleton = () => {
  return (
    <div className="h-full w-full p-4 space-y-4 animate-pulse bg-gray-300 rounded-md">
      {/* Chart title and legend area */}
    </div>
  );
};

// Add this to your global CSS or tailwind config
// .animate-shimmer {
//   animation: shimmer 2s infinite linear;
// }
// @keyframes shimmer {
//   0% { transform: translateX(-100%); }
//   100% { transform: translateX(100%); }
// }
