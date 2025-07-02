import Sidebar from '@/components/layout/Sidebar'
import React from 'react'
import { ReactNode } from 'react'
const ChatLayout = ({ children }: { children: ReactNode }) => {
    return (
        <div className="lg:flex bg-white w-full">
            <Sidebar />
            {children}
        </div>
    )
}

export default ChatLayout;
