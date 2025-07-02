import React from 'react';

interface IconProps {
    isActive?: boolean;
    className?: string;
}

const InacurateIcon: React.FC<IconProps> = ({ isActive = false, className = '' }) => {
    const strokeColor = isActive ? 'rgba(33, 128, 141, 0.5)' : 'black'; // or any logic you'd prefer

    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="15" viewBox="0 0 14 15" fill="none">
            <path d="M7 1.375C3.6225 1.375 0.875 4.1225 0.875 7.5C0.875 10.8775 3.6225 13.625 7 13.625C10.3775 13.625 13.125 10.8775 13.125 7.5C13.125 4.1225 10.3775 1.375 7 1.375ZM7 12.75C4.10375 12.75 1.75 10.3962 1.75 7.5C1.75 4.60375 4.10375 2.25 7 2.25C9.89625 2.25 12.25 4.60375 12.25 7.5C12.25 10.3962 9.89625 12.75 7 12.75Z" fill="black" />
            <path d="M8.85508 5.02332L7.00008 6.87832L5.14508 5.02332C4.73383 4.61207 4.11695 5.23332 4.5282 5.64019L6.3832 7.49519L4.5282 9.35019C4.11695 9.76144 4.74258 10.3739 5.14508 9.96707L7.00008 8.11207L8.85508 9.96707C9.26195 10.3739 9.8832 9.75707 9.47195 9.35019L7.61695 7.49519L9.47195 5.64019C9.8832 5.22894 9.26195 4.61207 8.85508 5.02332Z" fill="black" />
        </svg>
    );
};

export default InacurateIcon;
