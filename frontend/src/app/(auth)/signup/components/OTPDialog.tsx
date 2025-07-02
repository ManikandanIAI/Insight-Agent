"use client";

import Button from "@/app/(dashboard)/components/Button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { API_ENDPOINTS } from "@/services/endpoints";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";


export interface IRegisterationData {
    email: string
    fullName: string
    password: string
}


interface OtpPasswordResetDialogProps {
    open: boolean
    registerationData: IRegisterationData
    onOpenChange: (open: boolean) => void
}

const OTPDialog: React.FC<OtpPasswordResetDialogProps> = ({ open, registerationData, onOpenChange }) => {
    const router = useRouter();
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [resendLoading, setResendLoading] = useState(false);
    const [timer, setTimer] = useState(0);

    const resetForm = () => {
        setOtp("")
    }
    const handleDialogChange = (open: boolean) => {
        if (!open && !loading) {
            resetForm()
        }
        onOpenChange(open)
    };


    const handleResendOtp = async () => {
        setResendLoading(true);
        try {
            await axios.post(API_ENDPOINTS.SIGNUP, { ...registerationData, full_name: registerationData.fullName });
            setOtp("");
            setTimer(30);
            toast.success(`A 6-digit OTP has been sent to your email`)
        } catch (error: any) {
            setTimer(0);
            setErrors({otp: error.detail || "Network Error, Please try again later"})
        } finally {
            setResendLoading(false);
        }


    };


    useEffect(() => {
        if (timer <= 0) return;
        const id = setInterval(() => {
            setTimer((t) => t - 1);
        }, 1000);
        return () => clearInterval(id);
    }, [timer]);




    const handleOtpChange = (value: string) => {
        setOtp(value);
        setErrors({});
    }

    const handleVerifyOtp = async () => {
        setErrors({})

        if (otp.length !== 6) {
            setErrors({ otp: "Please enter a valid 6-digit OTP" })
            return
        }

        setLoading(true)

        try {
            const response = await axios.post(API_ENDPOINTS.VERIFY_OTP, {
                email: registerationData.email,
                otp
            })
            localStorage.setItem("user_id", response.data.user_id);
            Cookies.set("access_token", response.data.access_token);
            router.push("/onboarding");
            toast.success("Registeration Successful");
        } catch (error: any) {
            setErrors({ otp: error.response?.data?.detail || "Invalid OTP" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={handleDialogChange}
            // Prevent closing on outside click when loading
            modal={true}
        >
            <DialogContent
                className="sm:max-w-lg w-full"
                // Prevent closing on escape when loading
                onEscapeKeyDown={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>Verify OTP</DialogTitle>
                    <DialogDescription>
                        Enter the 6-digit code sent to your email
                    </DialogDescription>
                </DialogHeader>


                <div className="space-y-4 pt-4">
                    <div className="space-y-8">

                        <p className="text-sm text-muted-foreground w-full">
                            We've sent a verification code to {registerationData.email}
                        </p>
                        <div className="flex items-center justify-center">

                            <InputOTP
                                maxLength={6}
                                value={otp}
                                onChange={handleOtpChange}
                                disabled={loading}
                            >

                                <InputOTPGroup className="flex gap-x-3">
                                    {[0, 1, 2, 3, 4, 5].map((i) => (
                                        <InputOTPSlot key={i} index={i} />
                                    ))}
                                </InputOTPGroup>
                            </InputOTP>



                        </div>


                        {errors.otp && (
                            <p className="text-sm text-destructive text-center" role="alert">
                                {errors.otp}
                            </p>
                        )}
                    </div>

                    <div className="text-center">
                        {timer > 0 ? (
                            <span className="text-sm text-primary-400">
                                Resend OTP in {timer} sec
                            </span>
                        ) : (
                            <button
                                onClick={handleResendOtp}
                                disabled={resendLoading}
                                className="text-sm underline text-primary-main"
                            >
                                {resendLoading ? "Resending..." : "Resend OTP"}
                            </button>
                        )}
                    </div>
                    <Button
                        variant="primary"
                        onClick={handleVerifyOtp}
                        className="w-full"
                        disabled={loading || otp.length !== 6}

                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Verifying OTP...
                            </>
                        ) : (
                            'Verify OTP'
                        )}
                    </Button>
                </div>

            </DialogContent>
        </Dialog>
    )
}

export default OTPDialog;
