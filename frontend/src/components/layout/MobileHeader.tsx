"use client";
import { DropdownMenu } from "@radix-ui/react-dropdown-menu";
import { AlignJustify, EllipsisVertical, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { PiDotsThreeOutlineVerticalFill } from "react-icons/pi";
import SpeedComponent from "./components/ServerSpeed";
interface IMobileHeaderProps {
  onMenuClick: () => void;
  // onPlusClick: () => void;
}

const MobileHeader: React.FC<IMobileHeaderProps> = ({ onMenuClick }) => {
  return (
    <div className='flex w-full h-full items-center justify-between bg-primary-light sticky top-0 z-20 px-4 py-5'>
      <button onClick={onMenuClick} className="">
        <Image
          src="/icons/menu_icon.svg"
          alt="menu"
          height={28}
          width={28}
        />
      </button>
      <div className="flex relative items-center gap-x-2">
        <Image
          src="/images/logo_ia.svg"
          alt="logo"
          priority
          height={30}
          width={30}
        />
        <h2 className="text-2xl leading-normal tracking-normal font-medium">
          Insight Agent
        </h2>
        <div className="absolute translate-x-1/2  -bottom-4">
          <SpeedComponent />
        </div>
      </div>
      <div className="flex items-center gap-x-2">
        <Link href="/" className="">
          <Plus className="size-6" />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <PiDotsThreeOutlineVerticalFill className="size-6" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-primary-light p-3.5 mr-4 mt-6 rounded-xl">

            <DropdownMenuItem className="flex gap-x-2 items-center font-medium cursor-pointer">
              <Image
                src="/icons/share_icon.svg"
                alt="icon"
                height={20}
                width={20}
                priority
              />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem className="flex gap-x-1.5 items-center font-medium cursor-pointer">
              <Image
                src="/icons/download_icon.svg"
                alt="icon"
                height={20}
                width={20}
                priority
              />
              Download
            </DropdownMenuItem>

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

      </div>
    </div>
  )
}

export default MobileHeader
