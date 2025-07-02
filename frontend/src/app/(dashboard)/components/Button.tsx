import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';


// Define the type for the props
interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    fullWidth?: boolean;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    children: React.ReactNode;
}
// Define the Button component
const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    disabled = false,
    ...props
}) => {
    // Define the variants and sizes for the button

    const variants = {
        primary: 'bg-primary-main text-white hover:bg-primary-700 focus:ring-primary-main',
        secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-primary-main',
        outline: 'bg-white border border-primary-600 text-primary-600 hover:bg-primary-50 focus:ring-primary-main',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-500',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-5 py-2.5 text-base',
    };

    return (
        <motion.button
            type='button'
            disabled={disabled}
            className={clsx(
                'inline-flex disabled:opacity-50 disabled:cursor-not-allowed items-center justify-center rounded-md font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
                variants[variant],
                sizes[size],
                fullWidth ? 'w-full' : '',
                className

            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
            {...props}
        >
            {children}
        </motion.button>
    );
};

export default Button;