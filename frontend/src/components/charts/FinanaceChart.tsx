"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import StockHeader from "./StockHeader";
import TimePeriodTabs from "./TimePeriodTabs";
import StockChart from "./StockChart";
import StockDetails from "./StockDetails";
import { motion, AnimatePresence } from "framer-motion";
import { BsChevronDown } from "react-icons/bs";
import { cn } from "@/lib/utils";
import StockSparkLines from "./StockSparkLines";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import HistoricalIcon from "../icons/HistoricalIcon";
import PredictiveIcon from "../icons/PredictiveIcon";
import { toast } from "sonner";
import ApiServices from "@/services/ApiServices";
import { IChartData } from "@/types/chart-data";
import { set } from "lodash";
import StockChart2 from "./StockChart2";
export interface RealTimeData {
  symbol: string;
  currency: string;
  name: string;
  price: number;
  changesPercentage: number;
  change: number;
  dayLow: number;
  dayHigh: number;
  yearHigh: number;
  yearLow: number;
  marketCap: number;
  priceAvg50: number;
  priceAvg200: number;
  exchange: string;
  volume: number;
  avgVolume: number;
  open: number;
  previousClose: number;
  eps: number;
  pe: number;
  earningsAnnouncement: string;
  sharesOutstanding: number;
  timestamp: number;
}

interface HistoricalData {
  date: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface IFinanceData {
  realtime: RealTimeData;
  historical: {
    data: HistoricalData[];
    source: string;
  };
}

export interface FinanceChartProps {
  messageId: string
  data: IFinanceData[];
  onSelectedPeriodChange?: (period: string) => void;
  loading: boolean;
}




interface IActiveTabInterface {
  symbol: string;
  activeTab: "historical" | "prediction";
}

interface IPredictedChartData {
  symbol: string;
  data: IChartData[];
}

const FinanceChart: React.FC<FinanceChartProps> = ({
  messageId,
  data,
  onSelectedPeriodChange,
  loading,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState("1M");
  const [openSpecificChart, setOpenSpecificChart] = useState<string[]>([]);
  const [currentLoadingSymbolData, setCurrentLoadingSymbolData] = useState<string | null>(null);
  const [predictedChartData, setPredictedChartData] = useState<IPredictedChartData[]>([]); // Adjust type as needed
  const [predictedChartDataLoading, setPredictedChartDataLoading] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<IActiveTabInterface[]>([]);

  console.log("data in FinanceChart:", data);
  useEffect(() => {
    setOpenSpecificChart([data[0].realtime.symbol]);

    console.log("data in FinanceChart:", data);
    setActiveTab(() => {
      return data.map((item) => ({
        symbol: item.realtime.symbol,
        activeTab: "historical", // Default to historical for all symbols
      }));
    });

  }, []);



  const handlePeriodChange = (period: string, symbol: string) => {
    setSelectedPeriod(period);
    setCurrentLoadingSymbolData(symbol);
    // Call the parent component's function if provided
    if (onSelectedPeriodChange) onSelectedPeriodChange(period);
  };



  // Format the date with time for the update timestamp
  const currentDate = new Date();
  const hours = currentDate.getHours();
  const minutes = currentDate.getMinutes();
  const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
  const options: Intl.DateTimeFormatOptions = { month: "short" };
  const month = new Intl.DateTimeFormat("en-US", options).format(currentDate);
  const formattedDate = `${currentDate.getDate()} ${month}, ${formattedTime} GMT+5:30`;

  const handleOpenSpecificChart = (symbol: string) => {
    if (openSpecificChart.includes(symbol)) {
      setOpenSpecificChart((prev) => prev.filter((item) => item !== symbol));
    } else {
      setOpenSpecificChart((prev) => [...prev, symbol]);
    }
  };

  const handlePredictiveChartData = async (symbol: string, exchange: string) => {
    try {
      console.log("Fetching predictive chart data for symbol:", symbol, predictedChartData);
      if (predictedChartData.some((item) => item.symbol === symbol)) {
        return; // If data for this symbol is already fetched, do nothing
      } else {
        setPredictedChartDataLoading((prev) => [...prev, symbol]);
        const response = await ApiServices.getStockPredictionData(symbol, exchange, messageId);
        setPredictedChartData((prev) => [...prev, { symbol: symbol, data: response.data.combined_chart || [] }]);
      }
    } catch (error: any) {
      console.log("error in handlePredictiveChartData:", error);
      toast.error(error?.response?.data?.detail || "Failed to fetch predictive chart data");
    } finally {
      setPredictedChartDataLoading((prev) => prev.filter((item) => item !== symbol));
    }
  };


  const handleActiveTab = (value: string,  symbol: string, exchange: string) => {

    setActiveTab((prev) =>
      prev.map((tab) =>
        tab.symbol === symbol ? { ...tab, activeTab: value === "historical" ? "historical" : "prediction" } : tab
      ));
    if (value === "prediction") {
      handlePredictiveChartData(symbol, exchange);
    }
  };
  return (
      <div className="space-y-3">
        {data.map((chartData, index) => {
          const isPositive = chartData.realtime.changesPercentage > 0;
          const realtimeData = chartData.realtime;
          const historicalData = chartData.historical?.data;

          const isOpen = openSpecificChart.includes(realtimeData.symbol);
          return (


            // In your component...
            <div
              key={index}
              className="overflow-hidden rounded-xl bg-[rgba(var(--financial-bg))]"
            >
              <div
                onClick={() => handleOpenSpecificChart(chartData.realtime.symbol)}
                className="p-4 cursor-pointer flex justify-between items-center"
              >
                <div className="flex items-center gap-x-3 text-sm font-semibold leading-normal tracking-normal text-black">


                  {!isOpen && (
                    <div className="flex items-center gap-x-2">


                      <div className={cn(
                        "flex xs:flex-row flex-col xs:text-sm text-xs gap-x-2 gap-y-1 xs:w-40 w-20",
                        isPositive ? "text-green-500" : "text-red-500"
                      )}>
                        <p>{chartData.realtime.price.toFixed(2)}</p>

                        <span className="font-normal">
                          {isPositive
                            ? `+${chartData.realtime.change}`
                            : chartData.realtime.change}{" "}
                          ({chartData.realtime.changesPercentage.toFixed(2)}%)
                        </span>
                      </div>

                      <StockSparkLines
                        data={historicalData.map((day) => parseFloat(day.close.replace(',', '')))}
                        fillColor={isPositive ? "#22c55e" : "#ef4444"}
                      />


                    </div>

                  )}
                  <h2 className={cn(!isOpen && "xs:text-sm text-xs")}>{chartData.realtime.name}</h2>

                </div>

                <div>
                  <BsChevronDown
                    className={cn(
                      "text-black size-5 cursor-pointer transition-transform",
                      openSpecificChart.includes(chartData.realtime.symbol) ? "rotate-180" : ""
                    )}
                  />
                </div>
              </div>

              <AnimatePresence>
                {openSpecificChart.includes(chartData.realtime.symbol) && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="px-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs text-gray-500">
                        Updated {formattedDate}
                      </div>
                    </div>

                    <StockHeader
                      symbol={realtimeData.symbol}
                      exchange={realtimeData.exchange}
                      currency={realtimeData.currency}
                      name={realtimeData.name}
                      price={realtimeData.price}
                      changesPercentage={realtimeData.changesPercentage}
                      change={realtimeData.change}
                    />




                    <Tabs value={activeTab.find((tab) => tab.symbol === realtimeData.symbol)?.activeTab} onValueChange={(value) => handleActiveTab(value, realtimeData.symbol, realtimeData.exchange)} className="w-full mb-2">

                      <TabsList className="bg-primary-light rounded-lg px-1.5 py-2">
                        <TabsTrigger className="data-[state=active]:text-primary-main text-sm font-medium px-2 flex items-center gap-x-1" value={`historical`}><HistoricalIcon isActive={activeTab.find((tab) => tab.symbol === realtimeData.symbol)?.activeTab === "historical"} /> Live/historical Data</TabsTrigger>
                        <TabsTrigger className="data-[state=active]:text-primary-main text-sm font-medium px-2 flex items-center gap-x-1" value={`prediction`}><PredictiveIcon isActive={activeTab.find((tab) => tab.symbol === realtimeData.symbol)?.activeTab === "prediction"} /> Price Forecast</TabsTrigger>
                      </TabsList>
                      <TabsContent value="historical">
                        <TimePeriodTabs
                          symbol={realtimeData.symbol}
                          selectedPeriod={selectedPeriod}
                          onPeriodChange={handlePeriodChange}
                        />

                        <StockChart
                          data={historicalData}
                          isPositive={isPositive}
                          loading={loading && currentLoadingSymbolData === realtimeData.symbol}
                          symbol={realtimeData.symbol}
                          period={selectedPeriod}
                        />
                      </TabsContent>

                      <TabsContent value="prediction">


                        <StockChart2
                          data={predictedChartData.find((item) => item.symbol === realtimeData.symbol)?.data || []}
                          isPositive={isPositive}
                          loading={predictedChartDataLoading.includes(realtimeData.symbol)}
                          symbol={realtimeData.symbol}
                        // period={selectedPeriod}
                        />
                      </TabsContent>

                    </Tabs>





                    <StockDetails
                      open={realtimeData.open}
                      high={realtimeData.dayHigh}
                      low={realtimeData.dayLow}
                      marketCap={realtimeData.marketCap}
                      peRatio={realtimeData.pe}
                      volume={realtimeData.volume}
                      yearHigh={realtimeData.yearHigh}
                      yearLow={realtimeData.yearLow}
                    />

                    <div className="mb-4 text-center">
                      <a
                        target="_blank"
                        href={data[0].historical.source}
                        className="text-primary-main text-xs"
                      >
                        More about {realtimeData.symbol} →
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
  );
};

export default React.memo(FinanceChart);
