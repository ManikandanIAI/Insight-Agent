"use client";

import {
  ChevronDown,
  Ellipsis,
  FileText,
  Globe,
  Loader2,
  MoveUp,
  Paperclip,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { SearchMode, useMessageStore } from "@/store/useZustandStore";
import { PiPlanetLight } from "react-icons/pi";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HiArrowUp } from "react-icons/hi";
import { IPreviewFileData, IUploadFile } from "@/app/(chats)/chat/component/SpecificChat";
import { toast } from "sonner";
import { uniqueId } from "lodash";
import ApiServices from "@/services/ApiServices";
import FilePreviewDialog from "@/app/(chats)/chat/component/DocumentPreviewModal";

export type researchData = {
  agentName: string;
  title: string;
};

export type Message = {
  content: string | string[];
  sender?: "user" | "assistant";
  type?: string;
  actionData?: any;
  researchData?: researchData[] | [];
  messageId?: string;
};

interface ILoadingDetails {
  isLoading: Boolean;
  agentName: string;
  title: string;
  link?: string;
}

const ChatArea = () => {
  const [query, setQuery] = useState("");
  const [loadingDetails, setLoadingDetails] = useState<ILoadingDetails[] | []>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const chatDivRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const setMessage = useMessageStore((state) => state.setMessage);
  const setDocumentsIds = useMessageStore((state) => state.setDocuments);
  const setSearchMode = useMessageStore((state) => state.setSearchMode);
  const setDeepResearch = useMessageStore((state) => state.setDeepResearch);
  const deepResearch = useMessageStore((state) => state.deepResearch);
  const currentSearchMode = useMessageStore((state) => state.searchMode);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const textContainerRef = useRef<HTMLDivElement | null>(null);
  const [uploadedFileData, setUploadedFileData] = useState<IUploadFile[] | []>([]);

  const [defaultPrompts, setDefaultPrompts] = useState<string[] | []>(["⚖️ Risk assessment", "🌐 Economic indicators", "🔍 Market Sentiment", "📉 Sector trends", "📁 Portfolio strategy"])
  const [openPreviewDialog, setOpenPreviewDialog] = useState(false);
  const [currentPreviewFile, setCurrentPreviewFile] = useState<IPreviewFileData | null>(null);
  const docRef = useRef<HTMLInputElement | null>(null);
  const MAX_HEIGHT = uploadedFileData.length > 3 ? 372 : uploadedFileData.length > 0 ? 260 + 47 : 260;

  const handleAutoTextAreaResize = (ta: HTMLTextAreaElement) => {
    ta.style.height = 'auto';
    const scrollH = ta.scrollHeight;
    const newH = Math.min(scrollH, MAX_HEIGHT);
    ta.style.height = `${newH}px`;
  };

  useLayoutEffect(() => {
    if (textAreaRef.current) {
      handleAutoTextAreaResize(textAreaRef.current);
    }
  }, []);



  const sendMessage = async () => {
    const message = query.trim();
    const documents = uploadedFileData.map((file) => ({
      fileName: file.fileName,
      fileType: file.type,
      generatedFileId: file.generatedFileId
    }));
    setDocumentsIds(documents || []);
    setMessage(message);
    setQuery("");
    router.push(`/chat`);
  };

  useEffect(() => {
    if (chatDivRef.current) {
      chatDivRef.current.scrollTop = chatDivRef.current.scrollHeight;
    }
  }, [messages, loadingDetails]);


  const handleAgentChange = (value: SearchMode) => {
    setSearchMode(value);
  };

  const openDocUpload = () => {
    if (docRef.current) {
      docRef.current.click();
    }
  }



  const handleDocUploadChange = async (file: FileList | null) => {
    if (file) {
      const uploadedfile = file[0];
      const maxSize = 2 * 1024 * 1024; // 1MB

      if (uploadedfile.size > maxSize) {
        toast.error("File size limit exceeded. Please upload files smaller than 2MB.");
        return;
      }

      if (uploadedFileData.length >= 5) {
        toast.error("Maximum file upload limit reached.");
        return;
      }

      const fileId = uniqueId();

      // Add file to state with uploading status
      setUploadedFileData((prev) => {
        const fileDetails: IUploadFile = {
          fileId: fileId,
          fileName: uploadedfile.name,
          type: uploadedfile.type,
          isUploading: true,
          generatedFileId: ""
        };
        return [...prev, fileDetails];
      });

      const userId = localStorage.getItem("user_id") || "";

      try {
        console.log(uploadedfile, "uploadedfile");
        const response = await ApiServices.uploadFiles(userId, uploadedfile);

        // Update the specific file's status
        setUploadedFileData((prev) => {
          // Use 'prev' instead of 'uploadedFileData' to avoid stale closure
          const currentUploadedFileIndex = prev.findIndex((file) => file.fileId === fileId);

          if (currentUploadedFileIndex === -1) {
            console.error("File not found in state", fileId);
            return prev; // Return unchanged state if file not found
          }

          // Create a new array with the updated file
          const updatedData = prev.map((file, index) => {
            if (index === currentUploadedFileIndex) {
              return {
                ...file,
                isUploading: false,
                generatedFileId: response.data.doc_id
              };
            }
            return file;
          });

          return updatedData;
        });

        console.log("response", response);

      } catch (error: any) {
        console.log("error in file uploading api", error);

        // Remove the file from state on error or mark as failed
        setUploadedFileData((prev) => {
          return prev.filter((file) => file.fileId !== fileId);
          // Or alternatively, mark as failed:
          // return prev.map(file => 
          //   file.fileId === fileId 
          //     ? { ...file, isUploading: false, uploadError: true }
          //     : file
          // );
        });

        toast.error(error.response?.data?.detail || "Something went wrong");
      }
    }
  };


  const handleRemoveFile: (fileIdToRemove: string) => void = (fileIdToRemove) => {
    setUploadedFileData((prev) => {
      return prev.filter((file) => file.fileId !== fileIdToRemove);
    });
  };
  const handleOpenFileDialog = (fileId: string, fileName: string, fileType: string) => {
    setCurrentPreviewFile({ fileName, fileType, generatedFileId: fileId });
    setOpenPreviewDialog(true);
  };


  return (
    <>

      <div className="relative flex items-center justify-center w-full lg:h-screen h-[calc(100vh-76px)]">
        <div className="sm:max-w-4xl w-full h-full xl:px-0 px-5">

          <div className="sm:flex hidden w-full h-full flex-col justify-center items-center">
            <div

              className={cn(`text-center flex items-center justify-center`,)}>
              <h1 className="text-primary-dark sm:text-[52px] text-[1.25rem] font-medium leading-tight">
                Ask me anything finance!
              </h1>


            </div>



            <div className="sm:my-6 mt-auto w-full">
              <div
                ref={textContainerRef}
                style={{ maxHeight: `${MAX_HEIGHT}px` }}
                className="group flex px-6 py-5 flex-col h-auto min-h-0 overflow-y-auto rounded-[1rem] border-2 focus-within:border-transparent focus-within:bg-[#f3f1ee66] transition overflow-hidden">
                {
                  uploadedFileData.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mb-6">
                      {
                        uploadedFileData.map((fileData, index) => (
                          <div
                            onClick={() => handleOpenFileDialog(fileData.generatedFileId, fileData.fileName, fileData.type)}
                            key={fileData.fileId}
                            className="group flex items-start cursor-pointer flex-wrap gap-2.5 rounded-lg bg-primary-light px-2.5 py-2 hover:bg-primary-light/80 transition-colors duration-200 relative"
                          >
                            <div className="size-[1.875rem] w-fit max-w-48 rounded-md bg-white p-1.5 flex items-center justify-center">
                              {fileData.isUploading ? (
                                <Loader2 className="text-primary-main size-5 animate-spin" />
                              ) : (
                                <FileText strokeWidth={1.5} className="text-primary-main size-4" />
                              )}
                            </div>

                            <div className="flex flex-col max-w-60">
                              <p className="text-xs w-full truncate font-semibold text-black">
                                {fileData.fileName}
                              </p>
                              <span className="text-[10px] truncate text-[#8F8D8D] font-medium">
                                {fileData.type.split("/")[1].toUpperCase()}
                              </span>

                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Add your remove file logic here
                                handleRemoveFile(fileData.fileId);
                              }}
                              className="rounded-full p-0.5"
                              aria-label="Remove file"
                            >
                              <X className="size-3" />
                            </button>

                          </div>
                        ))
                      }
                    </div>
                  )
                }
                <textarea
                  autoFocus
                  ref={textAreaRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    handleAutoTextAreaResize(e.target);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      if (query.trim()) {
                        sendMessage();
                      }
                    }
                  }}
                  placeholder="Ask anything.."
                  className="w-full bg-transparent text-[#333131] text-base leading-relaxed font-medium pb-0 min-h-32 resize-none placeholder:text-neutral-150 focus:outline-none"
                ></textarea>

                <div className="flex items-center justify-between">
                  <div className="flex w-full items-center justify-between">
                    <div className="flex gap-3 items-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setDeepResearch(!deepResearch)}
                              className={cn(
                                "flex items-center justify-center gap-2 rounded-[0.5rem] bg-primary-light sm:px-3 sm:py-1.5 p-2 text-sm font-normal text-primary-300 transition-colors",
                                deepResearch && "bg-primary-main text-white"
                              )}
                              aria-checked={deepResearch}
                              role="checkbox"
                            >
                              <PiPlanetLight className="size-5 flex-shrink-0 m-[2px]" />

                              <span className="sm:block hidden">Deep Research</span>
                            </button>


                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Deep Research</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>


                      <div className="">
                        <Select value={currentSearchMode} onValueChange={handleAgentChange}>
                          <SelectTrigger className="min-w-28 max-w-28 sm:max-w-36 border border-primary-100 focus:border-primary-main">
                            <SelectValue placeholder="Select Agent" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fast">
                              Fast
                            </SelectItem>
                            <SelectItem value="agentic-planner">
                              Agentic Planner
                            </SelectItem>
                            <SelectItem value="agentic-reasoning">
                              Agentic Reasoning
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* <div className="flex items-center gap-x-4">
                       <button>
                         <Paperclip size={16} />
                       </button>

                       <button>
                         <Globe size={16} />
                       </button>

                       <button>
                         <Ellipsis size={16} />
                       </button>
                     </div> */}
                    </div>

                    <div className="flex items-center gap-x-4">
                      <input accept=".pdf,.txt,.xlsx" onChange={(e) => {
                        handleDocUploadChange(e.target.files);
                        e.target.value = "";
                      }} type="file" ref={docRef} hidden />
                      <button onClick={openDocUpload}><Paperclip size={20} /></button>

                      <button
                        disabled={!query || isProcessing}
                        onClick={sendMessage}
                        className="flex items-center justify-center size-9 rounded-full disabled:bg-primary-200 bg-primary-main"
                      >
                        <MoveUp color="white" size={20}/>
                      </button>

                    </div>
                  </div>
                </div>
              </div>

              <div className="sm:hidden py-3.5 flex items-center justify-center gap-x-1 text-center text-[10px] tracking-normal font-normal text-[#7E7E7E]">
                <p>Insight agent can Make Mistake, Please check Important info </p>

                <button className="size-5 text-xs tracking-normal rounded-full bg-primary-light">
                  ?
                </button>
              </div>
            </div>



          </div>

          <div

            className="sm:hidden flex flex-col h-full">
            <div

              className={cn(`text-center flex-grow flex-1 gap-y-[1.125rem] flex flex-col items-center justify-center`,)}>
              <h1 className="text-primary-dark sm:text-[3.375rem] text-[1.25rem] font-medium leading-tight">
                Ask me anything finance!
              </h1>

              <div className="flex items-center justify-center gap-2 flex-wrap">
                {
                  defaultPrompts.map((prompt, index) => (
                    <button key={index} className="py-2 px-4 text-xs font-medium tracking-wide bg-primary-light rounded-[1.125rem]">{prompt}</button>
                  ))
                }
              </div>
            </div>

            <div className="sm:my-6 mt-auto w-full">
              <div
                ref={textContainerRef}
                style={{ maxHeight: `${MAX_HEIGHT}px` }}
                className="group flex p-4 flex-col h-auto min-h-0 overflow-y-auto rounded-[1rem] border-2 border-[#E3D8DC] focus-within:border-transparent focus-within:bg-[#f3f1ee66] transition"
              >

                {
                  uploadedFileData.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mb-6">
                      {
                        uploadedFileData.map((fileData, index) => (
                          <div
                            onClick={() => handleOpenFileDialog(fileData.generatedFileId, fileData.fileName, fileData.type)}
                            key={fileData.fileId}
                            className="group flex items-start cursor-pointer flex-wrap gap-2.5 rounded-lg bg-primary-light px-2.5 py-2 hover:bg-primary-light/80 transition-colors duration-200 relative"
                          >
                            <div className="size-[1.875rem] w-fit max-w-48 rounded-md bg-white p-1.5 flex items-center justify-center">
                              {fileData.isUploading ? (
                                <Loader2 className="text-primary-main size-5 animate-spin" />
                              ) : (
                                <FileText strokeWidth={1.5} className="text-primary-main size-4" />
                              )}
                            </div>

                            <div className="flex flex-col max-w-60">
                              <p className="text-xs w-full truncate font-semibold text-black">
                                {fileData.fileName}
                              </p>
                              <span className="text-[10px] truncate text-[#8F8D8D] font-medium">
                                {fileData.type.split("/")[1].toUpperCase()}
                              </span>

                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Add your remove file logic here
                                handleRemoveFile(fileData.fileId);
                              }}
                              className="rounded-full p-0.5"
                              aria-label="Remove file"
                            >
                              <X className="size-3" />
                            </button>

                          </div>
                        ))
                      }
                    </div>
                  )
                }
                <textarea
                  autoFocus
                  ref={textAreaRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    handleAutoTextAreaResize(e.target);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      if (query.trim()) {
                        sendMessage();
                      }
                    }
                  }}
                  placeholder="Ask Insight agent anything.."
                  className="w-full  text-sm text-[#333131] bg-transparent leading-relaxed font-medium pb-0 min-h-20 resize-none placeholder:text-neutral-150 focus:outline-none"
                ></textarea>

                <div className="flex items-center justify-between">
                  <div className="flex w-full items-center justify-between">
                    <div className="flex gap-3 items-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setDeepResearch(!deepResearch)}
                              className={cn(
                                "flex items-center justify-center gap-2 border border-[#E3D8DC] rounded-[0.5rem] bg-white sm:px-3 sm:py-1.5 p-2 text-sm font-normal text-primary-300 transition-colors",
                                deepResearch && "bg-primary-main text-white"
                              )}
                              aria-checked={deepResearch}
                              role="checkbox"
                            >
                              <PiPlanetLight className="size-4 flex-shrink-0" />


                            </button>


                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Deep Research</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>


                      <div className="">
                        <Select value={currentSearchMode} onValueChange={handleAgentChange}>
                          <SelectTrigger className="min-w-28 max-w-28 sm:max-w-36 border border-[#E3D8DC] focus:border-primary-main">
                            <SelectValue placeholder="Select Agent" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fast">Fast</SelectItem>
                            <SelectItem value="agentic-planner">
                              Agentic Planner

                            </SelectItem>
                            <SelectItem value="agentic-reasoning">
                              Agentic Reasoning
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* <div className="flex items-center gap-x-4">
                       <button>
                         <Paperclip size={16} />
                       </button>

                       <button>
                         <Globe size={16} />
                       </button>

                       <button>
                         <Ellipsis size={16} />
                       </button>
                     </div> */}
                    </div>

                    <div className="flex items-center gap-x-4">
                      <input accept=".pdf,.txt,.xlsx" onChange={(e) => {
                        handleDocUploadChange(e.target.files);
                        e.target.value = "";
                      }} type="file" ref={docRef} hidden />
                      <button onClick={openDocUpload}><Paperclip size={16} /></button>

                      <button
                        disabled={!query || isProcessing}
                        onClick={sendMessage}
                        className="flex items-center justify-center size-10 rounded-full disabled:bg-primary-200 bg-primary-main"
                      >
                        <MoveUp color="white" />
                      </button>

                    </div>


                  </div>
                </div>
              </div>

              <div className="sm:hidden py-3.5 flex items-center justify-center gap-x-1 text-center text-[10px] tracking-normal font-normal text-[#7E7E7E]">
                <p>Insight agent can Make Mistake, Please check Important info </p>

                <button className="size-5 text-xs tracking-normal rounded-full bg-primary-light">
                  ?
                </button>
              </div>
            </div>

          </div>


        </div>

        <div className="sm:block hidden mt-auto absolute bottom-6">
          <div className="flex justify-center items-center ">
            <div className="flex items-center gap-x-8 text-[0.75rem] font-normal text-#020202 justify-center">
              <p>Blog</p>
              {/* <Select>
                <SelectTrigger className="w-fit min-w-28 sm:max-w-36 border-none">
                  <SelectValue placeholder="Select Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="English">English</SelectItem>
                </SelectContent>
              </Select> */}
            </div>
          </div>
        </div>

        {currentPreviewFile && (
          <FilePreviewDialog
            open={openPreviewDialog}
            onClose={setOpenPreviewDialog}
            fileId={currentPreviewFile.generatedFileId}
            fileName={currentPreviewFile.fileName}
            fileType={currentPreviewFile.fileType}
          />
        )}
      </div>

    </>
  );
};

export default ChatArea;







