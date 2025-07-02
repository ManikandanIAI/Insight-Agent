import React from 'react';

interface IconProps {
  isActive?: boolean;
  className?: string;
}

const OutOfDateIcon: React.FC<IconProps> = ({ isActive = false, className = '' }) => {
  const strokeColor = isActive ? 'rgba(33, 128, 141, 0.5)' : 'black'; // or any logic you'd prefer

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="15" viewBox="0 0 14 15" fill="none">
      <g clipPath="url(#clip0_1061_5496)">
        <path d="M9.48825 14.0898H2.05078C1.14469 14.0898 0.410156 13.3553 0.410156 12.4492" stroke="black" strokeWidth="0.88" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.3593 0.910188H10.3086H2.87109C2.41806 0.910188 2.05078 1.27747 2.05078 1.7305V3.64456L3.6914 4.19143L2.05078 5.55861V11.6289" stroke="black" strokeWidth="0.88" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11.1289 12.4492V10.5352L9.48828 9.98829L10.3086 9.3047V8.29298L11.1289 7.47267V2.14066" stroke="black" strokeWidth="0.88" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.3594 0.910164C13.0389 0.910164 13.5898 1.46106 13.5898 2.14063V3.37109H11.1289V2.14063C11.1289 1.46106 11.6798 0.910164 12.3594 0.910164Z" stroke="black" strokeWidth="0.88" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.84763 11.6289H0.410156" stroke="black" strokeWidth="0.88" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M0.410156 11.6289V12.4492C0.410156 13.3553 1.14469 14.0898 2.05078 14.0898H9.48825H2.87109" stroke="black" strokeWidth="0.88" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.84766 11.6289V12.4492C7.84766 13.3553 8.58219 14.0898 9.48828 14.0898C10.3944 14.0898 11.1289 13.3553 11.1289 12.4492V10.5352" stroke="black" strokeWidth="0.88" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11.1289 5.83203H10.3086" stroke="black" strokeWidth="0.88" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.05078 7.47266H2.87109" stroke="black" strokeWidth="0.88" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 3H9" stroke="black" strokeWidth="0.88" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4.51172 5.83203H8.66796" stroke="black" strokeWidth="0.88" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 9H6.51562" stroke="black" strokeWidth="0.88" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <defs>
        <clipPath id="clip0_1061_5496">
          <rect width="14" height="14" fill="white" transform="translate(0 0.5)" />
        </clipPath>
      </defs>
    </svg>
  );
};

export default OutOfDateIcon;
