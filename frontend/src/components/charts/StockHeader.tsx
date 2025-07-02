"use client";

import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface StockHeaderProps {
  symbol: string;
  exchange: string;
  currency: string,
  name: string;
  price: number;
  changesPercentage: number;
  change: number;
  afterHoursChange?: number;
  afterHoursPercentage?: number;
}

const StockHeader: React.FC<StockHeaderProps> = ({ 
  symbol, 
  exchange,
  currency,
  name, 
  price, 
  changesPercentage, 
  change,
  afterHoursChange,
  afterHoursPercentage
}) => {
  const isPositive = changesPercentage > 0;
  const afterHoursPositive = afterHoursChange && afterHoursChange > 0;

  return (
    <div className="mb-3">
      {/* <div className="flex items-center gap-2 mb-1">
        <div className="text-gray-600 text-sm">Finance</div>
        <div className="text-gray-600 text-sm">/</div>
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium">{name}</span>
        </div>
      </div> */}

      <div className="flex items-center mb-1">
        <div className="flex items-center">
          <span className="text-sm font-medium mr-2">{symbol}:{exchange}</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div>
          <span className="xs:text-2xl text-xl font-bold">{price.toFixed(2)}</span>
          <span className="text-xs text-gray-500 ml-1">{currency}</span>
        </div>
        
        <div className="flex items-center">
          <button className="border border-gray-300 rounded-full px-4 py-1 text-sm mr-2">
            Follow
          </button>
          <button className="border border-gray-300 rounded-full px-2 py-1 text-sm">
            ⋯
          </button>
        </div>
      </div>
      
      <div className="flex items-center xs:text-sm text-xs">
        <span className={`flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          <span className="mr-1">{isPositive ? '+' : ''}{changesPercentage.toFixed(2)}%</span>
        </span>
        <span className="mx-1">·</span>
        <span className={`${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '+' : ''}{change.toFixed(2)}
        </span>
        
        {afterHoursChange && (
          <>
            <div className="ml-2 text-sm">
              <span className="text-gray-600">After Hours</span>{' '}
              <span className={afterHoursPositive ? 'text-green-600' : 'text-red-600'}>
                {afterHoursPositive ? '+' : ''}{afterHoursPercentage?.toFixed(2)}%
              </span>
              <span className="mx-1">·</span>
              <span className={afterHoursPositive ? 'text-green-600' : 'text-red-600'}>
                {afterHoursPositive ? '+' : ''}{afterHoursChange.toFixed(2)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StockHeader;
