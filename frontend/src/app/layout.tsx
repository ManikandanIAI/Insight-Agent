// app/layout.tsx
"use client";

import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { verifyToken } from "@/utils/auth";
import { useAuthStore } from "@/store/useZustandStore";
import LoaderComponent from "@/components/Loader";
import NextTopLoader from 'nextjs-toploader';

const fustat = Schibsted_Grotesk({
  variable: "--font-fustat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  
  const noSidebarPages = ['/login', '/signup', '/reset-password', "/onbording"];
  const publicPages = ["/share"];

  useEffect(() => {
    if(publicPages.includes(pathname)) {
      setIsLoading(false);
      return;
    }

    const checkAuth = async () => {
      setIsLoading(true);
      
      // Skip verification if already authenticated in store
      if (isAuthenticated && !noSidebarPages.includes(pathname)) {
        setIsLoading(false);
        return;
      }

      // Otherwise verify the token
      const isValid = await verifyToken();
      
      if (isValid) {
        if (noSidebarPages.includes(pathname)) {
          router.push('/');
        }
      } else {
        if (!noSidebarPages.includes(pathname)) {
          router.push('/login');
        }
      }
      
      setIsLoading(false);
    };

    checkAuth();
  }, [pathname, router, isAuthenticated]);

  return (
    <html lang="en" className={`${fustat.variable}`}>
      <body>
        {/* NextTopLoader should always be rendered */}
        <NextTopLoader
          color="#954767"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #954767,0 0 5px #954767"
        />
        
        {isLoading ? (
          <LoaderComponent />
        ) : (
          <>
            {children}
            <Toaster richColors position="top-center" />
          </>
        )}
      </body>
    </html>
  );
}