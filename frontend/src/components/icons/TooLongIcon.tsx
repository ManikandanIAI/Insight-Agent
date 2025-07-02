import React from 'react';

interface IconProps {
  isActive?: boolean;
  className?: string;
}

const TooLongIcon: React.FC<IconProps> = ({ isActive = false, className = '' }) => {
  const strokeColor = isActive ? 'rgba(33, 128, 141, 0.5)' : 'black'; // or any logic you'd prefer

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="15" viewBox="0 0 14 15" fill="none">
  <g clipPath="url(#clip0_1061_5535)">
    <path d="M2.625 4.32812C2.625 3.72407 3.1147 3.23438 3.71875 3.23438H5.90625C6.5103 3.23438 7 3.72407 7 4.32812M4.8125 3.23438V7.39062M3.71875 7.39062H5.90625" stroke="black" strokeWidth="0.88" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.1875 5.20312H11.375M9.1875 7.39062H11.375M2.73438 9.57812H11.2656M2.73438 11.7656H11.2656M11.2656 13.9531H2.73438C1.52625 13.9531 0.546875 12.9738 0.546875 11.7656V3.23438C0.546875 2.02625 1.52625 1.04688 2.73438 1.04688H11.2656C12.4738 1.04688 13.4531 2.02625 13.4531 3.23438V11.7656C13.4531 12.9738 12.4738 13.9531 11.2656 13.9531Z" stroke="black" strokeWidth="0.88" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
  </g>
  <defs>
    <clipPath id="clip0_1061_5535">
      <rect width="14" height="14" fill="white" transform="translate(0 0.5)"/>
    </clipPath>
  </defs>
</svg>
  );
};

export default TooLongIcon;
