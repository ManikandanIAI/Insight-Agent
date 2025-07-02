import { MapPoint } from '@/lib/types';
import { CalendarDays, DollarSign, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TooltipContentProps {
  point: MapPoint;
}

export default function TooltipContent({ point }: TooltipContentProps) {
  // Format the date if available
  const formattedDate = point.datetime_info 
    ? formatDistanceToNow(new Date(point.datetime_info), { addSuffix: true })
    : null;

  return (
    <div className="space-y-2">
      <div className="font-semibold text-lg">{point.location_name}</div>
      
      {/* IconLayer data */}
      {point.description && (
        <div className="flex gap-2 items-start mt-1">
          <Info className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
          <p className="text-sm">{point.description}</p>
        </div>
      )}
      
      {/* HexagonLayer data */}
      {point.datetime_info && (
        <div className="flex gap-2 items-center mt-1">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{formattedDate}</span>
        </div>
      )}
      
      {point.numerical_data && (
        <div className="flex gap-2 items-center mt-1">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm">
            <span className="font-medium">{point.numerical_data}</span>
            {point.numerical_data_unit && (
              <span className="text-muted-foreground ml-1">{point.numerical_data_unit}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}