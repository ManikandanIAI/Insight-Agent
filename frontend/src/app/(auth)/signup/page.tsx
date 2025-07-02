// SignupPage.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader, Check, X, Search, EyeOff, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import ApiServices from "@/services/ApiServices";
import { SignupFormData } from "@/types/auth-types";
import { SelectItem } from "@/components/ui/select";
import { useRef } from 'react';
import { PiMicrosoftOutlookLogoFill, } from "react-icons/pi";
import Cookies from "js-cookie";
import { API_ENDPOINTS } from "@/services/endpoints";
import OTPDialog, { IRegisterationData } from "./components/OTPDialog";



const SignupPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<SignupFormData>();

  // watch password and confirm
  const password = watch("password", "");
  const confirm = watch("confirmPassword", "");

  const containerRef = useRef<HTMLDivElement | null>(null);

  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isSignUpLoading, setisSignUpLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isOutLookLoading, setIsOutLookLoading] = useState(false);
  const [openOTPDialog, setOpenOTPDialog] = useState(false);
  const [registerationData, setRegisterationData] = useState<IRegisterationData | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);




  // has the user started typing a password?
  const isTouched = password.length > 0;
  // has the user started typing confirmation?
  const confirmTouched = confirm.length > 0;

  // password rules
  const rules = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[@$!%*?&]/.test(password),
    match: confirm.length > 0 && password === confirm,
  };

  // all password rules except match (we can include match too if desired)
  const allValid = Object.values(rules).every(Boolean);

  const onSubmit: SubmitHandler<SignupFormData> = async (data) => {
    setIsLoading(true);
    try {
      // const rawPhone = `${selectedCountry?.dial_code}${data.phone.replace(/^0+/, '')}`;
      // const phoneNumber = parsePhoneNumberFromString(rawPhone);
      // const formattedPhone = phoneNumber ? phoneNumber.number : rawPhone;
      const { fullName, email, password } = data;
      setRegisterationData({ fullName, email, password });
      const response = await ApiServices.signup(
        fullName,
        email,
        // formattedPhone,
        password);
      setOpenOTPDialog(true);
      toast.success(`A 6-digit OTP has been sent to your email`)

    } catch (error: any) {
      toast.error(error?.response?.data.detail || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false)
      reset();
    }
  };

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
        router.push("/onboarding");
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
        router.push("/onboarding");
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
    <div className="min-h-screen w-full flex flex-col justify-center py-12 sm:px-6 px-2 lg:px-8 overflow-auto">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center sm:text-[2rem] text-[1.5rem] font-normal">
          <span className="italic text-primary-dark">
            Turn data into decisions with
          </span>
          <span className="block text-primary-main">Insight Agent</span>
        </h1>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="sm:py-10 py-4 px-2 sm:px-10">
          {/* <h2 className="text-center text-xl font-medium text-black mb-6">
            Welcome! Please sign up to explore all features
          </h2> */}
          {/* Google Button */}
          <div className="space-y-4">
            <button
              onClick={handleGoogleAuth}
              type="button"
              disabled={isLoading}
              className={cn("w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-main hover:bg-[#7d3a56] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-main disabled:opacity-50 disabled:cursor-not-allowed"
              )}            >

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
              type="button"
              disabled={isLoading}
              className={cn("w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-main hover:bg-[#7d3a56] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-main disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isOutLookLoading && (
                <Loader className="w-5 h-5 mr-2 animate-spin" />
              )}
              <PiMicrosoftOutlookLogoFill className='size-5 mr-2' />

              Continue with OutLook
            </button>
          </div>
          {/* OR Divider */}
          <div className="my-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-primary-100" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-neutral-150">OR</span>
            </div>
          </div>



          {/* -----------Signup Form------------ */}
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {/* Full Name */}
            <div>
              <input
                type="text"
                placeholder="Full Name"
                className={cn(
                  "block w-full px-3 py-3 bg-primary-150 border  rounded-md shadow-sm placeholder-neutral-150 focus:outline-none focus:ring-2 focus:ring-primary-main sm:text-sm transitiona-ll duration-200",
                  errors.fullName ? "border-red-500" : "border-primary-100"
                )}
                {...register("fullName", {
                  required: "Full name is required",
                  minLength: {
                    value: 2,
                    message: "Name must be at least 2 characters",
                  },
                })}
              />
              {errors.fullName && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <input
                type="email"
                placeholder="Email"
                className={cn(
                  "block w-full px-3 py-3 bg-primary-150 border  rounded-md shadow-sm placeholder-neutral-150 focus:outline-none focus:ring-2 focus:ring-primary-main sm:text-sm transitiona-ll duration-200",
                  errors.email ? "border-red-500" : "border-primary-100"
                )}
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Invalid email address",
                  },
                })}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Phone */}

            {/* <div ref={containerRef} className="flex gap-x-2">
            
              <div className="w-[30%] relative">
             


                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full h-full bg-primary-150 border  rounded-md shadow-sm placeholder-neutral-150 focus:outline-none focus:border-primary-main sm:text-sm px-3 py-2 text-left"
                >
                  <span>
                    {selectedCountry
                      ? `${selectedCountry?.dial_code} (${selectedCountry?.code})`
                      : 'Select country'}
                  </span>
                </button>

               
                {isDropdownOpen && (
                  <div className="absolute w-max z-10 mt-1 bg-white border rounded-md shadow-lg">
                  
                    <div className="p-2">
                      <input
                        placeholder="Search country..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                        className="block w-full p-2 bg-primary-150 border  rounded-md shadow-sm placeholder-neutral-150 focus:outline-none focus:ring-2 focus:ring-primary-main sm:text-sm transitiona-ll duration-200"
                      />
                    </div>

                   
                    <div className="max-h-48 overflow-y-auto">
                      {filteredCountries.length > 0 ? (
                        filteredCountries.map((country) => (
                          <div
                            key={country.code}
                            onClick={() => handleCountrySelect(country)}
                            className={cn("px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100", {
                              "bg-primary-150": selectedCountry?.code === country.code,
                              "text-primary-main": selectedCountry?.code === country.code,
                            })}
                          >
                            {country.dial_code} ({country.name})
                          </div>
                        ))
                      ) : (
                        <div className="px-2 py-1 text-sm text-gray-500">
                          No country found.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

          
              <div className="w-[70%]">
                <input
                  type="tel"
                  placeholder="Phone Number"
                  className={cn(
                    'block w-full px-3 py-3 border bg-primary-150 rounded-md shadow-sm placeholder-neutral-150 focus:outline-none focus:ring-2 focus:ring-primary-main sm:text-sm transitiona-ll duration-200',
                    errors.phone ? 'border-red-500' : 'border-primary-100'
                  )}
                  {...register('phone', {
                    required: 'Phone number is required',
                    pattern: {
                      value: /^\d{6,12}$/,
                      message: "Invalid phone number",
                    },
                    validate: (value) => {
                      if (!selectedCountry) {
                        return 'Please select a country first';
                      }
                     
                    },
                  })}
                />
                {errors.phone && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.phone.message}
                </p>
              )}
              </div>
            </div> */}


            {/* Password */}
            <div className="relative">
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
                className="absolute inset-y-0 right-3 flex items-center"
              >
                {!showPassword ? <EyeOff className="w-5 h-5 text-neutral-500" /> : <Eye className="w-5 h-5 text-neutral-500" />}
              </button>
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
            </div>

            {/* Confirm Password Field */}
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                className={cn(
                  "block w-full px-3 py-3 pr-10 bg-primary-150 border  rounded-md shadow-sm placeholder-neutral-150 focus:outline-none focus:ring-2 focus:ring-primary-main sm:text-sm transitiona-ll duration-200",
                  errors.confirmPassword ? "border-red-500" : "border-primary-100"
                )}
                {...register("confirmPassword", { required: "Please confirm your password" })}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-3 flex items-center"
              >
                {!showConfirmPassword ? <EyeOff className="w-5 h-5 text-neutral-500" /> : <Eye className="w-5 h-5 text-neutral-500" />}
              </button>
            </div>

            {/* Live checklist */}
            <ul className="mt-3 space-y-1 text-sm">

              <li className="flex items-center">
                {rules.length ? (
                  <Check
                    className={cn(
                      "w-4 h-4",
                      !isTouched
                        ? "text-neutral-500"
                        : "text-green-500"
                    )}
                  />
                ) : (
                  <X
                    className={cn(
                      "w-4 h-4",
                      !isTouched
                        ? "text-neutral-500"
                        : "text-red-500"
                    )}
                  />
                )}
                <span
                  className={cn(
                    "ml-2 text-xs font-normal",
                    !isTouched
                      ? "text-neutral-500"
                      : rules.length
                        ? "text-green-600"
                        : "text-red-500"
                  )}
                >
                  Be at least 8 characters long.
                </span>
              </li>


              <li className="flex items-center">
                {rules.upper ? (
                  <Check
                    className={cn(
                      "w-4 h-4",
                      !isTouched
                        ? "text-neutral-500"
                        : "text-green-500"
                    )}
                  />
                ) : (
                  <X
                    className={cn(
                      "w-4 h-4",
                      !isTouched
                        ? "text-neutral-500"
                        : "text-red-500"
                    )}
                  />
                )}
                <span
                  className={cn(
                    "ml-2 text-xs font-normal",
                    !isTouched
                      ? "text-neutral-500"
                      : rules.upper
                        ? "text-green-600"
                        : "text-red-500"
                  )}
                >
                  Include at least one uppercase letter (A-Z).
                </span>
              </li>


              <li className="flex items-center">
                {rules.lower ? (
                  <Check
                    className={cn(
                      "w-4 h-4",
                      !isTouched
                        ? "text-neutral-500"
                        : "text-green-500"
                    )}
                  />
                ) : (
                  <X
                    className={cn(
                      "w-4 h-4",
                      !isTouched
                        ? "text-neutral-500"
                        : "text-red-500"
                    )}
                  />
                )}
                <span
                  className={cn(
                    "ml-2 text-xs font-normal",
                    !isTouched
                      ? "text-neutral-500"
                      : rules.lower
                        ? "text-green-600"
                        : "text-red-500"
                  )}
                >
                  Include at least one lowercase letter (a-z).
                </span>
              </li>


              <li className="flex items-center">
                {rules.number ? (
                  <Check
                    className={cn(
                      "w-4 h-4",
                      !isTouched
                        ? "text-neutral-500"
                        : "text-green-500"
                    )}
                  />
                ) : (
                  <X
                    className={cn(
                      "w-4 h-4",
                      !isTouched
                        ? "text-neutral-500"
                        : "text-red-500"
                    )}
                  />
                )}
                <span
                  className={cn(
                    "ml-2 text-xs font-normal",
                    !isTouched
                      ? "text-neutral-500"
                      : rules.number
                        ? "text-green-600"
                        : "text-red-500"
                  )}
                >
                  Include at least one number (0-9).
                </span>
              </li>


              <li className="flex items-center">
                {rules.special ? (
                  <Check
                    className={cn(
                      "w-4 h-4",
                      !isTouched
                        ? "text-neutral-500"
                        : "text-green-500"
                    )}
                  />
                ) : (
                  <X
                    className={cn(
                      "w-4 h-4",
                      !isTouched
                        ? "text-neutral-500"
                        : "text-red-500"
                    )}
                  />
                )}
                <span
                  className={cn(
                    "ml-2 text-xs font-normal",
                    !isTouched
                      ? "text-neutral-500"
                      : rules.special
                        ? "text-green-600"
                        : "text-red-500"
                  )}
                >
                  Include at least one special character (e.g. !@#$%).
                </span>

              </li>

              <li className="flex items-center">
                {rules.match ? (
                  <Check
                    className={cn(
                      "w-4 h-4",
                      !confirmTouched ? "text-neutral-500" : "text-green-500"
                    )}
                  />
                ) : (
                  <X
                    className={cn(
                      "w-4 h-4",
                      !confirmTouched ? "text-neutral-500" : "text-red-500"
                    )}
                  />
                )}
                <span
                  className={cn(
                    "ml-2 text-xs font-normal",
                    !confirmTouched
                      ? "text-neutral-500"
                      : rules.match
                        ? "text-green-600"
                        : "text-red-500"
                  )}
                >
                  Passwords match.
                </span>
              </li>

            </ul>

            {/* Submit */}
            <div>
              <button
                type="submit"
                disabled={!allValid || !rules.match || isLoading}
                className={cn("w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-main hover:bg-[#7d3a56] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-main disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isSignUpLoading && <Loader className="w-5 h-5 mr-2 animate-spin" />}
                Continue
              </button>
            </div>
          </form>

          {/* ----------LogIn Link--------- */}
          <div className="mt-5 text-center text-sm">
            <p className="text-neutral-150">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-primary-main hover:text-[#7d3a56]"
              >
                Log in
              </Link>
            </p>
          </div>




        </div>
      </div>

      {registerationData && (
        <OTPDialog open={openOTPDialog} registerationData={registerationData} onOpenChange={setOpenOTPDialog} />
      )}
    </div>
  );
};

export default SignupPage;



