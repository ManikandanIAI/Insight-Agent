"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SelectGroup } from "@radix-ui/react-select";
import Image from "next/image";
import { toast } from "sonner";
import ApiServices from "@/services/ApiServices";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import MultiSelectDropdown from "@/components/ui/multiSelect";


const toolsData:string[] = ["ChatGPT", "Claude", "Perplexity", "Others"];

const OnBoarding = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    role: "",
    finance_experience: "",
    learning_style: "",
    tools_used: "",
    insight_goal: "",
  });

  const user_id = localStorage.getItem("user_id") || ""; // Replace this

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        ...formData,
      };

      await ApiServices.handleOnboardingQuestion(user_id, payload);
      toast.success("Submitted successfully!");
      router.push("/");
    } catch (error) {
      toast.error("Failed to submit onboarding form.");
    } finally {
      setLoading(false);
    }
  };

  const handleRedirection = () => {
    router.push("/");
  };

  return (
    <div className="mx-auto h-screen flex items-center justify-center">
      <div className="max-w-xl sm:px-0 px-4 sm:space-y-3 space-y-2.5">
        <div className="mb-10 flex flex-col items-center space-y-3.5">
          <Image
            src="/images/iai_logo_medium.svg"
            alt="logo"
            height={60}
            width={272}
          />
          <h2 className="sm:text-base text-sm text-center font-medium text-black">
            Help us customize Insight Agent for you. Answer a few quick
            questions.
          </h2>
        </div>

        <div className="max-w-sm flex flex-col mx-auto sm:gap-y-6 gap-y-4">
          {/* Role */}
          <div className="sm:space-y-3 space-y-2">
            <Label className="sm:text-sm text-xs font-mormal text-[#313131]">
              What best describes your role?
            </Label>
            <Select
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, role: value }))
              }
            >
              <SelectTrigger className="w-full sm:px-5 px-4 sm:py-6 py-5 sm:rounded-xl rounded-lg sm:text-base text-sm bg-[#FCFBFA] border border-primary-100 text-[#BAB9B9] font-medium focus:bg-[#F3E6ED] active:bg-[#F3E6ED] active:border-transparent focus:ring-[#F3E6ED] focus:border-transparent focus:text-black">
                <SelectValue placeholder="Choose your Profession" />
              </SelectTrigger>
              <SelectContent className="p-0 rounded-[12px] border-none bg-white shadow-[0px_9px_30px_0px_rgba(0,0,0,0.06)]">
                <SelectGroup className="text-sm text-[#676767] font-normal">
                  <SelectLabel className="px-4">Choose your Profession</SelectLabel>
                  <Separator className="-mx-6 w-[120%] my-1" />
                  <SelectItem className="px-4" value="Individual investor">Individual investor</SelectItem>
                  <SelectItem className="px-4" value="Financial analyst">Financial analyst</SelectItem>
                  <SelectItem className="px-4" value="Student / researcher">Student / researcher</SelectItem>
                  <SelectItem className="px-4" value="Finance creator or educator">Finance creator or educator</SelectItem>
                  <SelectItem className="px-4" value="Financial advisor / planner">Financial advisor / planner</SelectItem>
                  <SelectItem className="px-4" value="Others">Others</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Finance Experience */}
          <div className="sm:space-y-3 space-y-2">
            <Label className="sm:text-sm text-xs font-mormal text-[#313131]">
              What's your current experience level with Finance?
            </Label>
            <Select
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, finance_experience: value }))
              }
            >
              <SelectTrigger className="w-full sm:px-5 px-4 sm:py-6 py-5 sm:rounded-xl rounded-lg sm:text-base text-sm bg-[#FCFBFA] border border-primary-100 text-[#BAB9B9] font-medium focus:bg-[#F3E6ED] active:bg-[#F3E6ED] active:border-transparent focus:ring-[#F3E6ED] focus:border-transparent focus:text-black">
                <SelectValue placeholder="Choose Option" />
              </SelectTrigger>
              <SelectContent className="p-0 rounded-[12px] border-none bg-white shadow-[0px_9px_30px_0px_rgba(0,0,0,0.06)]">
                <SelectGroup className="text-sm text-[#676767] font-normal">
                  <SelectLabel className="px-4">Choose Option</SelectLabel>
                  <Separator className="-mx-6 w-[120%] my-1" />
                  <SelectItem className="px-4" value="Beginner">Beginner</SelectItem>
                  <SelectItem className="px-4" value="Intermediate">Intermediate</SelectItem>
                  <SelectItem className="px-4" value="Expert">Expert</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Learning Style */}
          <div className="sm:space-y-3 space-y-2">
            <Label className="sm:text-sm text-xs font-mormal text-[#313131]">
              What's your preferred learning or response style?
            </Label>
            <Select
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, learning_style: value }))
              }
            >
              <SelectTrigger className="w-full sm:px-5 px-4 sm:py-6 py-5 sm:rounded-xl rounded-lg sm:text-base text-sm bg-[#FCFBFA] border border-primary-100 text-[#BAB9B9] font-medium focus:bg-[#F3E6ED] active:bg-[#F3E6ED] active:border-transparent focus:ring-[#F3E6ED] focus:border-transparent focus:text-black">
                <SelectValue placeholder="Choose Option" />
              </SelectTrigger>
              <SelectContent className="p-0 rounded-[12px] border-none bg-white shadow-[0px_9px_30px_0px_rgba(0,0,0,0.06)]">
                <SelectGroup className="text-sm text-[#676767] font-normal">
                  <SelectLabel className="px-4">Choose Option</SelectLabel>
                  <Separator className="-mx-6 w-[120%] my-1" />
                  <SelectItem className="px-4" value="Visual">Visual</SelectItem>
                  <SelectItem className="px-4" value="Auditory">Auditory</SelectItem>
                  <SelectItem className="px-4" value="Research">Research</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Tools Used */}
          <div className="sm:space-y-3 space-y-2 ">
            <Label className="sm:text-sm text-xs font-mormal text-[#313131]">
              Which tools do you currently use?
            </Label>
            <MultiSelectDropdown selected={formData.tools_used} onValueChange={(value:any) => setFormData((prev) => ({ ...prev, tools_used: value }))} data={toolsData} />
          </div>

          {/* Insight Goal */}
          <div className="sm:space-y-3 space-y-2">
            <Label htmlFor="goal" className="sm:text-sm text-xs font-mormal text-[#313131]">
              What do you want from Insight Agent?
            </Label>
            <textarea
              id="goal"
              placeholder="Ask anything.."
              value={formData.insight_goal}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  insight_goal: e.target.value,
                }))
              }
              className="w-full border border-[#F3F0E8] text-sm text-[#333131] bg-primary-150 focus:bg-[#F3E6ED] rounded-xl px-4 py-3 leading-relaxed font-medium pb-0 min-h-24 resize-none placeholder:text-neutral-150 focus:outline-none"
            ></textarea>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={
              !formData.role ||
              !formData.finance_experience ||
              !formData.learning_style ||
              !formData.tools_used ||
              loading
            }
            className="inline-flex sm:text-base text-sm sm:h-12 h-10 px-5 items-center justify-center rounded-lg font-medium transition-colors duration-200 bg-primary-main text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-5 animate-spin text-white" /> : "Start Researching"}
          </button>

          <button onClick={handleRedirection} className="sm:text-base text-sm text-black font-medium">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnBoarding;
