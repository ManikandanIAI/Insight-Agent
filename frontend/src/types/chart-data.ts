export interface IChartData {
  date: string;
  high: number;
  low: number;
  close: number;
  type: "historical" | "predicted";
  ticker: string;
}