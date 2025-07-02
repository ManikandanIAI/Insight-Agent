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
// import { Metadata } from "next";

const fustat = Schibsted_Grotesk({
  variable: "--font-fustat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
})

// export const metadata: Metadata = {
//   title: "Insight-Agent",
//   description: "Turn data into decisions with Insight Agent",
// };

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
          router.replace('/');
        }

      } else {

        if (!noSidebarPages.includes(pathname)) {
          router.replace('/login');
        }
      }

      setIsLoading(false);
    };

    checkAuth();
  }, [pathname, router, isAuthenticated]);

  if (isLoading) {
    return (
      <html lang="en">
        <body className={`${fustat.variable} antialiased`}>
          <LoaderComponent />
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className={`${fustat.variable} antialiased`}>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}