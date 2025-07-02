export interface StockData {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    marketCap?: number;
    pe?: number;
    eps?: number;
    color: string;
    volume: number;
  }
  
  export interface HistoricalDataPoint {
    date: string;
    close: number;
  }
  
  const historicalDataBySymbol: { [key: string]: HistoricalDataPoint[] } = {
    AAPL: [
      { date: "Apr 23, 2025", close: 204.60 },
      { date: "Apr 22, 2025", close: 199.74 },
      { date: "Apr 21, 2025", close: 193.16 },
      { date: "Apr 17, 2025", close: 196.98 },
      { date: "Apr 16, 2025", close: 194.27 },
      { date: "Apr 15, 2025", close: 202.14 },
      { date: "Apr 14, 2025", close: 202.52 }
    ],
    MSFT: [
      { date: "Apr 23, 2025", close: 374.39 },
      { date: "Apr 22, 2025", close: 366.82 },
      { date: "Apr 21, 2025", close: 359.12 },
      { date: "Apr 17, 2025", close: 367.78 },
      { date: "Apr 16, 2025", close: 371.61 },
      { date: "Apr 15, 2025", close: 385.73 },
      { date: "Apr 14, 2025", close: 387.81 }
    ],
    GOOGL: [
      { date: "Apr 23, 2025", close: 155.35 },
      { date: "Apr 22, 2025", close: 151.47 },
      { date: "Apr 21, 2025", close: 147.67 },
      { date: "Apr 17, 2025", close: 151.16 },
      { date: "Apr 16, 2025", close: 153.33 },
      { date: "Apr 15, 2025", close: 156.31 },
      { date: "Apr 14, 2025", close: 159.07 }
    ],
    AMZN: [
      { date: "Apr 23, 2025", close: 180.60 },
      { date: "Apr 22, 2025", close: 173.18 },
      { date: "Apr 21, 2025", close: 167.32 },
      { date: "Apr 17, 2025", close: 172.61 },
      { date: "Apr 16, 2025", close: 174.33 },
      { date: "Apr 15, 2025", close: 179.59 },
      { date: "Apr 14, 2025", close: 182.12 }
    ],
    TSLA: [
      { date: "Apr 23, 2025", close: 250.74 },
      { date: "Apr 22, 2025", close: 237.97 },
      { date: "Apr 21, 2025", close: 227.50 },
      { date: "Apr 17, 2025", close: 241.37 },
      { date: "Apr 16, 2025", close: 241.55 },
      { date: "Apr 15, 2025", close: 254.11 },
      { date: "Apr 14, 2025", close: 252.35 }
    ]
  };
  
  export const stocksData: StockData[] = [
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      price: 204.60,
      change: 4.86,
      changePercent: 2.43316,
      marketCap: 3.07,
      pe: 29.35,
      eps: 6.97,
      volume: 52803354,
      color: "#A2AAAD"
    },
    {
      symbol: "MSFT",
      name: "Microsoft Corporation",
      price: 374.39,
      change: 7.57,
      changePercent: 2.06368,
      marketCap: 2.78,
      pe: 30.19,
      eps: 12.4,
      volume: 20501048,
      color: "#00A4EF"
    },
    {
      symbol: "GOOGL",
      name: "Alphabet Inc.",
      price: 155.35,
      change: 3.88,
      changePercent: 2.56156,
      marketCap: 1.91,
      pe: 18.83,
      eps: 8.25,
      volume: 30708238,
      color: "#4285F4"
    },
    {
      symbol: "AMZN",
      name: "Amazon.com, Inc.",
      price: 180.60,
      change: 7.42,
      changePercent: 4.28456,
      marketCap: 1.92,
      pe: 32.72,
      eps: 5.52,
      volume: 62152533,
      color: "#FF9900"
    },
    {
      symbol: "TSLA",
      name: "Tesla, Inc.",
      price: 250.74,
      change: 12.77,
      changePercent: 5.36622,
      marketCap: 0.81,
      pe: 142.47,
      eps: 1.76,
      volume: 147940245,
      color: "#E31937"
    }
  ];
  
  export const getHistoricalData = () => {
    const dates = historicalDataBySymbol.AAPL.map(d => d.date);
    return dates.map(date => {
      const dataPoint: { [key: string]: any } = { date };
      Object.keys(historicalDataBySymbol).forEach(symbol => {
        const data = historicalDataBySymbol[symbol].find(d => d.date === date);
        if (data) {
          dataPoint[symbol] = data.close;
        }
      });
      console.log("data[point", dataPoint)
      return dataPoint;
    });
  };