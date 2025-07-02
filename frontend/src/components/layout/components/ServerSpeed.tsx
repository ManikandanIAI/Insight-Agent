'use client';
import { useEffect, useState } from 'react';

export default function SpeedComponent() {
  const [speedMbps, setSpeedMbps] = useState<number | null>(null);

  useEffect(() => {
    const TEST_URL = '/zero_file_100k.bin';
    const FILE_SIZE_BYTES = 100 * 1024;

    const checkSpeed = async () => {
      try {
        // Clear previous performance entries
        performance.clearResourceTimings();

        const response = await fetch(`${TEST_URL}?_=${Date.now()}`);
        await response.blob();

        // Get the performance entry for this request
        const entries = performance.getEntriesByType('resource');
        const entry = entries.find(e => e.name.includes('zero_file_100k.bin')) as PerformanceResourceTiming | undefined;

        if (entry) {
          // Calculate only the download time (blue bar)
          const downloadTime = entry.responseEnd - entry.responseStart;
          const downloadTimeSeconds = downloadTime / 1000;

          const speedBps = FILE_SIZE_BYTES / downloadTimeSeconds;
          const speedMbps = (speedBps / (1000 * 1000)) * 8;

          console.log('Download time:', downloadTime, 'ms');
          console.log('Total time:', entry.responseEnd - entry.requestStart, 'ms');

          setSpeedMbps(parseFloat(speedMbps.toFixed(2)));
        }
      } catch (err) {
        console.error('Speed test failed:', err);
        setSpeedMbps(null);
      }
    };

    checkSpeed();
    const interval = setInterval(checkSpeed, 2000);
    return () => clearInterval(interval);
  }, []);

  const getColor = () => {
    if (speedMbps === null) return 'bg-gray-400';
    if (speedMbps > 100) return 'bg-green-500';
    if (speedMbps > 10) return 'bg-yellow-400';
    return 'bg-red-500';
  };

  return (
    <main className="flex items-center justify-center gap-2">

      <div className={`sm:size-3.5 size-3 rounded-full ${getColor()}`}></div>
      <div className="sm:text-sm text-xs font-semibold ">
        {speedMbps !== null ? `${speedMbps} Mbps` : 'Checking...'}
      </div>
    </main>
  );
}






