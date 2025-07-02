"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import Button from "../../components/Button"
import ApiServices from "@/services/ApiServices"
import { toast } from "sonner"
import { redirect } from "next/navigation"
import { logout } from "@/utils/auth"

interface DeleteAccountModalProps {
    isOpen: boolean
    onClose: () => void
}

export function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Sync with parent state
    useEffect(() => {
        setOpen(isOpen)
    }, [isOpen])

    // Notify parent component when dialog closes
    const handleOpenChange = (open: boolean) => {
        setOpen(open)
        if (!open) {
            onClose()
        }
    }

    const onConfirm = async () => {
        const userId = localStorage.getItem("user_id");
        if (!userId) {
            logout();
            toast.error("User ID not found. Please log in again.");
            return;
        }

        try {
            setIsLoading(true);
            const response = await ApiServices.handleAccountDelete(userId);
            toast.success("Account deleted successfully");
            logout();
            handleOpenChange(false);
            
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || "Something went wrong. Please try again later.");
        } finally {
            setIsLoading(false);
        }

    }
    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogContent className="w-full sm:max-w-xl gap-0">
                <AlertDialogHeader className="flex flex-row items-center justify-between mb-6">
                    <AlertDialogTitle className="text-xl leading-none font-semibold">Confirm Account Deletion</AlertDialogTitle>
                    <button onClick={onClose} className="h-6 w-6 rounded-md p-0">
                        <X className="h-6 w-6" />
                    </button>
                </AlertDialogHeader>
                <div className="py-2  border-b border-t border-primary-100">
                    <div className="py-4 text-[#646262]">
                        <AlertDialogDescription className="text-base">
                            Before you delete your account, please take a moment to understand what will happen to your data:
                        </AlertDialogDescription>
                        <ul className="my-4 list-disc space-y-2 pl-6 text-base">
                            <li>Your profile details, preferences, and settings will be removed.</li>
                            <li>Your search history, threads, and any other content you&apos;ve shared will be deleted.</li>
                        </ul>
                        <AlertDialogDescription className="text-base">
                            All data will be permanently deleted 30 days after account deletion.{" "}
                            <span className="font-medium text-[#202020]">
                                Keep in mind that deleting your account can&apos;t be undone.
                            </span>
                        </AlertDialogDescription>
                    </div>
                </div>
                <AlertDialogFooter className="mt-4 flex-row gap-3 justify-end">
                    <Button
                        onClick={onClose}
                        variant="outline"
                        size="md"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isLoading}
                        variant="danger"
                        size="md"
                        
                    >
                        {isLoading ? "Deleting..." : "Delete Account"}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
