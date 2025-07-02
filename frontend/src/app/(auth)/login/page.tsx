// LoginPage.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader, Check, X, EyeOff, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import ApiServices from '@/services/ApiServices';
import { LoginFormData } from '@/types/auth-types';
import { useAuthStore } from "@/store/useZustandStore";
import { PiMicrosoftOutlookLogoFill } from 'react-icons/pi';
import { API_ENDPOINTS } from '@/services/endpoints';
import Cookies from 'js-cookie';
import { Toast } from '@radix-ui/react-toast';
import { OtpPasswordResetDialog } from '../components/ResetPassword';
const LoginPage: React.FC = () => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isLoginLoading, setIsLogInLoading] = useState(false);
  const [isOutLookLoading, setIsOutLookLoading] = useState(false);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  const [isOtpDialogOpen, setIsOtpDialogOpen] = useState(false);



  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>();

  const router = useRouter();

  // watch the password field
  const password = watch('password', '');
  // has the user started typing?
  const isTouched = password.length > 0;

  // define each rule
  // const rules = {
  //   length: password.length >= 8,
  //   upper: /[A-Z]/.test(password),
  //   lower: /[a-z]/.test(password),
  //   number: /[0-9]/.test(password),
  //   special: /[@$!%*?&]/.test(password),
  // };

  // check if all rules are valid
  // const allValid = Object.values(rules).every(Boolean);



  const onSubmit: SubmitHandler<LoginFormData> = async (data) => {
    setIsLoading(true);
    try {
      const response = await ApiServices.login(data.email, data.password);
      toast.success('Login successful');
      localStorage.setItem("user_id", response.data.user_id);
      Cookies.set("access_token", response.data.access_token);
      router.push("/");
    } catch (err: any) {
      toast.error(err?.response?.data.detail || "Invalid email or password or account does not exist.");
    } finally {
      setIsLoading(false);
    }
  };


  // Frontend handleGoogleAuth
  const handleGoogleAuth = () => {
    const url = API_ENDPOINTS.GOOGLE_AUTH; // Backend endpoint to START the flow
    const width = 600;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      url,
      'googleAuthPopup',
      `width=${width},height=${height},top=${top},left=${left},resizable=no`);
    setIsLoading(true);
    setIsGoogleLoading(true)
    // Listener for messages from the popup
    const handleAuthMessage = (event: any) => {

      // IMPORTANT: Check event.origin for security!
      // Should match the origin of your backend where the callback runs
      // Example: if (event.origin !== 'http://localhost:8000') return;

      if (event.data?.type === 'auth_success' && event.data?.token) {
        console.log("Received token from popup:", event.data.token);
        // *** Store the token (e.g., in state, local storage, or set cookie via JS) ***
        Cookies.set('access_token', event.data.token, { path: '/' /* other options */ });
        // Update auth state in your app (e.g., call setUser)
        // setUser({ token: event.data.token }); // Example using context from Approach 1


        popup?.close();
        window.removeEventListener('message', handleAuthMessage); // Clean up listener
        toast.success("Authentication Successful")
        router.push("/");
      } else if (event.data?.type === 'auth_error') {
        console.log(event)
        console.error("Auth error from popup:", event.data.error);
        window.removeEventListener('message', handleAuthMessage); // Clean up listener
        popup?.close();
        toast.error(event.data?.error)
      }

      setIsLoading(false);
      setIsGoogleLoading(false);
    };

    window.addEventListener('message', handleAuthMessage);

    // Optional: Check if popup was closed without success
    const timer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(timer);
        setIsLoading(false);
        setIsGoogleLoading(false);
        window.removeEventListener('message', handleAuthMessage); // Clean up listener if popup closed manually
        console.log('Auth popup closed.');
      }
    }, 500);
  };


  const handleOutLookAuth = () => {
    const url = API_ENDPOINTS.OUTLOOK_AUTH; // Backend endpoint to START the flow
    const width = 600;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      url,
      'googleAuthPopup',
      `width=${width},height=${height},top=${top},left=${left},resizable=no`);
    setIsLoading(true);
    setIsOutLookLoading(true)
    // Listener for messages from the popup
    const handleAuthMessage = (event: any) => {

      // IMPORTANT: Check event.origin for security!
      // Should match the origin of your backend where the callback runs
      // Example: if (event.origin !== 'http://localhost:8000') return;

      if (event.data?.type === 'auth_success' && event.data?.token) {
        console.log("Received token from popup:", event.data.token);
        // *** Store the token (e.g., in state, local storage, or set cookie via JS) ***
        Cookies.set('access_token', event.data.token, { path: '/' /* other options */ });
        // Update auth state in your app (e.g., call setUser)
        // setUser({ token: event.data.token }); // Example using context from Approach 1


        popup?.close();
        window.removeEventListener('message', handleAuthMessage); // Clean up listener
        toast.success("Authentication Successful")
        router.push("/");
      } else if (event.data?.type === 'auth_error') {
        console.log(event)
        console.error("Auth error from popup:", event.data.error);
        window.removeEventListener('message', handleAuthMessage); // Clean up listener
        popup?.close();
        toast.error(event.data?.error)
      }

      setIsLoading(false);
      setIsOutLookLoading(false);
    };

    window.addEventListener('message', handleAuthMessage);

    // Optional: Check if popup was closed without success
    const timer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(timer);
        setIsLoading(false);
        setIsOutLookLoading(false);
        window.removeEventListener('message', handleAuthMessage); // Clean up listener if popup closed manually
        console.log('Auth popup closed.');
      }
    }, 500);
  };
  return (
    <div className="min-h-screen h-auto w-full flex flex-col justify-center py-12 sm:px-6 px-2 lg:px-8 overflow-auto">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center sm:text-[2rem] text-[1.5rem] font-normal">
          <span className="italic text-primary-dark">
            Turn data into decisions with
          </span>
          <span className="block text-primary-main">Insight Agent</span>
        </h1>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md overflow-auto">
        <div className="sm:py-10 py-4 px-2 sm:px-10">
          {/* <h2 className="text-center text-xl font-medium text-black mb-6">
          Welcome! 
          Please sign in explore all features
          </h2> */}

          <div className="space-y-4">
            <button
              disabled={isLoading}
              onClick={handleGoogleAuth}
              type="button"
              className={cn("w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-main hover:bg-[#7d3a56] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-main disabled:opacity-50 disabled:cursor-not-allowed"
              )}


            >
              {isGoogleLoading && (
                <Loader className="w-5 h-5 mr-2 animate-spin" />
              )}
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                />
              </svg>
              Continue with Google
            </button>

            <button
              onClick={handleOutLookAuth}
              disabled={isLoading}
              type="button"
              className={cn("w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-main hover:bg-[#7d3a56] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-main disabled:opacity-50 disabled:cursor-not-allowed"
              )}>

              {isOutLookLoading && (
                <Loader className="w-5 h-5 mr-2 animate-spin" />
              )}
              <PiMicrosoftOutlookLogoFill className='size-5 mr-2' />

              Continue with OutLook
            </button>
          </div>
          {/* ——— OR Divider & Google Button ——— */}
          <div className="my-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-primary-100" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-neutral-300">OR</span>
            </div>
          </div>


          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* ——— Email Field ——— */}
            <div>
              <input
                type="email"
                placeholder="Email"
                className={`block w-full px-3 py-3 bg-primary-150 border ${errors.email ? 'border-red-500' : 'border-primary-100'
                  } rounded-md shadow-sm placeholder-neutral-150 focus:outline-none focus:ring-2 focus:ring-primary-main sm:text-sm transitiona-ll duration-200`}
                {...register('email', {
                  required: 'Email is required',
                  // pattern: {
                  //   value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  //   message: 'Invalid email address',
                  // },
                })}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* ——— Password Field + Validation List ——— */}
            <div className="relative w-full">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                className={cn(
                  "block w-full px-3 py-3 pr-10 bg-primary-150 border  rounded-md shadow-sm placeholder-neutral-150 focus:outline-none focus:ring-2 focus:ring-primary-main sm:text-sm transitiona-ll duration-200",
                  errors.password ? "border-red-500" : "border-primary-100"
                )}
                {...register("password", { required: "Password is required" })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-3 bottom-6 flex items-center"
              >
                {!showPassword ? <EyeOff className="w-5 h-5 text-neutral-500" /> : <Eye className="w-5 h-5 text-neutral-500" />}
              </button>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.password.message}
                </p>
              )}
              <div className='w-full text-right'>
                <button type='button' onClick={() => setIsOtpDialogOpen(true)} className='mt-1 text-sm hover:underline font-normal text-primary-main'>Forgot password</button>

              </div>


            </div>

            {/* ——— Submit Button ——— */}
            <div>
              <button
                disabled={isLoading}
                type="submit"
                className={cn("w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-main hover:bg-[#7d3a56] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-main disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isLoginLoading && (
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                )}
                Continue
              </button>
            </div>
          </form>

          {/* ——— Signup Link ——— */}
          <div className="mt-5 text-center">
            <p className="text-neutral-150">
              Don't have an account?{' '}
              <Link
                href="/signup"
                className="font-medium text-primary-main hover:text-[#7d3a56]"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>

      <OtpPasswordResetDialog open={isOtpDialogOpen} onOpenChange={setIsOtpDialogOpen} />
    </div>
  );
};

export default LoginPage;
