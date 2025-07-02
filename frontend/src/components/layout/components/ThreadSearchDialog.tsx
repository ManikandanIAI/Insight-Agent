import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { SessionHistoryData } from '../Sidebar';
import ApiServices from '@/services/ApiServices';
import { cn } from '@/lib/utils';
import { debounce } from '@/utils/utility';
import { useRouter } from 'next/navigation';
// import { debounce } from 'lodash';


interface ISearchThreadsDialog {
    open: boolean
    onOpenChange: (open: boolean) => void;
}

export const SearchThreadsDialog: React.FC<ISearchThreadsDialog> = ({ open, onOpenChange }) => {

    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [sessionTitlesData, setSessionTitlesData] = useState<SessionHistoryData>([]);
    const getThreadTitle = async (input: string): Promise<void> => {
        const userId = localStorage.getItem("user_id") || "";
        try {

            const response = await ApiServices.getSessionTitle(userId, input);
            setSessionTitlesData(response.data);
        } catch (error) {
            console.log("Error fetching session history:", error);
            setSessionTitlesData([]);
        }
    };



    const handleClose = (open: boolean) => {
        onOpenChange(open);
    }



    // const debouncedSearch = debounce((value = "") => {
    //     getThreadTitle(value);
    // }, 1300);

    const debouncedGetThreadTitle = useMemo(
        () => debounce((value = "") => {
            getThreadTitle(value);
        }, 300), []);

    const handleSearchThread = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        if (e.target.value?.trim() !== "") {
            debouncedGetThreadTitle(e.target.value);
        }

    }

    const handleSessionTiltleClick = (sessionId: string): void => {
        setSearchQuery("");
        router.push(`/chat?search=${sessionId}`);
        setSessionTitlesData([]);
        setTimeout(() => {
            handleClose(false);
        }, 300)
    };


    return (

        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="w-full max-w-xl mx-auto bg-primary-light rounded-lg p-0 gap-0 ">
                <DialogHeader className="px-4 pt-6 pb-0">
                    <DialogTitle className='p-0'>

                        <div className="relative mt-6 mb-4">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2  h-4 w-4" />
                            <input
                                onChange={handleSearchThread}
                                type="text"
                                placeholder="Search Threads"
                                className={`block w-full pl-10 pr-3 py-3 bg-primary-150 border border-primary-100'
                                } rounded-md shadow-sm placeholder-neutral-150 focus:outline-none focus:ring-2 focus:ring-primary-main sm:text-sm transitiona-ll duration-200`}
                            />
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="px-4 flex-1 h-[260px] max-h-[50dvh] overflow-y-auto">


                    <div>
                        {sessionTitlesData.map((group, gi) => (
                            <div key={gi}>
                                <div className="pb-1.5 text-sm font-medium text-black">
                                    {group.timeline}
                                </div>
                                {group.data.map((item) => (
                                    <div
                                        onClick={() => handleSessionTiltleClick(item.id)}
                                        key={item.id}
                                        className={cn(
                                            "px-2 py-3 flex items-center cursor-pointer rounded-md font-semibold text-sm transition-colors text-neutral-300 hover:bg-[#E8E5E1] hover:text-[#181818]"
                                        )}
                                    >
                                        <span className="flex-1 min-w-0 truncate">
                                            {item.title}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* No results */}
                    {searchQuery && sessionTitlesData.length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-gray-500 text-sm">No threads found matching "{searchQuery}"</p>
                        </div>
                    )}


                    {
                        !searchQuery && (
                            <div className="text-center py-8">
                                <p className="text-gray-500 text-sm">search to find thread</p>
                            </div>
                        )
                    }


                </div>
            </DialogContent>
        </Dialog>



    );
}