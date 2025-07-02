// 'use client';
// import ChatInterface from '@/components/chat/ChatInterface';
// import React, { useState, useEffect } from 'react';
// import { Menu, X } from 'lucide-react';
// import { Header } from '@/components/layout/Header';
// import { Sidebar } from '@/components/layout/Sidebar';
import ChatArea from "@/components/chat/ChatArea";
import MobileHeader from "@/components/layout/MobileHeader";
import { Suspense } from "react";


const Page = () => {
  return (
    <>
      <Suspense>
      {/* <MobileHeader /> */}
      <ChatArea />
      </Suspense>

  
      {/* Additional content can be added here if needed */}

    </>
  )
}

export default Page;