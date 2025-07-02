import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import Image from 'next/image';

// Define the dropdown item type
export type DropdownItem = {
    id: string;
    label: string;
    src: string;
    onClick?: () => void;
};

// Define the component props
type AccountDropdownProps = {
    items: DropdownItem[];
    triggerElement: React.ReactNode;
    align?: "start" | "end" | "center";
    side?: "top" | "right" | "bottom" | "left";
};

// Define the imperative handle type
export type AccountDropdownHandle = {
    open: () => void;
    close: () => void;
    toggle: () => void;
};

export const AccountDropdown = forwardRef<AccountDropdownHandle, AccountDropdownProps>(
    ({ items, triggerElement, align = "end", side = "bottom" }, ref) => {
        const [open, setOpen] = useState(false);
        

        // Expose methods to parent component
        useImperativeHandle(ref, () => ({
            open: () => setOpen(true),
            close: () => setOpen(false),
            toggle: () => setOpen(prev => !prev)
        }));

        return (
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    {triggerElement}
                </DropdownMenuTrigger>
                <DropdownMenuContent align={align} side={side} className="p-4 shadow-md rounded-xl border-none">
                    {items.map((item) => (
                        <DropdownMenuItem
                            key={item.id}
                            onClick={() => {
                                item.onClick?.();
                                setOpen(false);
                            }}
                            className={`cursor-pointer flex gap-x-4 font-medium py-2 ${item.id !== 'logout' ? 'hover:bg-[#F3F1EE99]' : 'bg-transparent data-[highlighted]:bg-transparent'}`}
                            >
                            {
                                item.id === "logout" ? <button className='w-full text-white mt-5 bg-primary-main rounded-md py-2 text-sm font-semibold leading-normal'>{item.label}</button> : <>
                                    <Image
                                        src={item.src}
                                        alt="icon"
                                        height={16}
                                        width={16}
                                        priority
                                    /> 
                                    
                                    {item.label}
                                </>
                            }
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }
);

