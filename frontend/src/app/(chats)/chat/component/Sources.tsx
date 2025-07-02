import { sourcesData } from "@/app/(chats)/chat/component/SpecificChat";
import Image from 'next/image'
import React from 'react'



interface SourcesProps {
    data: sourcesData[];
    onHandleCitationData: (open: boolean) => void;
}
const Sources: React.FC<SourcesProps> = ({ data, onHandleCitationData }) => {

    const sourcesData = data.length > 5 ? data.slice(0, 5) : data.length > 4 ? data.slice(0, 4) : data.length > 3 ? data.slice(0, 3) : data; const leftShownSources = data.length - sourcesData.length;
    return (
        <div className='mb-4'>
            <div onClick={() => onHandleCitationData(true)} className="py-3 cursor-pointer px-5 flex gap-x-3 w-fit items-center bg-[#F8F6EF] rounded-[3.625rem]">
                <h2 className='sm:text-base text-sm text-[#646262] leading-normal font-semibold'>Sources:</h2>
                <div className='flex'>
                    {
                        sourcesData.map((source, index) => (

                            <div key={index} className={`-ml-1 z-${index + 1}`}>
                                <Image
                                    src={source.favicon}
                                    alt="logo"
                                    height={24}
                                    width={24}
                                    priority={true}
                                    className='rounded-full'
                                />
                            </div>
                        ))
                    }
                </div>

                {leftShownSources > 0 && (<h2 className='sm:text-base text-sm text-[#646262] leading-normal font-semibold'>+ {leftShownSources} more </h2>)}


            </div>
        </div>
    )
}

export default Sources;