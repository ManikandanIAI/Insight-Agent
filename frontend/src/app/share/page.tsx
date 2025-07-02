"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import Markdown from "@/components/markdown/Markdown";
import { ChevronDown } from "lucide-react";
import FinanceChart from "@/components/charts/FinanaceChart";
import FeedbackDialog from "@/app/(chats)/chat/component/FeedbackModal";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import MapView from "@/components/maps/MapView";
import Sources2 from "@/app/(chats)/chat/component/Sources";
import Citation2 from "@/app/(chats)/chat/component/Citation";
import { IMessage } from "@/app/(chats)/chat/component/SpecificChat";
import { axiosInstance } from "@/services/axiosInstance";
import { toast } from "sonner";
import ApiServices from "@/services/ApiServices";

const SharedChat = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [sessionId, setSessionId] = useState("");
    const [open, setOpen] = useState(false);
    const [currentTickerSymbol, setCurrentTickerSymbol] = useState("");

    // State for UI rendering
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [expanded, setExpanded] = useState<string[]>([]);
    const [messageId, setMessageId] = useState("");

    const [currentMessageIdx, setCurrentMessageIdx] = useState(0);

    // Refs for DOM elements and mutable values
    const chatDivRef = useRef<HTMLDivElement>(null);
    const latestQueryRef = useRef<HTMLDivElement | null>(null);

    const [toggleResearchData, setToggleResearchData] = useState<string[]>([]);

    const [showSpecificMap, setShowSpecificMap] = useState<string[]>([]);
    const [showSpecificChartLoader, setShowSpecificChartLoader] = useState<
        string[]
    >([]);

    const [reportMessageId, setReportMessageId] = useState<string | null>(null);
    const [reportResponseId, setReportResponseId] = useState<string | null>(null);

    const [openFeedbackModal, setOpenFeedbackModal] = useState(false);

    const isReplacingRef = useRef(false);


    // Fetch messages if initialMessageData is not available
    const getMessages = async (sessionId: string) => {
        try {
           
            const result = await ApiServices.getSharedCoversationData(sessionId)

            let newMessages: IMessage[] = [];

            if (result.data.message_list.length === 0) {
                router.push("/");
                toast.error(`Unable to load conversation ${sessionId}`);
                return;
            }

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
                    }
                }

                if (message.research) {
                    newMessages[index].research = message.research;
                }

                if (message.sources) {
                    newMessages[index].sources = message.sources;
                }

                if (message.stock_chart) {
                    newMessages[index].chart_data = message.stock_chart
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



    useEffect(() => {
        const sessionIdFromParams = searchParams.get("conversation");

        // Skip the full reload logic if we're just replacing the URL
        if (isReplacingRef.current) {
            isReplacingRef.current = false; // Reset for next time
            return;
        }
        // Check if sessionIdFromParams is valid
        if (sessionIdFromParams && sessionIdFromParams.length === 36) {
            setSessionId(sessionIdFromParams);
            getMessages(sessionIdFromParams);
        } else {
            router.push("/");
            toast.error(`Unable to load conversation`);
        }
    }, [searchParams]);

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

    const handleOpen = (idx: number) => {
        setOpen(true);
        setCurrentMessageIdx(idx);
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

    return (
        <div className="w-full flex  h-[calc(100vh-4.75rem)] lg:h-screen">
            <div className="w-full h-full lg:py-6 pb-4 lg:pr-8 flex flex-col">
                <div className="lg:ml-8 lg:px-0 sm:px-6 px-4 mt-2 w-full flex flex-col flex-grow overflow-hidden">
                    <div
                        ref={chatDivRef}
                        className="w-full 2xl:max-w-full mx-auto xl:max-w-3xl lg:max-w-3xl flex flex-col flex-grow overflow-y-auto"
                    >
                        {messages.length > 0 &&
                            messages.map((message, index) => {
                                const isLastQuery = index === messages.length - 1;
                                return (
                                    <div
                                        ref={isLastQuery ? latestQueryRef : null}
                                        key={index}
                                        data-message-index={index}
                                        className="w-full grid grid-cols-1 2xl:grid-cols-10"
                                    >
                                        <div className="flex-grow w-full mb-4 lg:pr-5 2xl:col-span-6 col-span-1">
                                            {/* Render if message.query exists */}
                                            {message.query && (
                                                <div className="flex justify-start my-8">
                                                    <div className="w-fit">
                                                        <h2 className="text-primary-dark font-medium sm:text-3xl text-2xl leading-tight">
                                                            {message.query}
                                                        </h2>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Render if message.research exists and has length > 0 */}
                                            {message.research && message.research.length > 0 && (
                                                <div className="max-w-full border border-primary-100 bg-[rgba(var(--financial-bg))] sm:rounded-2xl rounded-xl sm:py-4 py-2 sm:px-6 px-3">
                                                    <div
                                                        onClick={() =>
                                                            handleToggleResearchData(message.message_id)
                                                        }
                                                        className="flex items-center justify-between cursor-pointer gap-x-2"
                                                    >
                                                        {isProcessing &&
                                                            message.message_id === messageId ? (
                                                            <div className="flex items-center  gap-x-2">
                                                                <div role="status" className="flex-shrink-0">
                                                                    <Image
                                                                        src="/images/loader.svg"
                                                                        alt="loader"
                                                                        priority
                                                                        height={20}
                                                                        width={20}
                                                                        className="animate-spin"
                                                                    />
                                                                </div>

                                                                <p className="text-base font-semibold">
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
                                                    </div>

                                                    {isProcessing && message.message_id === messageId}

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
                                                                                        "cursor-pointer h-[2rem] transition-height duration-300 overflow-hidden flex items-start px-3 rounded-md  gap-x-2 py-1 first:pt-0 last:pb-0",
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

                                            {/* {message.chart_data && message.chart_data.length > 0 && (
                                                <div className="my-4 2xl:hidden block">
                                                    <FinanceChart
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
                                            )} */}

                                            {message.response && (
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
                                                                className={cn({ "font-[Arial]": isRtl })}
                                                                dir={isRtl ? "rtl" : "ltr"}
                                                            >
                                                                <Markdown allowHtml={true} latex={false}>
                                                                    {content}
                                                                </Markdown>
                                                            </div>
                                                        );
                                                    })()}

                                                    <div className="flex items-center justify-between flex-wrap gap-y-6 gap-x-2 my-6">
                                                        <div>
                                                            {message.sources &&
                                                                message.sources.length > 0 && (
                                                                    <div className="">
                                                                        <Sources2
                                                                            data={message.sources}
                                                                            onHandleCitationData={() =>
                                                                                handleOpen(index)
                                                                            }
                                                                        />
                                                                    </div>
                                                                )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-8 2xl:block hidden lg:ml-10 2xl:col-span-4 col-span-1 lg:mb-0 mb-8">
                                            <div className="flex gap-x-5 items-center">
                                                {message.chart_data &&
                                                    message.chart_data.length > 0 && (
                                                        <div className={cn(
                                                                "p-3 px-1 cursor-pointer border-0 border-b-2 border-b-primary-main"
                                                            )}>
                                                            <p className="text-sm leading-normal font-semibold text-primary-main">
                                                                Visual Data
                                                                <span className="text-[10px] mr-0.5 leading-normal font-semibold text-[#A09F9B]">
                                                                    (Graphs)
                                                                </span>
                                                            </p>
                                                        </div>
                                                    )}

                                                {/* {
                          message.map_data && (
                            <div onClick={() => handleShowSpecificMap(message.message_id, false)} className={cn("p-3 px-1 cursor-pointer", { "border-0 border-b-2 border-b-primary-main": (showSpecificMap.includes(message.message_id) || !(message.chart_data)) })}>
                              <p className="text-sm leading-normal font-semibold text-primary-main">Visual Data <span className="text-[10px] mr-0.5 leading-normal font-semibold text-[#A09F9B]">(Maps)</span></p>
                            </div>
                          )
                        } */}

                                                {/* {message.sources && message.sources.length > 0 && (
                          <div onClick={() => handleShowSpecificMap(message.message_id, false)} className={cn("p-3 px-1 cursor-pointer", { "border-0 border-b-2 border-b-primary-main": (showSpecificMap.includes(message.message_id)) }, { "border-0 border-b-2 border-b-primary-main": !(message.chart_data) })}>
                            <Sources data={message.sources} />
                          </div>
                        )} */}
                                            </div>

                                            <div className="mt-4 md:pr-6 h-full">
                                                {/* {message.chart_data &&
                                                    message.chart_data.length > 0 &&
                                                    !showSpecificMap.includes(message.message_id) && (
                                                        <FinanceChart
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
                                                    )} */}

                                                {/* {message.map_data && (showSpecificMap.includes(message.message_id) || !(message.chart_data)) && (
                          <MapView hexagonData={message.map_data} />
                        )} */}

                                                {/* {message.sources && message.sources.length > 0 && (showSpecificMap.includes(message.message_id) || !(message.chart_data)) && (
                          <Citation data={message.sources} open={open} onOpenChange={() => setOpen(false)} />
                        )} */}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            </div>
            {messages[currentMessageIdx]?.sources &&
                messages[currentMessageIdx].sources.length > 0 && (
                    <div className="">
                        <Citation2
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
        </div>
    );
};

export default SharedChat;
