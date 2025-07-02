import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Button from '@/app/(dashboard)/components/Button';
import { toast } from 'sonner';
import ApiServices from '@/services/ApiServices';
import { Loader, Loader2 } from 'lucide-react';


interface IChatSharingDialog {
    open: boolean
    onOpenChange: (open: boolean) => void;
    sessionId: string;
}

export const ChatSharingDialog: React.FC<IChatSharingDialog> = ({ open, onOpenChange, sessionId }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [sharedChatUrl, setSharedChatUrl] = useState("https://iagent.iaisolution.in/share....");
    const [linkCreated, setLinkCreated] = useState(false);

    const handleUpdatePublicSession = async () => {

        const userId = localStorage.getItem("user_id") || "";

        try {
            setIsLoading(true)
            const response = await ApiServices.updatePublicSession(sessionId, userId);
            setSharedChatUrl(`https://iagent.iaisolution.in/share?conversation=${sessionId}`);
            setLinkCreated(true);

        } catch (error: any) {
            console.log("error", error);
            toast.error(error.response?.data?.detail || "something, went wrong")
        } finally {
            setIsLoading(false)
        }
    }




    const handleClose = (open: boolean) => {
        onOpenChange(open);
        setLinkCreated(false);
        setSharedChatUrl("https://iagent.iaisolution.in/share....");
    }


    const handleCopyLink = async () => {
        if (window.navigator) {

            try {
                await navigator.clipboard.writeText(sharedChatUrl);
                toast.success("Link copied")
            } catch (error) {
                console.log("error", error);
                toast.error("sorry, link could not get copied, Please try again after some time")
            }
        }
    }





    return (

        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="w-full mx-auto max-w-xl bg-primary-light rounded-lg p-0 gap-0 ">
                <DialogHeader className="px-4 pt-6 pb-0">
                    <DialogTitle className='p-0'>

                        <div className="relative mb-4">
                            <h4 className='text-lg font-semibold text-black'>Share Public link to this thread</h4>
                            <p className='text-xs font-normal text-[#616161]'>Your name and any messages you add after sharing stay private. <a className='underline text-primary-main'>Learn more..</a></p>
                        </div>
                    </DialogTitle>
                </DialogHeader>
 
                <div className="px-4 mb-10 w-full overflow-hidden">


                    <div className='sm:flex hidden w-full rounded-[6rem] p-2 px-5 bg-[#FCFCFA] items-center justify-between'>
                        <span className='max-w-[70%] w-[70%] truncate'>{sharedChatUrl}</span>

                      
                            
{
                                linkCreated ? (
                                    <Button onClick={handleCopyLink} className='rounded-[3.5rem]'>Copy Link</Button>

                                ) : (
                                    <Button onClick={handleUpdatePublicSession} disabled={isLoading} className='rounded-[3.5rem]'>{isLoading ? <Loader className='animate-spin text-white size-5' /> : "Create Link"}</Button>

                                )
                            }
                        



                    </div>

                    <div className='sm:hidden space-y-5'>

                        <div className='rounded-[2rem] py-2 px-4 bg-[#FCFCFA]'>
                            <span className='w-[70%] truncate'>{sharedChatUrl}</span>
                        </div>


                        <div className='flex items-center justify-center w-full'>
                            {
                                linkCreated ? (
                                    <Button onClick={handleCopyLink} className='rounded-[3.5rem]'>Copy Link</Button>

                                ) : (
                                    <Button onClick={handleUpdatePublicSession} disabled={isLoading} className='rounded-[3.5rem]'>{isLoading ? <Loader className='animate-spin text-white' /> : "Create Link"}</Button>

                                )
                            }

                        </div>

                    </div>


                </div>
            </DialogContent>
        </Dialog>



    );
}