import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // ← add your media-query breakpoints here
    screens: {
      xs: "480px",       // extra-small phones
      sm: "640px",       // small phones
      md: "768px",       // tablets
      lg: "1024px",      // laptops
      xl: "1280px",      // desktops
      "2xl": "1440px",   // large desktops
      "3xl": "1536px", // alias for lg if you like
    },
    extend: {
      fontFamily: {
        sans: "var(--font-kumbh-sans), sans-serif",
        serif: "var(--font-cormorant), serif",
        inter: "var(--font-inter), sans-serif",
        fustat: "var(--font-fustat)",
      },
      colors: {
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          main: "var(--color-primary-main)",
          light: "var(--color-primary-light)",
          dark: "var(--color-primary-dark)",
          800: "var(--color-primary-800)",
          600: "var(--color-primary-600)",
          400: "var(--color-primary-400)",
          200: "var(--color-primary-200)",
		      150: "var(--color-primary-150)",
          100: "var(--color-primary-100)",
        },
		accent: {
			DEFAULT: "hsl(var(--accent))",
			foreground: "hsl(var(--accent-foreground))",
			100: "var(--color-accent-100)",
			200: "var(--color-accent-200)",	
		},
        // Neutral gray scale
        neutral: {
          900: "var(--color-neutral-900)",
          800: "var(--color-neutral-800)",
          700: "var(--color-neutral-700)",
          500: "var(--color-neutral-500)",
          300: "var(--color-neutral-300)",
          200: "var(--color-neutral-200)",
		  150: "var(--color-neutral-150)",
          100: "var(--color-neutral-100)",
          50: "var(--color-neutral-50)",
        },
		
        // Pure white
        white: "var(--color-white)",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: "var(--sidebar)",
        text: {
          color: "var(--text-color)",
        },
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
