import { sourcesData } from "@/app/(chats)/chat/component/SpecificChat";
import { itemVariants } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Image from "next/image";

interface CitationProps {
    data: sourcesData[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}
const Citation: React.FC<CitationProps> = ({ data, open, onOpenChange }) => {

    const sidebarOpenVariants = {
        hidden: {
            x: "100%",       // start fully off to the right
            opacity: 0,      // optional—fade out as it slides out
        },
        visible: {
            x: 0,            // slide to its natural position
            opacity: 1,      // fade in
            transition: {
                type: "tween", // or "spring"
                duration: 0.3,
            },
        },
    };

    return (
        // <div className={cn("h-screen  transition-all duration-150 overflow-hidden", {
        //   "w-0": !open,
        //   "w-[25rem]": open
        // })}>
        //   <div className="w-full h-full border border-[#F7F7F7]">

        //     {/* Citations Header */}
        //     <div className="flex justify-between w-full py-6 px-[1.625rem] items-center sticky top-0 z-10">
        //       <h2 className="text-xl leading-normal font-semibold">Citations</h2>
        //       <button onClick={() => onOpenChange(false)}><X className="size-5" /></button>
        //     </div>

        //     {/* Citations Body */}
        //     <div className={cn("w-full transition-all duration-700 scroll-smooth h-[calc(100%-4rem)] overflow-y-auto", {
        //       "opacity-0": !open,
        //       "opacity-100": open
        //     })}>

        //       {
        //         data.map((source, i) => (
        //             <a key={i} href={source.link} target="_blank" rel="noopener noreferrer">
        //                             <div   className="w-full citation-card px-[1.625rem] py-4 border-b-2 border-[#F7F7F7] space-y-1.5">

        //             <div className="flex items-center gap-x-1.5">
        //               <div>

        //                 <Image
        //                   src={source.favicon}
        //                   alt="logo"
        //                   width={16}
        //                   height={16}
        //                   className="rounded-full"
        //                 />
        //               </div>

        //               <p className="text-xs leading-normal font-light">{source.domain}</p>
        //             </div>

        //             <h4 className="text-sm font-bold leading-normal">{source.title}</h4>

        //             <p className="text-xs text-[#A0A0A0] leading-normal font-normal">{source?.snippet || source.title}</p>
        //             </div>
        //             </a>

        //         ))}
        //     </div>
        //   </div>
        // </div>
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex"
                // onClick={toggleMobileSidebar}
                >

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        className="sm:w-[55%] w-[20%] bg-black"
                        onClick={() => onOpenChange(false)}
                    />
                    {/* Sidebar */}
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        variants={sidebarOpenVariants}
                        className="sm:w-[45%] w-[80%] bg-white h-full shadow-lg overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6">
                            <motion.div variants={itemVariants} className="mb-8">
                                <div className="w-full h-full  border-[#F7F7F7]">
                                    <div className="flex justify-between w-full py-6 bg-white items-center sticky top-0 z-10">

                                        <h2 className="text-xl leading-normal font-semibold">
                                            Citations
                                        </h2>
                                        <button onClick={() => onOpenChange(false)}>
                                            <X className="size-5" />
                                        </button>
                                    </div>
                                    <div
                                        className={cn(
                                            "w-full transition-all duration-700 scroll-smooth h-[calc(100%-4rem)] overflow-y-auto"
                                        )}
                                    >
                                        {data.map((source, i) => (
                                            <a
                                                key={i}
                                                href={source.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <div className="w-full citation-card  py-4 border-b-2 border-[#F7F7F7] space-y-1.5">
                                                    <div className="flex items-center gap-x-1.5">
                                                        <div>
                                                            <Image
                                                                src={source.favicon}
                                                                alt="logo"
                                                                width={16}
                                                                height={16}
                                                                className="rounded-full"
                                                            />
                                                        </div>

                                                        <p className="text-xs leading-normal font-light">
                                                            {source.domain}
                                                        </p>
                                                    </div>

                                                    <h4 className="text-sm font-bold leading-normal">
                                                        {source.title}
                                                    </h4>

                                                    <p className="text-xs text-[#A0A0A0] leading-normal font-normal">
                                                        {source?.snippet || source.title}
                                                    </p>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* Overlay */}

                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default Citation;
