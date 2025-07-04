"use client";

import * as React from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@radix-ui/react-popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";


export default function MultiSelectDropdown({
  selected,
  onValueChange,
  data,
}: any) {
  const toggleOption = (option: string) => {
    const newSelected = selected.includes(option)
      ? selected.filter((item: any) => item !== option)
      : [...selected, option];
    onValueChange(newSelected);
  };

  return (
    <div className="w-full h-9">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={"w-full justify-between px-4 py-2 border border-primary-100 bg-[#FCFBFA] rounded-md shadow-sm py-6 px-5"}
          >
            {selected.length > 0 ? selected.join(", ") : <span className="sm:text-base text-xs text-[hsl(var(--muted-foreground))]">Choose Option</span>}
            <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-[var(--radix-popover-trigger-width)] p-2 mt-2 bg-white border border-gray-200 rounded-md shadow-lg z-[100]"
        >
          <div className="px-2 pb-2 text-sm font-medium text-gray-500">
            Choose Option
          </div>
          <hr />
          <div className="space-y-1">
            {data.map((option:string) => (
              <label
                key={option}
                className="flex items-center space-x-2 px-3 py-2 rounded-md cursor-pointer text-[#BAB9B9] hover:bg-accent"
              >
                <Checkbox
                  checked={selected.includes(option)}
                  onCheckedChange={() => toggleOption(option)}
                />
                <span className="text-sm text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
