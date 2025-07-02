import React from 'react';
import Button from '../../components/Button';
import { motion } from 'framer-motion';

// Define the type for the props
interface AccountFieldProps {
    label: string;
    value?: string;
    buttonText?: string;
    onButtonClick?: () => void;
    hideButton?: boolean;
    secondaryText?: string;
    variant?: 'outline' | 'primary' | 'secondary' | 'danger' | 'ghost';
}
// Define the AccountField component                
const AccountField: React.FC<AccountFieldProps> = ({
    label,
    value="",
    buttonText,
    onButtonClick,
    hideButton = false,
   // secondaryText = '',
    variant = 'outline'
}) => {
    return (
        <motion.div
            className="lg:max-w-2xl w-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="mb-4 sm:mb-0">
                    <h3 className="text-lg leading-none font-medium text-black">{label}</h3>
                    <span className="text-sm font-medium text-[#646262]">{value}</span>
                    <div className="mt-1 flex flex-col">
                        
                        {/* {secondaryText && (
                            <span className="text-sm text-gray-500 mt-0.5">{secondaryText}</span>
                        )} */}
                    </div>
                </div>
                {!hideButton && (
                    <Button
                        variant={variant}
                        onClick={onButtonClick}
                        className="self-start"
                    >
                        {buttonText}
                    </Button>
                )}
            </div>
        </motion.div>
    );
};

export default AccountField;