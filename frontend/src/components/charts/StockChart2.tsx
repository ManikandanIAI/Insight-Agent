"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import React, { useEffect, useMemo, useState } from "react";
import {
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Customized,
    Area,
    ComposedChart,
} from "recharts";
import { motion } from "framer-motion";

interface IChartData {
    date: string;
    high: string | number;
    low: string | number;
    close: number;
    volume?: string | number;
    type?: "historical" | "predicted";
}

interface StockChartProps {
    data: IChartData[];
    isPositive: boolean;
    loading: boolean;
    symbol: string;
    period?: string;
}

const CustomTooltip = ({ active, payload, label, symbol, setShowLastPredicted, showLastPredicted }: any) => {

    useEffect(() => {
        if (active && payload?.[0]?.payload?.isLastPredicted) {
            setShowLastPredicted(true);
        } else {
            setShowLastPredicted(false);
        }
    }, [active, payload, setShowLastPredicted]);

    if (active && payload && payload.length) {
        const data = payload[0].payload;
        if (data.type === "predicted" && data.isLastPredicted) {
            return null;
        }
        return (
            <div className="bg-white p-2 border rounded-md border-gray-200 shadow-md text-sm">
                <p className="font-medium">{symbol}</p>
                <p className="text-gray-700 text-xs font-semibold">
                    High: {Number(data.high || 0).toFixed(2)}
                </p>
                <p className="text-gray-700 text-xs font-semibold">
                    Low: {Number(data.low || 0).toFixed(2)}
                </p>
                <p className="text-gray-700 text-xs font-semibold">
                    Open: {Number(data.open || 0).toFixed(2)}
                </p>
                <p className="text-gray-700 text-xs font-semibold">
                    Close: {Number(data.close || 0).toFixed(2)}
                </p>
                <p className="text-gray-600 text-xs">{label}</p>
            </div>
        );
    }
    return null;
};

const StockChart2: React.FC<StockChartProps> = ({
    data,
    isPositive,
    loading,
    symbol,
    period,
}) => {
    const chartColor = isPositive ? "#51CE72" : "#ef4444";
    const [showLastPredicted, setShowLastPredicted] = useState(false);
    const [step, setStep] = useState(0); // State to hold step size for Y-axis domain
    const isMobile = useIsMobile();


    // Process data for chart
    const chartData = useMemo(() => {
        const processedData = data.map((item) => ({
            ...item,
            historical: item.type === "historical" ? item.close : null,
            predicted: item.type === "predicted" ? item.close : null,
        }));

        // Find the transition point between historical and predicted data
        const lastHistoricalIndex = processedData.findLastIndex(item => item.type === "historical");
        const firstPredictedIndex = processedData.findIndex(item => item.type === "predicted");

        // If we have both historical and predicted data, create a connecting point
        if (lastHistoricalIndex !== -1 && firstPredictedIndex !== -1) {
            // Add the last historical value to the predicted line to create continuity
            processedData[lastHistoricalIndex].predicted = processedData[lastHistoricalIndex].close;
        }

        return processedData;
    }, [data]);

    const transformedData = chartData.map((d, index, arr) => {
        const isLastHistorical =
            d.type === "historical" &&
            index === arr.findLastIndex((item) => item.type === "historical");


        const lastPredictedIndex = chartData.findLastIndex(item => item.type === "predicted");

        const isLastPredicted = index === lastPredictedIndex;

        const isPredictedOrEdge = d.type === "predicted" || isLastHistorical;
        const predicted = isPredictedOrEdge ? Number(d.close) : null;

        let band = null, bandLow = null;
        if (d.type === "historical" && isLastHistorical) {
            band = [d.close, d.close];
            bandLow = [d.close, d.close];
        } else if (d.type === "predicted") {
            band = [d.close, d.high];
            bandLow = [d.close, d.low];
        }



        const high = d.type === "predicted"
            ? Number(d.high)
            : isLastHistorical
                ? Number(d.close)
                : null;

        const low = d.type === "predicted"
            ? Number(d.low)
            : isLastHistorical
                ? Number(d.close)
                : null;

        return {
            ...d,
            predicted,
            predictedHigh: high,
            predictedLow: low,
            band, // Array for AreaChart
            bandLow,
            isLastPredicted
        };
    });




    const { minY, maxY } = getMinMax(transformedData, [
        'low', 'high'
    ]);


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

    // Calculate Y-axis domain
    const yAxisTicks = useMemo(() => {
    const isSmallRange = maxY < 10;
    const stepSize = (maxY - minY) / 4;

    // Save stepSize for domain expansion
    setStep(stepSize); // optional if you need it in domain

    return Array.from({ length: 7 }, (_, i) =>
        parseFloat((minY - stepSize + i * stepSize).toFixed(isSmallRange ? 3 : 2))
    );
}, [minY, maxY]);


    // If loading, show skeleton
    if (loading) {
        console.log("Chart is loading...");
        return <EnhancedChartSkeleton />;
    }


    function getMinMax(data: any[], keys: string[]): { minY: number; maxY: number } {
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;

        data.forEach((item) => {
            keys.forEach((key) => {
                const value = Number(item[key]);
                if (!isNaN(value)) {
                    if (value < min) min = value;
                    if (value > max) max = value;
                }
            });
        });

        return {
            minY: min === Number.POSITIVE_INFINITY ? 0 : min,
            maxY: max === Number.NEGATIVE_INFINITY ? 0 : max,
        };
    }


    const CustomTooltipCard: React.FC<{ name: string; value: number | string; textColor: string }> = ({ name, value, textColor }) => {
        return (
            <div className={`px-3 py-1 rounded-full shadow-md border border-gray-200 text-xs font-semibold ${textColor} bg-white`}>
                {name}: <span className="font-bold">${value}</span>
            </div>
        );
    };

    const LastPredictedCards = ({ data, xAxisMap, yAxisMap }: any) => {
        const lastIndex = data.findLastIndex((d: any) => d.type === "predicted");
        if (lastIndex === -1) return null;
        const point = data[lastIndex];

        const xScale = (Object.values(xAxisMap)[0] as { scale: (value: any) => number })?.scale;
        const yScale = (Object.values(yAxisMap)[0] as { scale: (value: any) => number })?.scale;
        if (!xScale || !yScale) return null;

        const cx = xScale(point.date);

        return (
            <>
                <foreignObject x={cx - 200} y={yScale(point.close) - 30} width={200} height={40}>
                    <CustomTooltipCard name="Forecasted Price" value={point.close} textColor="text-[#8B2B52]" />
                </foreignObject>
                <foreignObject x={cx - 200} y={yScale(point.high)} width={200} height={40}>
                    <CustomTooltipCard name="Upper Limit" value={point.high} textColor="text-green-500" />
                </foreignObject>
                <foreignObject x={cx - 200} y={yScale(point.low) - 30} width={200} height={40}>
                    <CustomTooltipCard name="Lower Limit" value={point.low} textColor="text-red-500" />
                </foreignObject>
            </>
        );
    };

    return (
        <div className="w-96 h-60 min-h-60 relative" style={{ minWidth: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                    data={transformedData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />

                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        ticks={xAxisTicks.map((idx) => transformedData[idx]?.date)}
                        tick={{ fontSize: 12, fill: "#666" }}
                        tickFormatter={(value) => {
                            const date = new Date(value);
                            return date.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                            });
                        }}
                    />

                    <YAxis
                        yAxisId="left"
                        domain={[minY-step, maxY-step]}
                        axisLine={false}
                        tickLine={false}
                        ticks={yAxisTicks}
                        tickFormatter={(value) => `${value}`}
                        tick={{ fontSize: 12, fill: "#666" }}
                        interval={0}
                    />

                    <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="band"
                        fill="#51CE72"
                        stroke="none"
                        fillOpacity={0.2}
                    />
                    <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="bandLow"
                        fill="red"
                        stroke="none"
                        fillOpacity={0.2}
                    />
                    <Tooltip content={<CustomTooltip symbol={symbol} setShowLastPredicted={setShowLastPredicted} showLastPredicted={showLastPredicted} />} />

                    <Customized
                        component={({ xAxisMap, yAxisMap, data }: any) => {
                            const xKey = "date";
                            const yKey = "close";

                            const lastPredictedIndex = data.findLastIndex((d: any) => d.type === "historical");
                            if (lastPredictedIndex === -1) return null;

                            const point = data[lastPredictedIndex];
                            const xScale = (Object.values(xAxisMap)[0] as { scale: (value: any) => number })?.scale;
                            const yScale = (Object.values(yAxisMap)[0] as { scale: (value: any) => number })?.scale;

                            if (!xScale || !yScale) return null;

                            const cx = xScale(point[xKey]);
                            const cy = yScale(point[yKey]);

                            return (
                                <foreignObject x={cx - 15} y={cy - 15} width={30} height={30}>
                                    <svg width="30" height="30" viewBox="0 0 30 30">
                                        <motion.circle
                                            cx="15"
                                            cy="15"
                                            r="10"
                                            fill="#51CE72"
                                            initial={{ scale: 1, opacity: 1 }}
                                            animate={{ scale: [1, 1.6], opacity: [1, 0] }}
                                            transition={{
                                                repeat: Infinity,
                                                duration: 1.2,
                                                ease: "easeInOut",
                                            }}
                                        />
                                        <circle cx="15" cy="15" r="5" fill="#51CE72" />
                                    </svg>
                                </foreignObject>
                            );
                        }}
                    />

                    {/* Historical line (if data has type field) */}
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="historical"
                        stroke={chartColor}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={true}

                    />

                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="predicted"
                        stroke="#8B2B52"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                        connectNulls
                        name="Predicted Line"
                    />

                    {showLastPredicted && (
                        //@ts-ignore
                        <Customized component={(props) => <LastPredictedCards {...props} />} />
                    )}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

const EnhancedChartSkeleton = () => {
    return (
        <div className="w-full h-60 p-4 animate-pulse bg-gray-200 rounded-md flex items-center justify-center">
            <span className="text-gray-500">Loading chart...</span>
        </div>
    );
};

export default React.memo(StockChart2);