import { Ellipsis, FileDown, Share2 } from 'lucide-react'
import React from 'react';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import Image from 'next/image';


interface HeaderProps {
  heading: string
}
const Header: React.FC<HeaderProps> = ({ heading }) => {
  const truncatedHeading =
    heading.length > 150 ? heading.slice(0, 150) + '...' : heading
  return (
    <div className="hidden lg:flex md:h-[80px] h-auto ml-4 lg:ml-0 border-b border-primary-100 w-full justify-between py-6 px-9 ">
      <div className="flex items-center gap-x-4">
        <h2 className="text-black text-lg font-medium leading-normal">
          {truncatedHeading}
        </h2>
        <span className="text-black text-lg font-semibold">/</span>
        <span className="text-[#9C8D91] text-lg font-medium leading-normal">
          + Finverse
        </span>
      </div>
      <div className="flex items-center gap-x-6">
        <div className="flex items-center gap-x-3.5">
          <DropdownMenu>
            <DropdownMenuTrigger className='focus:border-none'>
              <Ellipsis className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-primary-light p-3.5 rounded-xl">




              <DropdownMenuItem className="flex gap-x-1.5 items-center font-medium cursor-pointer">
                <Image
                  src="/icons/delete_icon.svg"
                  alt="icon"
                  height={20}
                  width={20}
                  priority
                />
                Delete
              </DropdownMenuItem>



            </DropdownMenuContent>
          </DropdownMenu>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Share2 strokeWidth={1.5} className="cursor-pointer size-[20px]" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Share</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <FileDown strokeWidth={1.5} className="cursor-pointer size-[20px]" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Download</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}

export default Header