import { Loader } from "lucide-react"

const LoaderComponent = () => {
    return (
        <div className="flex items-center bg-white/80 backdrop-blur-0 justify-center w-full pointer-events-none h-screen">
            <div className="">
                <Loader className="size-8 animate-spin text-primary-main" />
            </div>
        </div>
    )
}

export default LoaderComponent
