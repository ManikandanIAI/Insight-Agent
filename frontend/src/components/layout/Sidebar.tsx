"use client";

import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Ellipsis,
  PanelRightClose,
  Plus,
  Settings,
} from "lucide-react";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import MobileHeader from "./MobileHeader";
import ApiServices from "@/services/ApiServices";
import { useAuthStore, useMessageStore } from "@/store/useZustandStore";
import { AccountDropdown, AccountDropdownHandle } from "./components/MyAccountDropdown";
import { LogoutDialog } from "./components/LogoutDialog";
import { HiOutlineSearch } from "react-icons/hi";
import { SearchThreadsDialog } from "./components/ThreadSearchDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { toast } from "sonner";


// Types
interface ISidebarImages {
  id: number;
  type: string;
  src: string;
  activeSrc: string
}

interface TimelineItem {
  title: string;
  created_at: string;
  id: string;
  user_id: string;
}

interface TimelineGroup {
  timeline: string;
  data: TimelineItem[];
}

export type SessionHistoryData = TimelineGroup[];

interface SidebarContentProps {
  isSidebarOpen: boolean;
  handleOpenSidebar: () => void;
  sessionHistoryData: SessionHistoryData;
  sessionId: string | null;
  userName: string | null;
  router: any;
  isMobile?: boolean;
  toggleMobileSidebar?: () => void;
  handleDeleteSessionId: (sessionId: string) => void;
}

// ApiService response type
interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

// Animation variants
export const sidebarOpenVariants: Variants = {
  hidden: {
    x: "-100%",
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
  visible: {
    x: 0,
    transition: {
      duration: 0.3,
      ease: "easeInOut",
      when: "beforeChildren", // container animates first
      staggerChildren: 0.1,   // delay children fade-in
    },
  },
};


export const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -15,
    transition: {
      type: "tween",
      ease: "easeIn",
      duration: 0.15,
    },
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
      duration: 0.2,
    },
  },
  exit: {
    opacity: 0,
    x: -10,
    transition: {
      type: "tween",
      ease: "easeOut",
      duration: 0.1,
    },
  },
};

export const sidebarVariants: Variants = {
  hidden: {
    x: "-100%",
    boxShadow: "0px 0px 0px rgba(0, 0, 0, 0)",
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 40,
      when: "afterChildren",
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
  visible: {
    x: 0,
    boxShadow: "5px 0px 25px rgba(0, 0, 0, 0.1)",
    transition: {
      type: "spring",
      stiffness: 350,
      damping: 30,
      when: "beforeChildren",
      staggerChildren: 0.08,
    },
  },
};

// Shared sidebar content component
const SidebarContent: React.FC<SidebarContentProps> = ({
  isSidebarOpen,
  handleOpenSidebar,
  sessionHistoryData,
  sessionId,
  userName,
  router,
  isMobile = false,
  handleDeleteSessionId,
  toggleMobileSidebar = () => { },
}) => {
  const images: ISidebarImages[] = [
    {
      id: 1,
      src: "/icons/search.svg",
      type: "icon",
      activeSrc: "/icons/search.svg"

    },
  ];

  const dropdownRef = useRef<AccountDropdownHandle>(null);
  const [open, setOpen] = useState(false);
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);

  const setMessage = useMessageStore((state) => state.setMessage);

  type MenuItem = {
    id: string;
    label: string;
    src: string;
    onClick: () => void;
  };

  const accountMenuItems: MenuItem[] = [
    {
      id: "account",
      label: "My Account",
      src: "/icons/user_icon.svg",
      onClick: () => router.push("/my-account"),
    },
    {
      id: "personalization",
      label: "Personalization",
      src: "/icons/personalization.svg",
      onClick: () => router.push("/personalization"),
    },
    // {
    //   id: "integrations",
    //   label: "Integrations",
    //   src: "/icons/integrations.svg",
    //   onClick: () => console.log("Integrations clicked"),
    // },
    // {
    //   id: "enterprise",
    //   label: "Enterprise Solution",
    //   src: "/icons/enterprise.svg",
    //   onClick: () => console.log("Enterprise Solution clicked"),
    // },
    // {
    //   id: "upgrade",
    //   label: "Upgrade Plan",
    //   src: "/icons/upgrade.svg",
    //   onClick: () => console.log("Upgrade Plan clicked"),
    // },
    {
      id: "logout",
      label: "LogOut",
      src: "",
      onClick: () => setOpen(true),
    },
  ];


  const handleSessionTiltleClick = (sessionId: string): void => {
    setMessage("");
    router.push(`/chat?search=${sessionId}`)
    toggleMobileSidebar();
  };

  const handleOptionClick = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();

    try {
      await ApiServices.handleSessionDelete(sessionId);
      handleDeleteSessionId(sessionId);
      toast.success("Session deleted successfully.");
      
    } catch(error) {
      console.log("error in deleting session", error)
    }

  }
  // Expanded sidebar content
  if (isSidebarOpen || isMobile) {
    return (
      <>
        <motion.div
          key="expanded"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={isMobile ? itemVariants : sidebarOpenVariants}
          className="h-full bg-primary-light w-full flex flex-col py-10"
        >
          {/* Header */}
          <div className="pb-6 px-6">
            <div className="flex items-center justify-between">
              <div onClick={() => router.push("/")} className="">
                <Image
                  src="/images/ia_logo_with_name.svg"
                  width={176}
                  height={30}
                  alt="logo"
                  // layout="responsive"
                  className="sm:h-[1.875rem] h-[1.75rem] sm:w-44 w-36 cursor-pointer"
                />

              </div>

              <button
                onClick={isMobile ? toggleMobileSidebar : handleOpenSidebar}
                className={`bg-white sm:p-2 p-1.5 rounded-lg`}
              >
                <PanelRightClose
                  strokeWidth={1.5}
                  size={20}
                  className="rounded-sm rotate-180"
                />
              </button>



            </div>
            
          </div>

          {/* New Research Button */}
          <div className="mt-10 px-6">
            <Link
              href="/"
              className="flex items-center justify-center w-full rounded-md p-2 text-white bg-primary-main text-base font-medium transition-colors"
            >
              <Plus className="mr-2 text-white size-5" />
              <span>New Research</span>
            </Link>
          </div>

          <div className="my-6 flex items-center justify-between text-black px-6">
            <div className="flex items-center gap-x-1">
              <Image
                src="/icons/thread_icon.svg"
                alt="thread"
                height={20}
                width={20}
              />

              <span className="text-sm font-meium">Thread History</span>
            </div>
            <button onClick={() => setThreadSearchOpen(true)} className="cursor-pointer">
              <HiOutlineSearch size={20} />
            </button>
          </div>

          {/* Session History */}
          <div className="flex-1 w-full overflow-y-auto mb-2">
            <div className="pl-6 pr-4 space-y-4 w-full">
              {sessionHistoryData.map((group, gi) => (
                <div key={gi}>
                  <div className="pb-1.5 text-sm font-medium text-black">
                    {group.timeline}
                  </div>
                  {group.data.map((item) => (
                    <div
                      onClick={() => handleSessionTiltleClick(item.id)}
                      key={item.id}
                      className={cn(
                        "p-2.5 flex group h-[2.375rem] items-center gap-x-2 justify-between cursor-pointer rounded-[0.5rem] font-semibold text-xs",
                        sessionId === item.id
                          ? "bg-[#E8E5E1] text-[#181818]"
                          : "text-neutral-300 hover:bg-[#E8E5E1] hover:text-[#181818]"
                      )}
                    >
                      <span className="flex-1 min-w-0 w-full truncate">
                        {item.title}
                      </span>

                      <DropdownMenu>
                        <DropdownMenuTrigger className='focus:border-none'>
                          <Ellipsis className="size-5 group-hover:block hidden" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-primary-light p-2 mt-6 mr-20 rounded-lg">
                          <DropdownMenuItem onClick={(e) => handleOptionClick(e, item.id)} className="flex gap-x-1.5 items-center font-medium cursor-pointer">
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
                  ))}
                </div>
              ))}
            </div>
          </div>



          {/* <User/> Section */}

          <AccountDropdown
            ref={dropdownRef}
            items={accountMenuItems}
            triggerElement={
              <div className="p-2 mx-6 cursor-pointer rounded-lg flex items-center bg-[#FFFFFF] justify-between">
                <div className="flex items-center overflow-hidden">
                  <div className="w-8 h-8 rounded-md bg-[#3B1C2B] flex items-center justify-center text-white font-medium mr-2">
                    {userName?.charAt(0).toUpperCase() || ""}
                  </div>
                  <div className="text-sm max-w-[150px] truncate text-neutral-300 font-medium">
                    {userName || ""}
                  </div>
                  <ChevronUp size={16} className="ml-1 text-neutral-300" />
                </div>
                <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                  <Settings strokeWidth={1.5} className="text-neutral-300" />
                </button>
              </div>
            }
          />
        </motion.div>

        <SearchThreadsDialog open={threadSearchOpen} onOpenChange={setThreadSearchOpen} />
        <LogoutDialog open={open} onHandleChange={() => setOpen(!open)} />
      </>
    );
  }



  // Collapsed sidebar content (desktop only)
  return (
    <>
      <motion.div
        key="collapsed"
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={sidebarOpenVariants}
        className="h-full w-full flex flex-col py-10"
      >
        <div className="flex items-center flex-col w-full">


          <button
            onClick={handleOpenSidebar}
            className="flex items-center justify-center mb-6"
          >
            <Image
              src="/icons/menu_icon.svg"
              alt="menu"
              height={28}
              width={28}
            />
          </button>

          <div onClick={() => router.push("/")}>
            <Image
              src="/images/logo_ia.svg"
              width={42}
              height={42}
              alt="logo"
              className="size-[2.625rem] cursor-pointer"
            />
          </div>
          <button
            onClick={() => router.push("/")}
            className="bg-white size-[2.625rem] mt-10 flex items-center justify-center rounded-full"
          >
            <Plus className="text-primary-main size-5" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto scrollbar-hide">
          {/* <div className="flex flex-col items-center">
            {images.map((image) => (
              <button
                onClick={() => setActiveMenu(image.id)}
                key={image.id}
                className={cn("w-full py-3 flex items-center justify-center", {
                 "border-r-2 border-primary-main": activeMenu === image.id,
                })}
              >
               

                {
                  <Image
                    src={image.src}
                    alt={image.src}
                    height={28}
                    width={28}
                  />
                
                }
              </button>
            ))}
          </div> */}
        </div>

        <div className="mt-auto">
          <div className="flex flex-col items-center">


            <AccountDropdown
              ref={dropdownRef}
              items={accountMenuItems}
              triggerElement={
                <div className="bg-white cursor-pointer w-[2.625rem] rounded-lg">
                  <button className="bg-primary-dark w-full h-[2.625rem] flex items-center justify-center rounded-lg">
                    <span className="text-xl font-medium text-white">
                      {userName?.charAt(0).toUpperCase() || ""}
                    </span>
                  </button>

                  <button className="flex-shrink-0 p-[11px]">
                    <Settings
                      strokeWidth={1.5}
                      className="text-neutral-300"
                    />
                  </button>
                </div>
              }
            />



          </div>
        </div>


      </motion.div>
      <LogoutDialog open={open} onHandleChange={() => setOpen(!open)} />
    </>

  );
};

const Sidebar: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [sessionHistoryData, setSessionHistoryData] = useState<SessionHistoryData>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const userName = useAuthStore((state) => state.username);
  const router = useRouter();
  const param = useSearchParams();

  const getSessionHistory = async (): Promise<void> => {
    const userId = localStorage.getItem("user_id");
    try {
      if (userId) {
        const response = await ApiServices.getSessionHistory(userId);
        setSessionHistoryData(response.data);
      }
    } catch (error) {
      console.log("Error fetching session history:", error);
      setSessionHistoryData([]);
    }
  };

  useEffect(() => {
    getSessionHistory();
  }, []);

  useEffect(() => {
    const searchParamId = param.get("search");
    if (searchParamId) {
      setSessionId(searchParamId);
    }
  }, [param]);

  const toggleMobileSidebar = (): void => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const handleOpenSidebar = (): void => {
    setIsSidebarOpen(!isSidebarOpen);
  };
  

  const handleDeleteSessionId = (sessionId: string) => {
    setSessionHistoryData((prev) => {
      return prev.map((sessionHistory) => ({
        timeline: sessionHistory.timeline,
        data: sessionHistory.data.filter((timeline) => timeline.id !== sessionId)
      }));
    })
  }




  return (
    <div className="">
      {/* Mobile Top Bar */}
      <div className="lg:hidden h-[4.75rem] sticky top-0 w-full flex items-center justify-between">
        <MobileHeader onMenuClick={toggleMobileSidebar} />
      </div>

      {/* Desktop Sidebar */}
      <div
        className={cn(
          "lg:flex hidden h-screen flex-col mr-5 bg-white transition-all duration-500 ease-in-out",
          { "w-[17.5rem]": isSidebarOpen, "w-[7.5rem]": !isSidebarOpen }
        )}
      >
        <div className="h-full bg-primary-light">
          <AnimatePresence mode="wait">
            <SidebarContent
              isSidebarOpen={isSidebarOpen}
              handleOpenSidebar={handleOpenSidebar}
              sessionHistoryData={sessionHistoryData}
              sessionId={sessionId}
              userName={userName}
              router={router}
              handleDeleteSessionId={handleDeleteSessionId}
            />
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex"
            onClick={toggleMobileSidebar}
          >
            {/* Mobile Sidebar */}
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={sidebarVariants}
              className="sm:w-[40%] w-[80%] bg-white h-full shadow-lg overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <SidebarContent
                isSidebarOpen={true}
                handleOpenSidebar={handleOpenSidebar}
                sessionHistoryData={sessionHistoryData}
                sessionId={sessionId}
                userName={userName}
                router={router}
                isMobile={true}
                toggleMobileSidebar={toggleMobileSidebar}
                handleDeleteSessionId={handleDeleteSessionId}
              />
            </motion.div>

            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="sm:w-[60%] w-[20%] bg-black"
            />
          </motion.div>
        )}
      </AnimatePresence>



    </div>
  );
};

export default Sidebar;