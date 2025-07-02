import React from 'react';
import { FiMenu } from 'react-icons/fi';
import { motion } from 'framer-motion';


// Define the type for the props
interface MobileHeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const MobileHeader:React.FC<MobileHeaderProps> = ({ sidebarOpen, setSidebarOpen }) => {
  return (
    <motion.header 
      className="sticky top-0 z-10 bg-white border-b border-gray-200 md:hidden"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="px-4 flex items-center justify-between h-16">
        <div className="flex items-center">
          <button
            type="button"
            className="text-gray-500 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <FiMenu className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-shrink-0 flex items-center">
          <h1 className="text-xl font-semibold text-gray-900">My Account</h1>
        </div>
        <div className="w-6">
          {/* Placeholder to center the title */}
        </div>
      </div>
    </motion.header>
  );
};

export default MobileHeader;