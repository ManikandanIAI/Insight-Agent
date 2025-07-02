"use client";


import React from 'react';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface StockDetailsProps {
  open: number;
  high: number;
  low: number;
  marketCap: number;
  peRatio: number;
  volume: number;
  yearHigh: number;
  yearLow: number;
}

const StockDetails: React.FC<StockDetailsProps> = ({
  open,
  high,
  low,
  marketCap,
  peRatio,
  volume,
  yearHigh,
  yearLow
}) => {
  return (
    <div className="stock-details-grid">
      <div className="stock-detail-item">
        <span className="stock-detail-label">Open</span>
        <span className="stock-detail-value">{open.toFixed(2)}</span>
      </div>
      
      <div className="stock-detail-item">
        <span className="stock-detail-label">High</span>
        <span className="stock-detail-value">{high.toFixed(2)}</span>
      </div>
      
      <div className="stock-detail-item">
        <span className="stock-detail-label">Low</span>
        <span className="stock-detail-value">{low.toFixed(2)}</span>
      </div>
      
      <div className="stock-detail-item">
        <span className="stock-detail-label">Market Cap</span>
        <span className="stock-detail-value">{formatNumber(marketCap)}</span>
      </div>
      
      <div className="stock-detail-item">
        <span className="stock-detail-label">P/E Ratio</span>
        <span className="stock-detail-value">{peRatio.toFixed(2)}</span>
      </div>
      
      <div className="stock-detail-item">
        <span className="stock-detail-label">Volume</span>
        <span className="stock-detail-value">{formatNumber(volume)}</span>
      </div>
      
      <div className="stock-detail-item">
        <span className="stock-detail-label">Year High</span>
        <span className="stock-detail-value">{yearHigh.toFixed(2)}</span>
      </div>
      
      <div className="stock-detail-item">
        <span className="stock-detail-label">Year Low</span>
        <span className="stock-detail-value">{yearLow.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default StockDetails;
