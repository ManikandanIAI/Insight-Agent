"use client"


import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import React, { useEffect, useState } from "react";
import InacurateIcon from "../../../../components/icons/InacurateIcon";
import OutOfDateIcon from "../../../../components/icons/OutOfDateIcon";
import TooShortIcon from "../../../../components/icons/TooShortIcon";
import OffensiveIcon from "../../../../components/icons/OffensiveIcon";
import WrongSourcesIcon from "../../../../components/icons/WrongSourcesIcon";
import TooLongIcon from "../../../../components/icons/TooLongIcon";
import { cn } from "@/lib/utils";
import { axiosInstance } from "@/services/axiosInstance";
import { toast } from "sonner";

interface FeedbackData {
  text: string
  isActive: boolean
  icon: React.ReactNode

}

interface FeedbackDialogProps {
  isOpen: boolean;
  messageId: string | null;
  responseId: string | null;
  onOpenChange: (open: boolean) => void;
}

function FeedbackDialog({ isOpen, messageId, responseId, onOpenChange }: FeedbackDialogProps) {

  const [feedbackDataOption, setFeedbackDataOption] = useState<FeedbackData[] | []>([
    {
      text: "Inaccurate", isActive: false, icon: <InacurateIcon isActive={false} />,
    },
    {
      text: "Out of date", isActive: false, icon: <OutOfDateIcon isActive={false} />,
    },
    {
      text: "Too Short", isActive: false, icon: <TooShortIcon isActive={false} />,
    },
    {
      text: "Too long", isActive: false, icon: <TooLongIcon isActive={false} />,
    },
    {
      text: "Harmful or offensive", isActive: false, icon: <OffensiveIcon isActive={false} />,
    },
    {
      text: "Wrong sources", isActive: false, icon: <WrongSourcesIcon isActive={false} />,
    }
  ]);

  

  const [humanFeedback, setHumanFeedback] = useState<string>("");
  const [loading, setloading] =useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setFeedbackDataOption(prev => 
        prev.map(option => ({ ...option, isActive: false }))
      );
      setHumanFeedback("");
    }
  }, [isOpen]);


  const toggleOption = (index: number) => {
    setFeedbackDataOption((prev) => {
      const newOptions = [...prev];
      newOptions[index] = {
        ...newOptions[index],
        isActive: !newOptions[index].isActive,
      }

      return newOptions;
    })
    
  };



  const handleClose = () => {
    
    document.body.style.pointerEvents = "auto"; 
    onOpenChange(false);
  }


  const handleFeedbackResponse = async () => {
    try {
      setloading(true);
      await axiosInstance.put("/response-feedback", {
        message_id: messageId,
        response_id: responseId,
        feedback_tag: feedbackDataOption
          .filter(o => o.isActive)
          .map(o => o.text.toLowerCase()),
        human_feedback: humanFeedback,
      });
      toast.success("Feedback submitted successfully");
      setTimeout(handleClose, 1000);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Error submitting feedback");
    } finally {
      setloading(false);
    }
  }
  


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      
      <DialogContent className="max-w-xl rounded-lg shadow-xl p-6 bg-[#F2EBEF]">
        <div className="flex justify-between items-center">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold leading-normal tracking-normal text-black ">
              Help Us Improve
            </DialogTitle>
            <p className="text-xs font-normal leading-normal tracking-normal text-muted-foreground">
              Provide additional feedback on this answer. Select all that apply.
            </p>
          </DialogHeader>

        </div>

        <div className="grid grid-cols-2 gap-2">
          {feedbackDataOption.map((option, index) => (
            <button
              key={index}

              onClick={() => toggleOption(index)}
              className={cn("text-sm bg-[#FCFCFA] rounded-lg px-3 py-2 flex items-center justify-start", option.isActive && "text-black bg-[#D76CA1]")}
            >
              <span className="mr-1">{option.icon}</span>{option.text}
            </button>
          ))}
        </div>

        <div className="">
          <label className="text-sm font-semibold leading-normal tracking-normal text-black">How Can The Response Be Improved? (Optional)</label>
          <textarea onChange={(e) => setHumanFeedback(e.target.value)} placeholder="Your Feedback" className="rounded-[6rem] mt-3 w-full p-3 h-[48px] text-black resize-none" />
        </div>

        <DialogFooter>
          <div className="flex w-full items-center justify-start gap-2 pt-4">
            <Button onClick={handleFeedbackResponse} disabled={loading || !feedbackDataOption.some(option => option.isActive)} className="bg-[#D76CA1] text-sm font-semibold leading-normal tracking-normal hover:bg-primary-main rounded-lg text-white px-6 py-3" >
              Submit
            </Button>
            <Button onClick={handleClose} variant="outline" className="text-[#D76CA1] bg-[#F2EBEF] text-sm font-semibold leading-normal tracking-normal border hover:text-primary-main rounded-lg px-6 py-3 border-primary-main">
              Cancel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default React.memo(FeedbackDialog);