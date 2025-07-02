import React from 'react';

interface IconProps {
  isActive?: boolean;
  className?: string;
}

const WrongSourcesIcon: React.FC<IconProps> = ({ isActive = false, className = '' }) => {
  const strokeColor = isActive ? 'rgba(33, 128, 141, 0.5)' : 'black'; // or any logic you'd prefer

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="15" viewBox="0 0 14 15" fill="none">
  <g clipPath="url(#clip0_1061_5554)">
    <mask id="mask0_1061_5554" style={{maskType:"luminance"}} maskUnits="userSpaceOnUse" x="0" y="0" width="14" height="15">
      <path d="M13.6 14.1V0.900041H0.4V14.1H13.6Z" fill="white" stroke="white" strokeWidth="0.8"/>
    </mask>
    <g mask="url(#mask0_1061_5554)">
      <path d="M10.4576 1H3.54237C2.13825 1 1 2.13825 1 3.54237V10.4576C1 11.8618 2.13825 13 3.54237 13H10.4576C11.8618 13 13 11.8618 13 10.4576V3.54237C13 2.13825 11.8618 1 10.4576 1Z" stroke="black" strokeWidth="0.8" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 6.48829V10.6719" stroke="black" strokeWidth="0.8" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 4.32813C6.92449 4.32813 6.86328 4.38934 6.86328 4.46485C6.86328 4.54035 6.92449 4.60156 7 4.60156C7.0755 4.60156 7.13671 4.54035 7.13671 4.46485C7.13671 4.38934 7.0755 4.32813 7 4.32813Z" fill="black" stroke="black" strokeWidth="1.09375"/>
    </g>
  </g>
  <defs>
    <clipPath id="clip0_1061_5554">
      <rect width="14" height="14" fill="white" transform="translate(0 0.5)"/>
    </clipPath>
  </defs>
</svg>
  );
};

export default WrongSourcesIcon;
