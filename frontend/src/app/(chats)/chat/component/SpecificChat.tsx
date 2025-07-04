"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import Markdown from "@/components/markdown/Markdown";
import { HiThumbDown, HiThumbUp } from "react-icons/hi";
// import Markdown from "@/app/test/component/StreamingTextTracker"
import {
  ChevronDown,
  FileDown,
  FileText,
  Loader2,
  MoveUp,
  Paperclip,
  Repeat,
  Share2,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { IoFlagOutline } from "react-icons/io5";
import { RxDotsHorizontal } from "react-icons/rx";
import { GoArrowRight } from "react-icons/go";
import { SearchMode, useMessageStore } from "@/store/useZustandStore";
import { axiosInstance } from "@/services/axiosInstance";
import {
  PiPlanetLight,
  PiMarkdownLogo,
  PiWarningCircleFill,
} from "react-icons/pi";
import { VscFilePdf } from "react-icons/vsc";
import { BsArrowRepeat, BsFiletypeDocx } from "react-icons/bs";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Header from "@/components/layout/Header";
import CopyButton from "@/components/markdown/CopyButton";
import FinanceChart, { IFinanceData } from "@/components/charts/FinanaceChart";
import FeedbackDialog from "@/app/(chats)/chat/component/FeedbackModal";
import { AnimatePresence, motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Sources from "./Sources";
import Citation from "./Citation";
import Image from "next/image";
import Cookies from "js-cookie";
import ApiServices from "@/services/ApiServices";
import { IMapDataPoint } from "@/types/map-view";
import { API_ENDPOINTS } from "@/services/endpoints";
import { logout } from "@/utils/auth";
import MapView from "@/components/maps/MapView";
import { ChatSharingDialog } from "./ChatSharingDialog";
import { uniqueId } from "lodash";
import FilePreviewDialog from "./DocumentPreviewModal";
import { init } from "next/dist/compiled/webpack/webpack";
import Button from "@/app/(dashboard)/components/Button";
// import { mapData } from "@/data/random_map_data";
// import MapView from "@/app/map-2/page";
// import MapView from "@/components/maps/MapView";

export type researchData = {
  id: string;
  agent_name: string;
  title: string;
};

export type responseData = {
  response_id: string;
  agent_name: string;
  content: string;
};

export type sourcesData = {
  favicon: string;
  title: string;
  domain: string;
  link: string;
  snippet?: string;
};


export interface IMessage {
  message_id: string;
  query: string;
  files?: IPreviewFileData[] | [];
  research?: researchData[];
  response?: responseData;
  related_queries?: string[];
  sources?: sourcesData[];
  chart_data?: IFinanceData[] | [];
  response_time?: string;
  map_data?: IMapDataPoint[] | [];
  error?: boolean;
  feedback?: {
    liked?: string | null;
  }
}

export interface IUploadFile {
  fileId: string;
  type: string;
  fileName: string;
  isUploading: boolean;
  generatedFileId: string;
}


export interface IPreviewFileData {
  fileType: string;
  fileName: string;
  generatedFileId: string;
}

const SpecificChat = () => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [currentTickerSymbol, setCurrentTickerSymbol] = useState("");

  // State for UI rendering
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [query, setQuery] = useState("");
  const [queryHeading, setQueryHeading] = useState("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [messageId, setMessageId] = useState("");
  const setDeepResearch = useMessageStore((state) => state.setDeepResearch);
  const deepResearch = useMessageStore((state) => state.deepResearch);
  const [currentMessageIdx, setCurrentMessageIdx] = useState(0);

  const docRef = useRef<HTMLInputElement | null>(null);

  const chunkBufferRef = useRef<Record<string, string>>({});
  const chunkCounterRef = useRef<Record<string, number>>({});
  // Refs for DOM elements and mutable values
  const chatDivRef = useRef<HTMLDivElement>(null);
  const latestQueryRef = useRef<HTMLDivElement | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [toggleResearchData, setToggleResearchData] = useState<string[]>([]);

  const [showSpecificMap, setShowSpecificMap] = useState<string[]>([]);
  const [showSpecificChartLoader, setShowSpecificChartLoader] = useState<
    string[]
  >([]);

  const [showElaborateSummarize, setShowElaborateSummarize] = useState(false);

  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [reportResponseId, setReportResponseId] = useState<string | null>(null);

  const [openFeedbackModal, setOpenFeedbackModal] = useState(false);
  const [openChatSharingModal, setOpenChatSharingModal] = useState(false);

  // Store agent selection
  const setSearchMode = useMessageStore((state) => state.setSearchMode);
  const currentSearchMode = useMessageStore((state) => state.searchMode);
  const initialMessageData = useMessageStore((state) => state.message);
  const initialUploadedDocument = useMessageStore(
    (state) => state.documents
  );
  const removeDocuments = useMessageStore(
    (state) => state.removeDocuments
  );
  const [uploadedFileData, setUploadedFileData] = useState<IUploadFile[] | []>(
    []
  );

  const isReplacingRef = useRef(false);

  const [openPreviewDialog, setOpenPreviewDialog] = useState(false);
  const [currentPreviewFile, setCurrentPreviewFile] = useState<IPreviewFileData | null>(null);

  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
  const [isStopGeneratingResponse, setIsStopGeneratingResponse] = useState(false);
  const [showActionButtons, setShowActionButtons] = useState(false);

  const [elaborateWithExample, setElaborateWithExample] = useState("with");
  const [summarizeWithExample, setSummarizeWithExample] = useState("with");

  const MAX_HEIGHT = uploadedFileData.length > 3 ? 302 : uploadedFileData.length > 0 ? 247 : 200;
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevMessagesLength = useRef(0);

  const handleAutoTextAreaResize = (ta: HTMLTextAreaElement) => {
    ta.style.height = "auto";
    const scrollH = ta.scrollHeight;
    const newH = Math.min(scrollH, MAX_HEIGHT);
    ta.style.height = `${newH}px`;
  };

  useLayoutEffect(() => {
    if (textAreaRef.current) {
      handleAutoTextAreaResize(textAreaRef.current);
    }
  }, [query]);

  useEffect(() => {
    const checkNotificationPermission = () => {
      try {
        if ("Notification" in window) {
          const permission = Notification.permission;
          setIsNotificationEnabled(permission === "granted");
        } else {
          console.log("Notifications not supported");
          setIsNotificationEnabled(false);
        }
      } catch (error) {
        console.error("Error checking notification permission:", error);
        setIsNotificationEnabled(false);
      }
    };

    checkNotificationPermission();
  }, []);

  // Fetch messages if initialMessageData is not available
  const getMessages = async (sessionId: string) => {
    try {
      const userId = localStorage.getItem("user_id");
      const result = await axiosInstance.get("/messages", {
        params: {
          sessionId, // ES6 shorthand for sessionId: sessionId
          user_id: userId,
        },
      });

      let newMessages: IMessage[] = [];

      if (result.data.message_list.length === 0) {
        router.push("/");
        toast.error(`Unable to load conversation ${sessionId}`);
        return;
      }

      // Update the heading based on the last human query
      const lastMessage =
        result.data.message_list[result.data.message_list.length - 1];
      setQueryHeading(lastMessage.human_input.user_query);

      result.data.message_list.forEach((message: any, index: number) => {
        // Add user message
        newMessages.push({
          message_id: message.message_id,
          query: message.human_input.user_query,
        });

        newMessages[index].message_id = message.message_id;
        newMessages[index].query = message.human_input.user_query;

        if (message.response) {
          newMessages[index].response = {
            response_id: message.response.id,
            agent_name: message.response.agent_name,
            content: message.response.content,
          };
        }

        if (message.research) {
          newMessages[index].research = message.research;
        }

        if (message.sources) {
          newMessages[index].sources = message.sources;
        }

        if (message.stock_chart) {
          newMessages[index].chart_data = message.stock_chart;
        }

        if (message.feedback) {
          newMessages[index].feedback = message.feedback;
        }
        if (message.doc_ids && message.doc_ids.length > 0) {
          newMessages[index].files = message.doc_ids;
        }

        // Add research message if exists
      });

      setMessages(newMessages);
    } catch (error) {
      console.error(error);
      router.push("/");
      toast.error(`Unable to load conversation ${sessionId}`);
    }
  };

  function sendNotification() {
    if (!("Notification" in window)) {
      console.warn("This browser does not support notification.");
      return;
    }

    if (Notification.permission === "granted") {
      new Notification("🚀 Hello Insight-Agent user", {
        body: "✅ Your response has been generated",
        icon: "/icons/bell_icon.svg",
        badge: "/icons/bell_icon.svg",
        requireInteraction: false,
        tag: "web-notification",
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification("🚀 Hello Insight-Agent user", {
            body: "✅ Your response has been generated",
            icon: "/icons/bell_icon.svg",
            badge: "/icons/bell_icon.svg",
            requireInteraction: false,
            tag: "web-notification",
          });
        }
      });
    }
  }


  function updateMessages(data: any) {
    if (data.type === "response") {
      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        const messageIndex = updatedMessages.findIndex(
          (element) => element.message_id === data.message_id
        );

        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          response: {
            response_id: data.id,
            agent_name: data.agent_name,
            content: data.content,
          },
        };

        return updatedMessages;
      });
    } else if (data.type === "response-chunk") {
      const messageId = data.message_id;

      // Initialize buffer and counter if not already
      if (!chunkBufferRef.current[messageId]) {
        chunkBufferRef.current[messageId] = "";
        chunkCounterRef.current[messageId] = 0;
      }

      // Append chunk to buffer and increment counter
      chunkBufferRef.current[messageId] += data.content;
      chunkCounterRef.current[messageId] += 1;

      // Update only when counter hits 3
      if (chunkCounterRef.current[messageId] >= 1) {
        const bufferedContent = chunkBufferRef.current[messageId];

        setMessages((prevMessages) => {
          const updatedMessages = [...prevMessages];
          const messageIndex = updatedMessages.findIndex(
            (element) => element.message_id === messageId
          );

          if (messageIndex === -1) return prevMessages;

          const previousContent =
            updatedMessages[messageIndex].response?.content || "";

          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            response: {
              response_id: data.id,
              agent_name: data.agent_name,
              content: previousContent + bufferedContent,
            },
          };

          return updatedMessages;
        });

        // Reset buffer and counter
        chunkBufferRef.current[messageId] = "";
        chunkCounterRef.current[messageId] = 0;
      }
    } else if (data.type === "research") {
      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        const messageIndex = updatedMessages.findIndex(
          (element) => element.message_id === data.message_id
        );

        // Initialize research array if it doesn't exist

        if (messageIndex === -1) {
          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            research: [
              { id: data.id, agent_name: data.agent_name, title: data.title },
            ],
          };
        } else {
          const researchExists = updatedMessages[messageIndex].research?.some(
            (r) => r.id === data.id
          );
          if (!researchExists) {
            updatedMessages[messageIndex].research = [
              ...(updatedMessages[messageIndex].research || []),
              { id: data.id, agent_name: data.agent_name, title: data.title },
            ];
          }
        }
        return updatedMessages;
      });
    } else if (data.type === "research-chunk") {
      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        const messageIndex = updatedMessages.findIndex(
          (element) => element.message_id === data.message_id
        );

        if (messageIndex !== -1) {
          if (!updatedMessages[messageIndex].research) {
            updatedMessages[messageIndex].research = [];
          }

          const researchList = updatedMessages[messageIndex].research;
          const existingIndex = researchList.findIndex((r) => r.id === data.id);

          if (existingIndex !== -1) {
            const existingResearch = researchList[existingIndex];

            const newChunk = data.title || "";
            const currentTitle = existingResearch.title || "";

            // Only append new data if it's not already there
            //TODO: Check if the new chunk is already part of the current title might need some work on future
            if (!currentTitle.endsWith(newChunk)) {
              existingResearch.title =
                currentTitle + newChunk.replace(currentTitle, "");
            }
          } else {
            researchList.push({
              id: data.id,
              agent_name: data.agent_name || "",
              title: data.title || "",
            });
          }
        }

        return updatedMessages;
      });
    } else if (data.type === "related_queries") {
      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        const messageIndex = updatedMessages.findIndex(
          (element) => element.message_id === data.message_id
        );
        if (messageIndex !== -1) {
          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            related_queries: data.content,
          };
        }
        return updatedMessages;
      });
    } else if (data.type === "sources") {
      console.log("sources", data.content);
      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        const messageIndex = updatedMessages.findIndex(
          (element) => element.message_id === data.message_id
        );

        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          sources: data.content,
        };
        return updatedMessages;
      });
    } else if (data.type === "response_time") {
      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        const messageIndex = updatedMessages.findIndex(
          (element) => element.message_id === data.message_id
        );

        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          response_time: data.content,
        };
        return updatedMessages;
      });
    } else if (data.type === "complete") {
      setIsProcessing(false);
      setShowElaborateSummarize(data.suggestions ? true : false);

    } else if (data.type === "complete" && data.notification === true) {
      sendNotification();
      if (eventSourceRef.current) {
        // console.log(eventSourceRef.current)
        eventSourceRef.current.close();
      }
    } else if (data.type === "error") {
      setIsProcessing(false);
      setMessages((prev) => {
        const updatedMessages = [...prev];

        const currentMessageIndex = updatedMessages.findIndex(
          (message) => message.message_id === data.message_id
        );

        updatedMessages[currentMessageIndex] = {
          ...updatedMessages[currentMessageIndex],
          error: true,
        };
        return updatedMessages;
      });
      if (eventSourceRef.current) {
        // console.log(eventSourceRef.current)
        eventSourceRef.current.close();
      }
    }
  }

  // On component mount, check for session and initialize

  useEffect(() => {
    const sessionIdFromParams = searchParams.get("search");

    // Skip the full reload logic if we're just replacing the URL
    if (isReplacingRef.current) {
      isReplacingRef.current = false; // Reset for next time
      return;
    }

    if (initialMessageData) {
      setIsProcessing(true);
      startEventStream2(initialMessageData);
      return;
    }

    // Check if sessionIdFromParams is valid
    if (sessionIdFromParams && sessionIdFromParams.length === 36) {
      setSessionId(sessionIdFromParams);
      getMessages(sessionIdFromParams);
    } else {
      router.push("/");
      toast.error(`Unable to load conversation ${query}`);
    }
  }, [searchParams]);

  // Auto-scroll chat container when messages update
  // useEffect(() => {
  //   if (chatDivRef.current && expanded.length === 0) {
  //     chatDivRef.current.scrollTop = chatDivRef.current.scrollHeight;
  //   }
  // }, [messages]);

  // Start the event stream and use the messagesRef for the latest messages

  //   useEffect(() => {
  //     if (messages.length > 0 && chatDivRef.current) {
  //       const chatContainer = chatDivRef.current;

  //       // Add 600px of extra height to show empty space for response generation
  //       chatContainer.style.paddingBottom = '55dvh';

  //       // Alternative: Add to minHeight if you prefer
  //       // const currentHeight = chatContainer.scrollHeight;
  //       // chatContainer.style.minHeight = `${currentHeight + 600}px`;

  //       // Small delay to ensure the height change is applied
  //       setTimeout(() => {
  //         // Find the latest message (query)
  //         if (messages.length > 0) {
  //           chatDivRef.current?.scrollTo({
  //             top: chatDivRef.current.scrollHeight,
  //             behavior: "smooth",
  //           });
  //         };
  //       }, 50); // Small delay to ensure DOM updates
  //     }
  //   }, [queryHeading]); // Triggered when new query comes in




  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      if (latestQueryRef.current) {
        latestQueryRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);



  const startEventStream2 = async (
    userQuery = query,
    messageId = "",
    retry = false,
    isFirstQuery = true,
    agentValue: string = currentSearchMode,
    isElaborate = false,
    isWithExample = false
  ) => {
    const userId = localStorage.getItem("user_id");
    const access_token = Cookies.get("access_token");
    if (!userId || !access_token) {
      logout();
      return;
    }

    if (abortControllerRef.current) {
      // Store the reference and clear it before aborting to avoid race conditions
      const controller = abortControllerRef.current;
      controller.abort();
      abortControllerRef.current = null;
    }
    // Create a new abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let prevMessageId = "";
    if (retry) {
      const prevMessageIdx =
        messages.findIndex((message) => message.message_id === messageId) - 1;
      prevMessageId =
        prevMessageIdx !== -1 ? messages[prevMessageIdx].message_id : "";
    } else {
      prevMessageId =
        messages.length > 0 ? messages[messages.length - 1].message_id : "";
    }

    try {
      const requestData = {
        session_id: sessionId,
        user_id: userId || "",
        user_query: userQuery,
        realtime_info: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        search_mode: agentValue,
        deep_research: deepResearch,
        message_id: messageId,
        retry: retry,
        prev_message_id: prevMessageId,
        doc_ids:
          uploadedFileData.length > 0
            ? uploadedFileData.map((file, index) => file.generatedFileId)
            : initialUploadedDocument,
        is_elaborate: isElaborate,
        is_example: isWithExample
      };

      const response = await fetch(API_ENDPOINTS.QUERY_STREAM, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify(requestData),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Server responded with ${response.status}: ${response.statusText}`
        );
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Process the stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Stream complete
            setIsProcessing(false);
            break;
          }

          // Decode this chunk and add to buffer
          const chunk = decoder.decode(value, { stream: true });
          try {
            // Split by lines in case multiple events are in one chunk
            const lines = chunk.split("\n\n").filter((line) => line.trim());

            lines.forEach((line) => {
              if (line.startsWith("data: ")) {
                const eventData = line.substring(6);
                const data = JSON.parse(eventData);
                updateMessages(data);
              } else if (line.startsWith("event: session_info")) {
                // Handle session info - need to get the next line for data
                // In a real implementation, you'd need more robust parsing
                const dataLine = line.split("\n")[1];
                if (dataLine && dataLine.startsWith("data: ")) {
                  const sessionData = JSON.parse(dataLine.substring(6));
                  setMessageId(sessionData.message_id);
                  if (isFirstQuery) {
                    setQueryHeading(userQuery);
                    setSessionId(sessionData.session_id);
                    isReplacingRef.current = true;
                    router.replace(`/chat?search=${sessionData.session_id}`);
                  }

                  if (!retry) {
                    setMessages((prevMessages) => {
                      const newMsg: IMessage = {
                        message_id: sessionData.message_id,
                        query: userQuery,
                        files: uploadedFileData.length > 0 ? uploadedFileData.map(file => ({
                          generatedFileId: file.generatedFileId,
                          fileName: file.fileName,
                          fileType: file.type,
                        })) : initialUploadedDocument || [],
                      };
                      const updated = [...prevMessages, newMsg];
                      return updated;
                    });
                  }
                }
              } else if (line.startsWith("event: stock_chart")) {
                // Handle stock chart events similarly

                const chartDataLine = line.split("\n")[1];
                if (chartDataLine && chartDataLine.startsWith("data: ")) {
                  const chartData = JSON.parse(chartDataLine.substring(6));

                  try {
                    // Update the messages state with the new chart data
                    setMessages((prevMessages) => {
                      const updatedMessages = [...prevMessages];
                      const messageIndex = updatedMessages.findIndex(
                        (element) => element.message_id === chartData.message_id
                      );

                      console.log("messageIndex", messageIndex);
                      if (
                        updatedMessages[messageIndex].chart_data &&
                        updatedMessages[messageIndex].chart_data.length > 0
                      ) {
                        updatedMessages[messageIndex] = {
                          ...updatedMessages[messageIndex],
                          chart_data: [
                            ...updatedMessages[messageIndex].chart_data,
                            {
                              realtime: chartData.stock_data.realtime,
                              historical: chartData.stock_data.historical,
                            },
                          ],
                        };
                      } else {
                        updatedMessages[messageIndex] = {
                          ...updatedMessages[messageIndex],
                          chart_data: [
                            {
                              realtime: chartData.stock_data.realtime,
                              historical: chartData.stock_data.historical,
                            },
                          ],
                        };
                      }
                      return updatedMessages;
                    });
                  } catch (error) {
                    console.error("Error parsing comment:", error);
                  }
                } else if (line.startsWith("event: map_data")) {
                  // const mapDataLine = lines[lines.indexOf(line) + 1];
                  // if (mapDataLine && mapDataLine.startsWith('data: ')) {
                  //   const mapData = JSON.parse(mapDataLine.substring(6))
                  //   try {
                  //     // Update the messages state with the new map data
                  //     console.log("map_data", mapData.data.data)
                  //     setMessages((prevMessages) => {
                  //       const updateMessages = [...prevMessages];
                  //       const messageIndex = updateMessages.findIndex((element) => element.message_id === mapData.message_id);
                  //       if (messageIndex !== -1) {
                  //         updateMessages[messageIndex] = {
                  //           ...updateMessages[messageIndex], map_data: mapData.data.data
                  //         };
                  //       }
                  //       return updateMessages;
                  //     })
                  //   } catch (error) {
                  //     console.error('Error parsing comment:', error);
                  //   }
                  // }
                }
              }
            });
          } catch (err) {
            console.log("Error processing stream chunk:", err);
          }
        }
      }
    } catch (error) {
      console.log("Error starting event stream:", error);
    }
  };

  // Toggle expand for research items
  const toggleExpand = (messageId: string, index: number) => {
    const itemId = `${messageId}-${index}`;

    setExpanded((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id, index) => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const handleToggleResearchData = (messageId: string) => {
    setToggleResearchData((prev) => {
      if (prev.includes(messageId)) {
        return prev.filter((id) => id !== messageId);
      } else {
        return [...prev, messageId];
      }
    });
  };

  const handleShowSpecificMap = (messageId: string, isShown: boolean) => {
    if (isShown) {
      setShowSpecificMap((prev) => {
        return prev.filter((id) => id !== messageId);
      });
    } else {
      setShowSpecificMap((prev) => {
        return [...prev, messageId];
      });
    }
  };

  // Send a message and update state/ref synchronously
  const sendMessage = (relatedQuery = "") => {
    const messageToSend = query.trim() || relatedQuery;
    setIsProcessing(true);
    setQueryHeading(messageToSend);
    setMessageId("");
    if (initialUploadedDocument) {
      removeDocuments();
    }

    try {
      // Start generating the response
      startEventStream2(messageToSend, "", false, false);
      setExpanded([]);
      setQuery("");

      setUploadedFileData([]);

      // Alternative: Scroll to the specific latest message element
      // You can use this instead of the above scrollTo method

      setTimeout(() => {
        if (textAreaRef.current) {
          textAreaRef.current.setSelectionRange(0, 0);
          textAreaRef.current.focus();
        }
      }, 0);
    } catch (error) {
      console.error("Error sending message:", error);
      setQuery("");
      setIsProcessing(false);
    }
  };

  const handleAgentChange = (value: SearchMode) => {
    setSearchMode(value);
  };

  const handleOpen = (idx: number) => {
    setOpen(true);
    setCurrentMessageIdx(idx);
  };

  const handleRewriteAnalysis = async (
    value: SearchMode,
    id: string,
    userQuery: string
  ) => {
    setSearchMode(value);
    setMessageId(id);
    // const filteredMessage = messages[index];
    const updatedMessage = messages.map((message) => {
      if (message.message_id === id) {
        const {
          response,
          research,
          sources,
          related_queries,
          error,
          chart_data,
          map_data,
          feedback,
          ...rest
        } = message;
        return rest; // return message without 'response'
      }
      return message;
    });
    setMessages(updatedMessage);
    try {
      setIsProcessing(true);
      startEventStream2(userQuery, id, true, false, value);
      // startEventStream(sessionId);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  async function handleMonthlyStockChartData(
    period: string,
    message_id: string,
    exchange: string,
    symbol: string
  ) {
    setCurrentTickerSymbol(symbol);
    setShowSpecificChartLoader((prev) => {
      const uniqueId = `${message_id}-${symbol}`;
      return [...prev, uniqueId];
    });
    try {
      const response = await axiosInstance.post("/stock_data", {
        period: period,
        message_id: message_id,
        exchange_symbol: exchange,
        ticker: symbol,
      });

      const messageIndex = messages.findIndex(
        (message) => message.message_id === response.data.message_id
      );

      if (messageIndex !== -1) {
        setMessages((prevMessages) => {
          const updatedMessage = [...prevMessages];
          // updatedMessage[messageIndex] = {
          //   ...updatedMessage[messageIndex],
          //   chart_data: response.data.stock_data,
          // };

          const messageIndexInChartData = updatedMessage[
            messageIndex
          ].chart_data?.findIndex(
            (chartData) => chartData.realtime?.symbol === symbol
          );
          console.log("messageIndexInChartData", messageIndexInChartData);
          if (
            updatedMessage[messageIndex].chart_data &&
            messageIndexInChartData !== undefined &&
            messageIndexInChartData >= 0
          ) {
            updatedMessage[messageIndex].chart_data[messageIndexInChartData] =
              response.data.stock_data;
          }
          return updatedMessage;
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setCurrentTickerSymbol("");
      setShowSpecificChartLoader((prev) => {
        const uniqueId = `${message_id}-${symbol}`;
        return messageId ? prev.filter((id) => id !== uniqueId) : prev;
      });
    }
  }

  const handleFeedbackResponse = (
    messageId: string,
    responseId: string,
    islike: boolean
  ) => {
    try {
      const response = axiosInstance.put("/response-feedback", {
        message_id: messageId,
        response_id: responseId,
        liked: islike,
      });

      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        const messageIndex = updatedMessages.findIndex(
          (message) => message.message_id === messageId
        );

        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          feedback: {
            liked: islike ? "yes" : "no",
          }
        };
        return updatedMessages;
      });

      console.log("Feedback sent:", response);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleReportDownload = async (messageId: string, format: string) => {
    try {
      const result = await ApiServices.exportResponse(messageId, format);
      const base64Data = result.file_content_64;
      const fileName = result.filename;

      // Validate base64 string
      if (!base64Data || typeof base64Data !== "string") {
        throw new Error("Invalid base64 data received from server");
      }

      try {
        // Convert base64 to Blob
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        // Use appropriate MIME type based on format
        const mimeType =
          format === "pdf"
            ? "application/pdf"
            : format === "docx"
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "text/markdown";

        const blob = new Blob([byteArray], { type: mimeType });

        // Create object URL and download via anchor
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement("a");
        downloadLink.href = url;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
      } catch (decodeError) {
        throw new Error("Failed to decode base64 data: Invalid encoding");
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Something went wrong while downloading the file";
      toast.error(errorMessage);
      console.error("Download error:", error);
    }
  };

  const requestNotificationPermission = async () => {

    // Check if notifications are supported
    if (!("Notification" in window)) {
      toast.error("This browser does not support desktop notification");
      return false;
    }

    // If already granted, return true
    if (Notification.permission === "granted") {
      console.log("✅ Permission already granted");
      setIsNotificationEnabled(true);
      return true;
    }

    // If denied, inform user
    if (Notification.permission === "denied") {
      toast.error("Notifications are blocked. Please enable them in your browser settings.");
      return false;
    }

    try {
      console.log("🔄 Requesting permission from user...");
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        console.log("✅ Permission granted!");
        setIsNotificationEnabled(true);
        return true;
      } else if (permission === "denied") {
        toast.error("Notification permission denied");
        return false;
      } else {
        toast.info("Notification permission dismissed");
        return false;
      }
    } catch (error) {
      toast.error("Error requesting notification permission");
      return false;
    }
  };

  const handleNotification = async () => {
    try {
      const permission = await requestNotificationPermission();

      if (permission) {
        console.log("✅ Creating notification...");

        const notification = new Notification("🚀 Thanks!", {
          body: "You will be notified when response is generated.",
          icon: "/icons/bell_icon.svg",
          badge: "/icons/bell_icon.svg",
          requireInteraction: false,
          tag: "new-45343435",
        });

        // Optional: click handler
        notification.onclick = () => {
          console.log("🔔 Notification clicked");
          window.focus();
          notification.close();
        };

        // Optional: error handler
        notification.onerror = (error) => {
          console.error("❌ Notification error:", error);
        };

        console.log("✅ Notification created successfully");
      } else {
        console.log("❌ Permission not granted, cannot create notification");
      }
    } catch (error) {
      console.error("❌ Error in handleNotification:", error);
      toast.error("Error creating notification");
    }
  };

  const handleNotify = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("🖱️ Button clicked - requesting notification");
    handleNotification();
  };

  const handleOpenFeedbackModal = (messageId: string, responseId: string) => {
    setReportMessageId(messageId);
    setReportResponseId(responseId);
    setOpenFeedbackModal(true);
    document.body.style.pointerEvents = "auto";
  };

  const handleChatSharingModal = () => {
    setOpenChatSharingModal(true);
  };

  const openDocUpload = () => {
    if (docRef.current) {
      docRef.current.click();
    }
  };

  const handleDocUploadChange = async (file: FileList | null) => {
    if (file) {
      const uploadedfile = file[0];
      const maxSize = 2 * 1024 * 1024; // 1MB

      if (uploadedfile.size > maxSize) {
        toast.error(
          "File size limit exceeded. Please upload files smaller than 2MB."
        );
        return;
      }

      if (uploadedFileData.length >= 5) {
        toast.error(
          "sorry, you can not upload more than 5 files in a single query"
        );
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
          generatedFileId: "",
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
          const currentUploadedFileIndex = prev.findIndex(
            (file) => file.fileId === fileId
          );

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

  const handleRemoveFile: (fileIdToRemove: string) => void = (
    fileIdToRemove
  ) => {
    setUploadedFileData((prev) => {
      return prev.filter((file) => file.fileId !== fileIdToRemove);
    });
  };

  const handleOpenFileDialog = (fileId: string, fileName: string, fileType: string) => {
    console.log("Opening file dialog for:", fileId, fileName, fileType);
    setCurrentPreviewFile({ fileName, fileType, generatedFileId: fileId });
    setOpenPreviewDialog(true);
  };


  const stopGeneratingResponse = async () => {

    try {
      setIsStopGeneratingResponse(true);
      const response = await ApiServices.handleStopGeneratingResponse(sessionId, messageId);
      toast.success("Response generation stopped successfully");
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setIsProcessing(false);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to stop response generation");
    } finally {
      setIsStopGeneratingResponse(false);
    }

  }




  const handleElaborateResponse = (exampleStatus: string) => {
    setElaborateWithExample(exampleStatus);
    setShowElaborateSummarize(false);
    setIsProcessing(true);

    const updatedQueryHeading = `Elaborate: ${queryHeading}`;
    const isExample = exampleStatus === "with" ? true : false;

    setQueryHeading(updatedQueryHeading);
    startEventStream2(
      updatedQueryHeading,
      "",
      false,
      false,
      "summarizer",
      true,
      isExample
    )
  }

  const handleSummarizeResponse = (exampleStatus: string) => {
    setSummarizeWithExample(exampleStatus);
    setShowElaborateSummarize(false);
    setIsProcessing(true);
    const isExample = exampleStatus === "with" ? true : false;

    const updatedQueryHeading = `Summarize: ${queryHeading}`;
    setQueryHeading(updatedQueryHeading);
    startEventStream2(
      updatedQueryHeading,
      "",
      false,
      false,
      "summarizer",
      false,
      isExample
    )
  }



  return (
    <div className="w-full flex  h-[calc(100vh-4.75rem)] lg:h-screen">
      <div className="w-full h-full lg:py-6 pb-4 lg:pr-8 flex flex-col">
        <Header heading={queryHeading} />

        <div className="lg:ml-8 lg:px-0 sm:px-6 px-4 mt-2 w-full flex flex-col flex-grow overflow-hidden">
          <div
            ref={chatDivRef}
            className={cn('w-full 2xl:max-w-full mx-auto xl:max-w-3xl lg:max-w-3xl flex flex-col flex-grow overflow-y-auto', { "pb-[62dvh]": isProcessing }, { "pb-0": !isProcessing })}
          >
            {messages.length > 0 &&
              messages.map((message, index) => {
                return (
                  <div
                    key={index}
                    ref={index === messages.length - 1 ? latestQueryRef : null}
                    className="w-full message-container grid grid-cols-1 2xl:grid-cols-10"
                  >
                    <div className="flex-grow w-full mb-4 lg:pr-5 2xl:col-span-6 col-span-1">
                      {/* Render if message.query exists */}

                      <div className="my-8">
                        {
                          message.files && message.files.length > 0 && (

                            <div className="flex justify-start items-center gap-2 mb-2">
                              {message.files.map((fileData, index) => (
                                <div
                                  key={fileData.generatedFileId}
                                  onClick={() => {
                                    handleOpenFileDialog(fileData.generatedFileId, fileData.fileName, fileData.fileType);
                                  }}
                                  className={cn(
                                    "group flex cursor-pointer items-start flex-wrap gap-2.5 rounded-lg bg-primary-light px-2.5 py-2 hover:bg-primary-light/80 transition-colors duration-200 relative",

                                  )}
                                >
                                  <div className="size-[1.875rem] w-fit max-w-48 rounded-md bg-white p-1.5 flex items-center justify-center">

                                    <FileText
                                      strokeWidth={1.5}
                                      className="text-primary-main size-4"
                                    />

                                  </div>

                                  <div className="flex flex-col max-w-60">
                                    <p className="text-xs w-full truncate font-semibold text-black">
                                      {fileData.fileName}
                                    </p>
                                    <span className="text-[10px] truncate text-[#8F8D8D] font-medium">
                                      {fileData.fileType.split("/")[1].toUpperCase()}
                                    </span>


                                  </div>

                                </div>
                              ))}
                            </div>
                          )}

                        {message.query && (
                          <div className="flex justify-start ">
                            <div className="w-fit">
                              <h2 className="text-primary-dark font-medium sm:text-3xl text-2xl leading-tight">
                                {message.query}
                              </h2>
                            </div>
                          </div>
                        )}
                      </div>


                      {/* Render if message.research exists and has length > 0 */}
                      {message.research && message.research.length > 0 && (
                        <div className="max-w-full border border-primary-100 bg-[rgba(var(--financial-bg))] sm:rounded-2xl rounded-xl sm:py-4 py-2 sm:px-6 px-3">
                          <div
                            onClick={() =>
                              handleToggleResearchData(message.message_id)
                            }
                            className={cn(
                              "flex justify-between items-center cursor-pointer",
                              toggleResearchData.includes(message.message_id)
                              && "pb-4"
                            )}
                          >
                            {isProcessing &&
                              message.message_id === messageId ? (
                              <div className="flex items-center gap-x-2">
                                <div role="status" className="flex-shrink-0">
                                  <Image
                                    src="/images/loader.svg"
                                    alt="loader"
                                    priority
                                    height={20}
                                    width={20}
                                    className="animate-spin sm:size-5 size-4"
                                  />
                                </div>

                                <p className="sm:text-base text-sm min-w-0 truncate font-semibold">
                                  {
                                    message.research[
                                      message.research.length - 1
                                    ].agent_name
                                  }{" "}
                                  is working
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center  gap-x-2">
                                <p className="sm:text-base text-sm font-semibold">
                                  Response Generated
                                </p>
                              </div>
                            )}

                            <div className="flex items-center gap-x-2">
                              {!isNotificationEnabled &&
                                message.message_id === messageId &&
                                (
                                  <>
                                    <button
                                      onClick={handleNotify}
                                      className="rounded-lg sm:flex hidden border-2 gap-x-1 border-primary-main text-primary-main text-sm font-semibold py-1.5 px-3.5"
                                    >
                                      <Image
                                        src="/icons/bell_icon.svg"
                                        alt="bell"
                                        height={20}
                                        width={20}
                                        priority
                                        className="size-5"
                                      />
                                      Notify Me
                                    </button>


                                    <Image
                                      onClick={handleNotify}
                                      src="/icons/bell_icon.svg"
                                      alt="bell"
                                      height={20}
                                      width={20}
                                      priority
                                      className="size-5 sm:hidden block cursor-pointer"
                                    />

                                  </>
                                )}




                              {message.response_time && (
                                <p className="text-sm leading-normal">
                                  {message.response_time}
                                </p>
                              )}


                              <ChevronDown
                                className={`text-black sm:size-5 size-5 flex-shrink-0 transition-transform ${toggleResearchData.includes(
                                  message.message_id
                                )
                                  ? "transform rotate-180"
                                  : ""
                                  }`}
                              />
                            </div>
                          </div>

                          <AnimatePresence>
                            {toggleResearchData.includes(
                              message.message_id
                            ) && (
                                <motion.div
                                  initial={{ height: 0 }}
                                  animate={{ height: "auto" }}
                                  exit={{ height: 0 }}
                                  transition={{
                                    duration: 0.3,
                                    ease: "easeInOut",
                                  }}
                                  className={`flex flex-col overflow-hidden`}
                                >
                                  <div className="relative">
                                    {/* Timeline line */}
                                    <div className="absolute left-[0.95rem] top-4 bottom-3 w-0.5 bg-primary-light" />

                                    {message.research.map((researchData, idx) => {
                                      const itemId = `${message.message_id}-${idx}`;

                                      // Check if this specific item is expanded
                                      // const isLastMessage = messages.indexOf(message) === messages.length - 1;
                                      const activeMessage =
                                        message.message_id === messageId;
                                      const isLastResearchItem =
                                        idx ===
                                        (message.research?.length || 0) - 1;
                                      const isExpanded =
                                        expanded.includes(itemId);

                                      // Show loader only on the last item of the last research message
                                      const showLoader =
                                        activeMessage &&
                                        isLastResearchItem &&
                                        isProcessing;
                                      return (
                                        <div
                                          key={idx}
                                          onClick={() =>
                                            toggleExpand(message.message_id, idx)
                                          }
                                          className={cn(
                                            "cursor-pointer h-[1.75rem] transition-height duration-300 overflow-hidden flex items-start px-3 rounded-md  gap-x-2 py-1 first:pt-0 last:pb-0",
                                            {
                                              "h-auto": isExpanded || showLoader,
                                            }
                                          )}
                                        >
                                          {/* Dot or loader could go here */}
                                          <div className="relative flex-shrink-0 mt-1.5">
                                            {showLoader ? (
                                              <div className="loader" />
                                            ) : (
                                              <div className="w-2 h-2 rounded-full bg-[#DCD4C7]" />
                                            )}
                                          </div>
                                          {/* Research text */}
                                          <div className="w-full overflow-hidden">
                                            <div className="flex w-full justify-between items-start gap-x-2 overflow-hidden">
                                              <div
                                                className={cn(
                                                  "text-sm font-medium leading-tight overflow-hidden whitespace-nowrap text-ellipsis",
                                                  {
                                                    "whitespace-normal":
                                                      isExpanded,
                                                  }
                                                )}
                                              >
                                                <Markdown
                                                  allowHtml={true}
                                                  latex={false}
                                                  className=""
                                                // currentData={currentResponseChunkData}
                                                >
                                                  {researchData.title}
                                                </Markdown>
                                              </div>
                                              <ChevronDown
                                                size={18}
                                                className={`text-gray-500 flex-shrink-0 transition-transform
                                        
                                        ${isExpanded || showLoader
                                                    ? "transform rotate-180"
                                                    : ""
                                                  }
                                      `}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                          </AnimatePresence>
                        </div>
                      )}

                      {message.chart_data && message.chart_data.length > 0 && (
                        <div className="my-4 2xl:hidden block">
                          <FinanceChart
                            messageId={message.message_id}
                            data={message.chart_data}
                            onSelectedPeriodChange={(period) =>
                              handleMonthlyStockChartData(
                                period,
                                message.message_id,
                                message.chart_data
                                  ? message.chart_data[0]?.realtime?.exchange
                                  : "",
                                message.chart_data
                                  ? message.chart_data[0]?.realtime?.symbol
                                  : ""
                              )
                            }
                            loading={showSpecificChartLoader.includes(
                              `${message.message_id}-${currentTickerSymbol}`
                            )}
                          />
                        </div>
                      )}

                      {message.map_data && message.map_data.length > 0 && (
                        <div className="my-4 2xl:hidden block">
                          <MapView hexagonData={message.map_data} />
                        </div>
                      )}

                      {message.response && (
                        <>
                          <div className="py-2">
                            {(() => {
                              const content = message.response.content.toString();
                              // Detect if content contains RTL characters (Arabic, Hebrew, Persian, etc.)
                              const isRtl =
                                /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F]/.test(
                                  content
                                );

                              return (
                                <div

                                  className={cn({ "font-[Arial]": isRtl }, "message-response")}
                                  dir={isRtl ? "rtl" : "ltr"}
                                >
                                  <Markdown allowHtml={true} latex={false}>
                                    {content}
                                  </Markdown>
                                </div>
                              );
                            })()}

                            {
                              message.response && !(isProcessing) && (
                                <div className="flex items-center sm:justify-between justify-center flex-wrap gap-y-6 gap-x-2 my-6">
                                  <div>
                                    {message.sources &&
                                      message.sources.length > 0 && (
                                        <div className="">
                                          <Sources
                                            data={message.sources}
                                            onHandleCitationData={() =>
                                              handleOpen(index)
                                            }
                                          />
                                        </div>
                                      )}
                                  </div>

                                  <div className="flex items-center text-sm gap-x-4">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger className="focus:border-none">
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Repeat
                                                strokeWidth={1.5}
                                                className="cursor-pointer size-[20px]"
                                              />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Retry</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent className="ml-5">
                                        <DropdownMenuLabel>
                                          Retry with
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuRadioGroup
                                          value={currentSearchMode}
                                          onValueChange={(value: string) =>
                                            handleRewriteAnalysis(
                                              value as SearchMode,
                                              message.message_id,
                                              message.query
                                            )
                                          }
                                        >
                                          <DropdownMenuRadioItem value="fast">
                                            Fast Agent
                                          </DropdownMenuRadioItem>
                                          <DropdownMenuRadioItem value="agentic-planner">
                                            Agentic Planner
                                          </DropdownMenuRadioItem>
                                          <DropdownMenuRadioItem value="agentic-reasoning">
                                            Agentic Reasoning
                                          </DropdownMenuRadioItem>
                                        </DropdownMenuRadioGroup>
                                      </DropdownMenuContent>
                                    </DropdownMenu>

                                    <CopyButton
                                      strokeWidth={1.5}
                                      content={message.response.content}
                                      className="cursor-pointer size-[20px] text-black"
                                    />

                                    <DropdownMenu>
                                      <DropdownMenuTrigger>
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <FileDown
                                                strokeWidth={1.5}
                                                className="cursor-pointer size-[20px]"
                                              />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Download</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent className="">
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleReportDownload(
                                              message.message_id,
                                              "pdf"
                                            )
                                          }
                                          className="flex gap-x-1.5 items-center"
                                        >
                                          <VscFilePdf />
                                          PDF
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleReportDownload(
                                              message.message_id,
                                              "md"
                                            )
                                          }
                                          className="flex gap-x-1.5 items-center"
                                        >
                                          <PiMarkdownLogo />
                                          Markdown
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleReportDownload(
                                              message.message_id,
                                              "docx"
                                            )
                                          }
                                          className="flex gap-x-1.5 items-center"
                                        >
                                          <BsFiletypeDocx />
                                          DOCX
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>

                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Share2
                                            onClick={handleChatSharingModal}
                                            strokeWidth={1.5}
                                            className="cursor-pointer size-[20px]"
                                          />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Share</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>

                                    {
                                      message.feedback && message.feedback.liked === "yes" ? (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <HiThumbUp
                                                strokeWidth={1.5}
                                                className="size-[20px] cursor-pointer"
                                              />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Liked</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      ) : message.feedback && message.feedback.liked === "no" ? (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <HiThumbDown

                                                className="size-[20px] cursor-pointer"
                                              />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Disliked</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      ) : (
                                        <div className="flex items-center text-sm gap-x-4">
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <ThumbsUp
                                                  strokeWidth={1.5}
                                                  className="size-[20px] cursor-pointer"
                                                  onClick={() =>
                                                    handleFeedbackResponse(
                                                      message.message_id,
                                                      message.response?.response_id || "",
                                                      true
                                                    )
                                                  }
                                                />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Like</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>

                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <ThumbsDown
                                                  strokeWidth={1.5}
                                                  className="size-[20px] cursor-pointer"
                                                  onClick={() =>
                                                    handleFeedbackResponse(
                                                      message.message_id,
                                                      message.response?.response_id || "",
                                                      false
                                                    )
                                                  }
                                                />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Dislike</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                      )
                                    }



                                    <DropdownMenu>
                                      <DropdownMenuTrigger>
                                        <RxDotsHorizontal className="text-base" size={20}/>{" "}
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleOpenFeedbackModal(
                                              message.message_id,
                                              message.response?.response_id || ""
                                            )
                                          }
                                        >
                                          <IoFlagOutline size={20} />
                                          Report
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              )
                            }


                            {
                              (message.message_id === messageId && showElaborateSummarize && !isProcessing) && (
                                <div className="flex flex-col items-center justify-center gap-4 my-6">

                                  <p className="sm:text-base text-sm text-[#181818]">Would you like to explore this further or get a quick summary?</p>
                                  <div className="flex items-center gap-x-4">

                                    <DropdownMenu>
                                      <DropdownMenuTrigger className="inline-flex sm:px-4 px-3 sm:py-2 py-1 sm:text-base text-sm items-center justify-center rounded-md font-medium transition-colors duration-200 focus:outline-none gap-x-2 bg-white border border-primary-600 text-primary-600 hover:bg-primary-50">

                                        Elaborate
                                        <ChevronDown className="text-sm text-primary-main" />

                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent className="ml-5">

                                        <DropdownMenuRadioGroup
                                          value={elaborateWithExample}
                                          onValueChange={(value) => handleElaborateResponse(value)}


                                        >
                                          <DropdownMenuRadioItem value="with">
                                            With Example
                                          </DropdownMenuRadioItem>
                                          <DropdownMenuRadioItem value="without">
                                            Without Example
                                          </DropdownMenuRadioItem>

                                        </DropdownMenuRadioGroup>
                                      </DropdownMenuContent>
                                    </DropdownMenu>


                                    <DropdownMenu>
                                      <DropdownMenuTrigger className="inline-flex sm:px-4 px-3 sm:py-2 py-1 sm:text-base text-sm items-center justify-center rounded-md font-medium transition-colors duration-200 focus:outline-none gap-x-2 bg-white border border-primary-600 text-primary-600 hover:bg-primary-50">
                                        Summarize

                                        <ChevronDown className="text-sm text-primary-main" />

                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent className="ml-5">

                                        <DropdownMenuRadioGroup
                                          value={summarizeWithExample}
                                          onValueChange={(value) => handleSummarizeResponse(value)}
                                        >
                                          <DropdownMenuRadioItem value="with">
                                            With Example
                                          </DropdownMenuRadioItem>
                                          <DropdownMenuRadioItem value="without">
                                            Without Example
                                          </DropdownMenuRadioItem>

                                        </DropdownMenuRadioGroup>
                                      </DropdownMenuContent>
                                    </DropdownMenu>


                                  </div>
                                </div>
                              )
                            }
                          </div>


                        </>
                      )}
                      {message.error && (
                        <div className="pt-6 py-4 ">
                          <div className="">
                            <div className="flex p-4 rounded-[1.25rem] bg-[#FFC4C24D] items-start text-[#AD2020] gap-x-2">
                              <PiWarningCircleFill className="size-6  flex-shrink-0" />
                              <div className="">
                                <h4 className="text-base font-medium">
                                  There was an error generating a response.
                                </h4>
                                <p className="text-xs font-normal">
                                  Due to an unexpected error, We couldn't
                                  complete your request. Please try again later{" "}
                                </p>
                              </div>
                            </div>

                            <div className="flex mt-6 items-center justify-center">
                              <button
                                onClick={() =>
                                  handleRewriteAnalysis(
                                    currentSearchMode,
                                    message.message_id,
                                    message.query
                                  )
                                }
                                className="py-2.5 px-[1.25rem] text-primary-main border border-primary-main rounded-lg flex items-center justify-center gap-x-2 text-sm font-medium leading-normal tracking-normal"
                              >
                                <BsArrowRepeat className="size-5 -rotate-45" />
                                Regenerate Response
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {message.related_queries && (
                        <div key={index} className="mt-6 mb-4">
                          <h2 className="text-lg font-semibold mb-4 text-black">
                            Related Queries
                          </h2>
                          <div className="space-y-3">
                            {message.related_queries?.map(
                              (query: string, index) => (
                                <div
                                  key={index}
                                  onClick={() => {
                                    sendMessage(query);
                                  }}
                                  className="py-3 px-5 related-question rounded-lg bg-[rgba(var(--financial-bg))] flex justify-between items-center"
                                >
                                  <p className="text-sm leading-tight font-medium">
                                    {query}
                                  </p>
                                  <button>
                                    <GoArrowRight className="size-5 flex-shrink-0 text-[#646262]" />
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-8 2xl:block hidden lg:ml-10 2xl:col-span-4 col-span-1 lg:mb-0 mb-8">
                      <div className="flex gap-x-5 items-center">
                        {message.chart_data &&
                          message.chart_data.length > 0 && (
                            <div
                              onClick={() =>
                                handleShowSpecificMap(message.message_id, true)
                              }
                              className={cn("p-3 px-1 cursor-pointer", {
                                "border-0 border-b-2 border-b-primary-main":
                                  !showSpecificMap.includes(message.message_id),
                              })}
                            >
                              <p className="text-sm leading-normal font-semibold text-primary-main">
                                Visual Data{" "}
                                <span className="text-[10px] mr-0.5 leading-normal font-semibold text-[#A09F9B]">
                                  (Graphs)
                                </span>
                              </p>
                            </div>
                          )}

                        {message.map_data && (
                          <div
                            onClick={() =>
                              handleShowSpecificMap(message.message_id, false)
                            }
                            className={cn("p-3 px-1 cursor-pointer", {
                              "border-0 border-b-2 border-b-primary-main":
                                showSpecificMap.includes(message.message_id) ||
                                !message.chart_data,
                            })}
                          >
                            <p className="text-sm leading-normal font-semibold text-primary-main">
                              Visual Data{" "}
                              <span className="text-[10px] mr-0.5 leading-normal font-semibold text-[#A09F9B]">
                                (Maps)
                              </span>
                            </p>
                          </div>
                        )}

                        {/* {message.sources && message.sources.length > 0 && (
                          <div onClick={() => handleShowSpecificMap(message.message_id, false)} className={cn("p-3 px-1 cursor-pointer", { "border-0 border-b-2 border-b-primary-main": (showSpecificMap.includes(message.message_id)) }, { "border-0 border-b-2 border-b-primary-main": !(message.chart_data) })}>
                            <Sources data={message.sources} />
                          </div>
                        )} */}
                      </div>

                      <div className="mt-4 md:pr-6 h-full">
                        {message.chart_data &&
                          message.chart_data.length > 0 &&
                          !showSpecificMap.includes(message.message_id) && (
                            <FinanceChart
                              messageId={message.message_id}
                              data={message.chart_data}
                              onSelectedPeriodChange={(period) =>
                                handleMonthlyStockChartData(
                                  period,
                                  message.message_id,
                                  message.chart_data
                                    ? message.chart_data[0]?.realtime?.exchange
                                    : "",
                                  message.chart_data
                                    ? message.chart_data[0]?.realtime?.symbol
                                    : ""
                                )
                              }
                              loading={showSpecificChartLoader.includes(
                                `${message.message_id}-${currentTickerSymbol}`
                              )}
                            />
                          )}

                        {message.map_data &&
                          (showSpecificMap.includes(message.message_id) ||
                            !message.chart_data) && (
                            <MapView hexagonData={message.map_data} />
                          )}

                        {/* {message.sources && message.sources.length > 0 && (showSpecificMap.includes(message.message_id) || !(message.chart_data)) && (
                          <Citation data={message.sources} open={open} onOpenChange={() => setOpen(false)} />
                        )} */}
                      </div>
                    </div>
                  </div>
                );
              })}

          </div>


          <div className="w-full 2xl:max-w-full mx-auto xl:max-w-3xl lg:max-w-3xl grid grid-cols-1 2xl:grid-cols-10 mt-auto">
            <div className="2xl:col-span-6 lg:pr-5">
              <div className="group flex flex-col sm:px-6 sm:py-4 p-4 rounded-[1rem] border-2 focus-within:border-transparent focus-within:bg-[#f3f1ee66] transition overflow-hidden">
                {uploadedFileData.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mb-6">
                    {uploadedFileData.map((fileData, index) => (
                      <div
                        key={fileData.fileId}
                        onClick={() => {
                          console.log("Opening file dialog for:", fileData.generatedFileId, fileData.fileName, fileData.type);
                          handleOpenFileDialog(fileData.generatedFileId, fileData.fileName, fileData.type);
                        }}
                        className={cn(
                          "group flex cursor-pointer items-start flex-wrap gap-2.5 rounded-lg bg-primary-light px-2.5 py-2 hover:bg-primary-light/80 transition-colors duration-200 relative",
                          fileData.isUploading && "disabled"
                        )}
                      >
                        <div className="size-[1.875rem] w-fit max-w-48 rounded-md bg-white p-1.5 flex items-center justify-center">
                          {fileData.isUploading ? (
                            <Loader2 className="text-primary-main size-5 animate-spin" />
                          ) : (
                            <FileText
                              strokeWidth={1.5}
                              className="text-primary-main size-4"
                            />
                          )}
                        </div>

                        <div className="flex flex-col max-w-60">
                          <p className="text-xs w-full truncate font-semibold text-black">
                            {fileData.fileName}
                          </p>
                          <span className="text-[10px] truncate text-[#8F8D8D] font-medium">
                            {fileData.type.split("/")[1].toUpperCase()}
                          </span>
                          {/* Cross icon - only visible on hover */}

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
                          <X className="size-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <textarea
                  autoFocus
                  ref={textAreaRef}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    handleAutoTextAreaResize(e.target);
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      query.trim() &&
                      !isProcessing
                    ) {
                      sendMessage();
                    }
                  }}
                  value={query}
                  placeholder="Ask Follow Up Questions"
                  className="w-full bg-transparent resize-none placeholder:text-neutral-150 focus:outline-none"
                />
                <div className="flex items-center justify-between gap-x-4">
                  <div className="flex items-center gap-x-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setDeepResearch(!deepResearch)}
                            className={cn(
                              "flex items-center justify-center gap-2 rounded-[0.5rem] bg-primary-light sm:px-3 sm:py-2 p-2 text-sm font-normal text-primary-300 transition-colors",
                              deepResearch && "bg-primary-main text-white"
                            )}
                            aria-checked={deepResearch}
                            role="checkbox"
                          >
                            <PiPlanetLight className="size-5 flex-shrink-0" />

                            <span className="sm:block hidden">
                              Deep Research
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Deep Research</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Select
                      value={currentSearchMode}
                      onValueChange={handleAgentChange}
                    >
                      <SelectTrigger className="w-[120px] border border-primary-100 focus:border-primary-main">
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
                  <div className="flex items-center gap-x-4">
                    <input
                      accept=".pdf,.txt,.xlsx"
                      onChange={(e) => {
                        handleDocUploadChange(e.target.files);
                        e.target.value = "";
                      }}
                      type="file"
                      ref={docRef}
                      hidden
                    />
                    <button onClick={openDocUpload}>
                      <Paperclip size={20} />
                    </button>

                    {
                      isProcessing ? (
                        <button
                          disabled={isStopGeneratingResponse}
                          onClick={stopGeneratingResponse}
                          className="flex items-center justify-center size-10 disabled:bg-primary-200 rounded-full bg-primary-main"
                        >
                          {isStopGeneratingResponse ? <Loader2 className="size-4 text-white animate-spin" /> : <div className="size-3.5 bg-white rounded"></div>}
                        </button>
                      ) : (
                        <button
                          disabled={!query.trim() || isProcessing}
                          onClick={() => sendMessage()}
                          className="flex items-center justify-center size-8 rounded-full disabled:bg-primary-200 bg-primary-main"
                        >
                          <MoveUp className="text-white size-5" />
                        </button>
                      )
                    }

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {messages[currentMessageIdx]?.sources &&
        messages[currentMessageIdx].sources.length > 0 && (
          <div className="">
            <Citation
              data={messages[currentMessageIdx].sources}
              open={open}
              onOpenChange={() => setOpen(false)}
            />
          </div>
        )}
      <FeedbackDialog
        isOpen={openFeedbackModal}
        messageId={reportMessageId}
        responseId={reportResponseId}
        onOpenChange={setOpenFeedbackModal}
      />
      <ChatSharingDialog
        open={openChatSharingModal}
        onOpenChange={setOpenChatSharingModal}
        sessionId={sessionId}
      />
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
  );
};

export default SpecificChat;
