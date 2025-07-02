"use client";

import Button from "../components/Button";
import React, { useEffect, useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { axiosInstance } from "@/services/axiosInstance";
import { Pencil } from "lucide-react";

const PersonalizationPage = () => {


    const [introduction, setIntroduction] = useState("");
    const [location, setLocation] = useState("");
    const [language, setLanguage] = useState("English");
    const [responseLanguage, setResponseLanguage] = useState(
        "Automatic"
    );
    const [autoSuggest, setAutoSuggest] = useState(true);
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [aiDataRetention, setAiDataRetention] = useState(false);
    const [editIntroduction, setEditIntroduction] = useState(false);

    // Loading states for buttons
    const [loadingIntroduction, setLoadingIntroduction] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(false);

    const [loadingAll, setLoadingAll] = useState(false);

    useEffect(() => {
        const fetchPersonalizationInfo = async () => {
            try {
                const userId = localStorage.getItem("user_id") || "";


                const response = await axiosInstance.get(`/personalization_info/${userId}`);
                const data = response.data;

                // Update all states with fetched data (add null checks if needed)
                setIntroduction(data.introduction || "");
                setLocation(data.location || "");
                setLanguage(data.language || "English");
                setResponseLanguage(data.preferred_response_language || "Automatic");
                setAutoSuggest(data.autosuggest ?? true);
                setEmailNotifications(data.email_notifications ?? true);
                setAiDataRetention(data.ai_data_retention ?? true);
            } catch (error) {
                toast.error("Failed to load personalization info");
            }
        };

        fetchPersonalizationInfo();
    }, []);

    // Common API call function
    const updatePersonalization = async (data: {
        introduction?: string | null;
        location?: string | null;
        language?: string | null;
        preferred_response_language?: string | null;
        autosuggest?: boolean | null;
        email_notifications?: boolean | null;
        ai_data_retention?: boolean | null;
    }) => {
        try {
            const userId = localStorage.getItem("user_id") || "";

            const response = await axiosInstance.post(`/personalization/${userId}`, data);
            const updatedData = response.data;

            // Update states from response
            setIntroduction(updatedData.introduction || "");
            setLocation(updatedData.location || "");
            setLanguage(updatedData.language || "English");
            setResponseLanguage(updatedData.preferred_response_language || "Automatic");
            setAutoSuggest(updatedData.autosuggest ?? true);
            setEmailNotifications(updatedData.email_notifications ?? true);
            setAiDataRetention(updatedData.ai_data_retention ?? false);

            toast.success("Settings saved successfully!");
            return true;
        } catch (error: any) {
            toast.error(error.response?.data?.detail || "An error occurred");
            return false;
        }
    };

    // Handlers for individual updates

    const handleClear = () => {
        setIntroduction("");
    };

    const handleSaveIntroduction = async () => {
        setLoadingIntroduction(true);
        await updatePersonalization({ introduction });
        setEditIntroduction(false);
        setLoadingIntroduction(false);
    };

    const handleNotificationSave = async (checked: boolean) => {
        setEmailNotifications(checked);
        await updatePersonalization({ email_notifications: checked });
    };

    const handleAIDataRetentionSave = async (checked: boolean) => {
        setAiDataRetention(checked);
        await updatePersonalization({ ai_data_retention: checked });
    };


    const handleLocationSave = async () => {
        setLoadingLocation(true);
        await updatePersonalization({ location });
        setLoadingLocation(false);
    };

    const handleSaveLanguage = async (value: string) => {
        setLanguage(value);
        await updatePersonalization({ language: value })
    }

    const handleSaveResponseLanguage = async (value: string) => {
        setResponseLanguage(value);
        await updatePersonalization({ preferred_response_language: value })
    }




    const handleSaveAutoSuggest = async (checked: boolean) => {
        setAutoSuggest(checked);
        await updatePersonalization({ autosuggest: checked })
    }

    const handleSaveAll = async () => {
        setLoadingAll(true);
        await updatePersonalization({
            introduction: introduction,
            location,
            language,
            preferred_response_language: responseLanguage,
            autosuggest: autoSuggest,
            email_notifications: emailNotifications,
            ai_data_retention: aiDataRetention,
        });
        setLoadingAll(false);
    };

    // ToggleSwitch component unchanged
    const ToggleSwitch = ({
        checked,
        onChange,
    }: {
        checked: boolean;
        onChange: (value: boolean) => void;
    }) => (
        <div
            className={`relative inline-flex sm:h-6 h-4 sm:w-11 w-8 items-center rounded-full transition-colors duration-300 ease-in-out cursor-pointer ${checked ? "bg-primary-main" : "bg-gray-300"
                }`}
            onClick={() => onChange(!checked)}
        >
            <span
                className={`inline-block sm:h-4 h-2.5 sm:w-4 w-2.5 transform rounded-full bg-white transition-transform duration-300 ease-in-out ${checked ? "sm:translate-x-6 translate-x-5" : "translate-x-1"
                    }`}
            />
        </div>
    );


    const handleEditIntroduction = () => {
        setEditIntroduction(true);
    }

    return (
        <div className="h-screen w-full flex items-center justify-center overflow-y-auto sm:py-6 pb-6">
            <div className="max-w-3xl flex-1 h-full w-full lg:px-0 sm:px-6 px-5">
                <div className="">
                    <h1 className="text-2xl font-medium text-black text-center border-b border-primary-100 py-6">
                        Personalization
                    </h1>

                    {/* Introduce Yourself Section */}
                    <div className="my-10">
                        <h2 className="sm:text-xl text-base leading-tight font-medium text-black mb-4">
                            Introduce Yourself
                        </h2>
                        <div className="relative">
                            <textarea
                                value={introduction}
                                disabled={!editIntroduction}
                                onChange={(e) => setIntroduction(e.target.value)}
                                className={`block w-full h-[6.8rem] sm:px-5 sm:py-4 py-2 px-4 resize-none rounded-xl bg-primary-150 border border-primary-100 shadow-sm placeholder-neutral-150 focus:outline-none focus:ring-2 focus:ring-primary-main sm:sm:text-sm text-xs transitiona-ll duration-200`}
                                placeholder="Tell us about yourself..."
                            />


                            {
                                editIntroduction ? (
                                    <div className="flex justify-end gap-3 mt-4">

                                        <Button
                                            variant="outline"
                                            size="md"
                                            className="sm:py-3 py-2 sm:px-6 px-4 font-semibold"
                                            disabled={!introduction || loadingIntroduction}
                                            onClick={handleClear}
                                        >
                                            Clear
                                        </Button>
                                        <Button
                                            variant="primary"
                                            className="sm:py-3 py-2 sm:px-6 px-4 font-semibold"
                                            disabled={loadingIntroduction || !introduction}
                                            onClick={handleSaveIntroduction}
                                        >
                                            {loadingIntroduction ? "Saving..." : "Save"}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex justify-end gap-3 mt-4">
                                        <Button

                                            variant="outline"
                                            size="md"
                                            className="sm:py-3 py-2 sm:px-6 px-4 font-semibold"

                                            onClick={handleEditIntroduction}
                                        >Edit
<Pencil className="size-4 ml-2" />

                                        </Button>
                                    </div>
                                )
                            }


                        </div>
                    </div>

                    {/* Location Section */}
                    <div className="mt-7">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="sm:text-xl text-base leading-tight font-medium text-black">
                                Location
                            </h2>
                            <ToggleSwitch checked={true} onChange={() => { }} />
                        </div>
                        <p className="sm:text-sm text-xs text-[#646262] mb-4">
                            Enter a location or enable precise location to get more accurate
                            News and Financial updates
                        </p>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className={`block w-full max-w-[280px] px-3 py-3 bg-primary-150 border border-primary-100 rounded-md shadow-sm placeholder-neutral-150 focus:outline-none focus:ring-2 focus:ring-primary-main sm:sm:text-sm text-xs transitiona-ll duration-200`}
                                placeholder="Enter your location"
                            />
                            <Button
                                variant="primary"
                                size="md"
                                className="sm:py-3 py-2 sm:px-6 px-4 font-semibold"
                                onClick={handleLocationSave}
                                disabled={loadingLocation || !location}
                            >
                                {loadingLocation ? "Saving..." : "Save"}
                            </Button>
                        </div>
                    </div>

                    {/* Line Horizontal */}
                    <hr className="my-10 border-t border-primary-100" />

                    {/* Language Section */}
                    <div className="flex items-center justify-between flex-wrap gap-y-2">
                        <div>
                            <h2 className="sm:text-xl text-base leading-tight font-medium text-black ">
                                Language
                            </h2>
                            <p className="sm:text-sm text-xs text-[#646262]">
                                The language used in the user interface
                            </p>
                        </div>
                        <div className="w-full max-w-[240px]">
                            <Select value={language} onValueChange={(value) => handleSaveLanguage(value)} disabled={loadingAll}>
                                <SelectTrigger className="w-full px-4 py-3 border border-primary-100  sm:text-sm text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-main focus:border-transparent">
                                    <SelectValue placeholder="Select language" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="English">English</SelectItem>
                                    <SelectItem value="Arabic">Arabic</SelectItem>

                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Preferred Response Language Section */}
                    <div className="my-6 flex items-center justify-between flex-wrap gap-y-2">
                        <div>
                            <h2 className="sm:text-xl text-base leading-tight font-medium text-black mb-2">
                                Preferred response language
                            </h2>
                            <p className="sm:text-sm text-xs text-[#646262]">
                                The language used for AI responses
                            </p>
                        </div>
                        <div className="w-full max-w-[240px]">
                            <Select
                                value={responseLanguage}
                                onValueChange={(value) => handleSaveResponseLanguage(value)}
                                disabled={loadingAll}
                            >
                                <SelectTrigger className="w-full px-4 py-3.5 border border-primary-100   sm:text-sm text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-main focus:border-transparent">
                                    <SelectValue placeholder="Select response language" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Automatic">
                                        Automatic (Detect Input)
                                    </SelectItem>
                                    <SelectItem value="English">English</SelectItem>
                                    <SelectItem value="Arabic">Arabic</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Autosuggest Section */}
                    <div className="">
                        <div>
                            <div className="flex items-center justify-between">
                                <h2 className="sm:text-xl text-base leading-tight font-medium text-black mb-1">
                                    Autosuggest
                                </h2>
                                <ToggleSwitch checked={autoSuggest} onChange={() => handleSaveAutoSuggest(!autoSuggest)} />
                            </div>
                            <p className="sm:text-sm text-xs text-[#646262]">
                                Enable dropdown and tab-complete suggestions while typing a
                                query
                            </p>
                        </div>
                    </div>

                    {/* Line Horizontal */}
                    <hr className="my-10 border-t border-primary-100" />
                    {/* Email Notifications Section */}
                    <div className="">
                        <div className="">
                            <div className="flex justify-between items-center">
                                <h2 className="sm:text-xl text-base leading-tight font-medium text-black mb-1">
                                    Email notifications
                                </h2>
                                <ToggleSwitch
                                    checked={emailNotifications}
                                    onChange={() => handleNotificationSave(!emailNotifications)}
                                />
                            </div>
                            <p className="sm:text-sm text-xs text-[#646262]">
                                Updates when the research is complete
                            </p>
                        </div>
                    </div>

                    {/* Line Horizontal */}
                    <hr className="my-10 border-t border-primary-100" />

                    {/* AI Data Retention Section */}
                    <div>
                        <div>
                            <div className="flex items-center justify-between">
                                <h2 className="sm:text-xl text-base leading-tight font-medium text-black mb-1">
                                    AI Data Retention
                                </h2>
                                <ToggleSwitch
                                    checked={aiDataRetention}
                                    onChange={() => handleAIDataRetentionSave(!aiDataRetention)}
                                />
                            </div>

                            <p className="sm:text-sm text-xs text-[#646262] leading-relaxed max-w-md">
                                AI Data Retention allows insight-Agent to use your searches to
                                improve AI models. Turn this setting off if you wish to exclude
                                your data from this process.
                            </p>
                        </div>
                    </div>

                    {/* Save All Changes Button */}
                    <div className="mt-10 flex justify-center">
                        <Button
                            variant="primary"
                            size="lg"
                            className="py-3 px-8 font-semibold"
                            onClick={handleSaveAll}
                            disabled={loadingAll || loadingIntroduction || loadingLocation}
                        >
                            {loadingAll ? "Saving All..." : "Save All Changes"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PersonalizationPage;
