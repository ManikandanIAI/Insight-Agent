import React from 'react';

interface IconProps {
  isActive?: boolean;
  className?: string;
}

const TooShortIcon: React.FC<IconProps> = ({ isActive = false, className = '' }) => {
  const strokeColor = isActive ? 'rgba(33, 128, 141, 0.5)' : 'black'; // or any logic you'd prefer

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="15" viewBox="0 0 14 15" fill="none">
  <g clipPath="url(#clip0_1061_5517)">
    <mask id="mask0_1061_5517"  maskUnits="userSpaceOnUse" x="0" y="0" width="14" height="15">
      <path d="M13.6 14.1V0.900041H0.4V14.1H13.6Z" fill="white" stroke="white" strokeWidth="0.8"/>
    </mask>
    <g mask="url(#mask0_1061_5517)">
      <path d="M13.4531 9.85157C13.4531 10.7577 12.7186 11.4922 11.8125 11.4922H2.1875C1.28141 11.4922 0.546875 10.7577 0.546875 9.85157V5.14846C0.546875 4.24237 1.28141 3.50784 2.1875 3.50784H11.8125C12.7186 3.50784 13.4531 4.24237 13.4531 5.14846V7.1172" stroke="black" strokeWidth="0.8" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.73438 6.26953V5.72266H6.34374V6.26953" stroke="black" strokeWidth="0.8" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4.51172 9.30469V5.72267" stroke="black" strokeWidth="0.8" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6.74375 9.30469C6.74375 9.38581 6.8095 9.45156 6.89062 9.45156C6.97175 9.45156 7.0375 9.38581 7.0375 9.30469C7.0375 9.22356 6.97175 9.15782 6.89062 9.15782C6.8095 9.15782 6.74375 9.22356 6.74375 9.30469Z" fill="black" stroke="black" strokeWidth="0.8"/>
      <path d="M8.93125 9.30469C8.93125 9.38581 8.997 9.45156 9.07812 9.45156C9.15925 9.45156 9.225 9.38581 9.225 9.30469C9.225 9.22356 9.15925 9.15782 9.07812 9.15782C8.997 9.15782 8.93125 9.22356 8.93125 9.30469Z" fill="black" stroke="black" strokeWidth="0.8"/>
      <path d="M11.1188 9.30469C11.1188 9.38581 11.1845 9.45156 11.2656 9.45156C11.3467 9.45156 11.4125 9.38581 11.4125 9.30469C11.4125 9.22356 11.3467 9.15782 11.2656 9.15782C11.1845 9.15782 11.1188 9.22356 11.1188 9.30469Z" fill="black" stroke="black" strokeWidth="0.8"/>
    </g>
  </g>
  <defs>
    <clipPath id="clip0_1061_5517">
      <rect width="14" height="14" fill="white" transform="translate(0 0.5)"/>
    </clipPath>
  </defs>
</svg>

  );
};

export default TooShortIcon;
