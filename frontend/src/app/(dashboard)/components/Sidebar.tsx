"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import clsx from 'clsx';
import { IoChevronBackOutline } from 'react-icons/io5';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';


interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const router = useRouter();
  const [navigationItems, setNavigationItems] = useState([
    { name: 'My Account', route: "/my-account", src: "/icons/my_account.svg", current: true },
    { name: 'Personalization', route: "/personalization", src: "/icons/personalization2.svg", current: false },
    // { name: 'Integrations', route: "/integrations", src: "/icons/integrations2.svg", current: false },
    // { name: 'Enterprise Solution', route: "/enterprise-solution", src: "/icons/enterprises_solution.svg", current: false },
  ]);


  const handleNavigationClick = (index: number, route: string) => {
    router.push(route); // Navigate to the clicked route
    const updatedItems = navigationItems.map((item, i) => ({
      ...item,
      current: i === index ? true : false, // Set current to true for clicked item
    }));
    setNavigationItems(updatedItems);
    setSidebarOpen(false); // Close sidebar on navigation click
  };
  return (
    <>
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar for mobile (off-canvas) */}
      <motion.aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-64 bg-primary-100 shadow-lg transform transition-transform duration-300 ease-in-out",
          // Mobile: conditional positioning
          {
            "translate-x-0": sidebarOpen,
            "-translate-x-full": !sidebarOpen,
          },
          // Desktop: always visible and override mobile classes
          "md:!translate-x-0 md:static md:z-0"
        )}
        initial={false}
        animate={{ x: sidebarOpen ? 0 : -256 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <div className="h-full flex flex-col px-6 py-10">
          {/* Mobile close button */}
          <div className="flex items-center justify-end md:hidden">
            <button
              type="button"
              className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-main"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sr-only">Close sidebar</span>
              <FiX className="h-6 w-6 text-[#2E2E2E]" aria-hidden="true" />
            </button>
          </div>

          {/* Back button for mobile and desktop */}
          <div className="">
            <Link href="/"
              className="flex items-center text-primary-600 hover:text-primary-700 focus:outline-none transition-colors duration-200" >
              <IoChevronBackOutline className="text-primary-main mr-1" />
              <span className="text-sm text-primary-main font-medium">Back</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="mt-10 space-y-1 flex-1">
            {navigationItems.map((item, index) => (
              <button
                onClick={() => handleNavigationClick(index, item.route)}
                key={item.name}
                className={clsx(
                  "group w-full flex cursor-pointer items-center px-5 py-2.5 text-sm font-medium rounded-md transition-colors duration-200",
                  item.current
                    ? "bg-[#E8E5E1] text-[#2E2E2E]"
                    : "text-[#9B9698] hover:bg-[#E8E5E1] hover:text-[#2E2E2E]"
                )}
              >

                <Image
                  src={item.src}
                  alt={item.name}
                  height={20}
                  width={20}
                  priority
                  className={clsx(
                    "mr-3 h-5 w-5 transition-colors duration-200",
                    item.current ? "brightness-0" : "brightness-100"
                  )}
                  aria-hidden="true"
                />

                {item.name}
              </button>
            ))}
          </nav>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;