import React from 'react';

interface TimePeriodTabsProps {
  symbol: string;
  selectedPeriod: string;
  onPeriodChange: (period: string, symbol: string) => void;
}

const TimePeriodTabs: React.FC<TimePeriodTabsProps> = ({ symbol, selectedPeriod, onPeriodChange }) => {
  const periods = ['1M', '3M', '6M', 'YTD', '1Y', '5Y', 'MAX'];

  function handle(period: string) {
    onPeriodChange(period, symbol);
  }
  
  
  return (
    <div className="flex border-b border-gray-200 overflow-x-auto pb-1 mb-3">
      {periods.map((period) => (
        <div
          key={period}
          className={`time-period-tab ${selectedPeriod === period ? 'active' : ''} xs:text-xs text-[9px] leading-normal`}
          onClick={() => handle(period)}
        >
          {period}
        </div>
      ))}
    </div>
  );
};

export default TimePeriodTabs;
