import React from 'react';

interface IconProps {
  isActive?: boolean;
  className?: string;
}

const OffensiveIcon: React.FC<IconProps> = ({ isActive = false, className = '' }) => {
  const strokeColor = isActive ? 'rgba(33, 128, 141, 0.5)' : 'black'; // or any logic you'd prefer

  return (
    <svg
      width="14"
      height="15"
      viewBox="0 0 14 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g clipPath="url(#clip0_1015_8110)">
        <path
          d="M5.85391 3.91064C3.01279 3.91064 0.709598 6.21384 0.709598 9.05496C0.709598 10.5207 1.32264 11.8433 2.30631 12.7803C2.01852 13.6099 1.2285 14.2043 0.300781 14.1993H5.85391C8.69504 14.1993 10.9983 11.8961 10.9983 9.05499C10.9983 6.21386 8.69504 3.91064 5.85391 3.91064Z"
          stroke={strokeColor}
          strokeWidth="0.7"
          strokeMiterlimit="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.21094 3.92152C6.45274 2.15873 7.96479 0.800781 9.79401 0.800781C11.7915 0.800781 13.4108 2.42008 13.4108 4.41759C13.4108 5.44813 12.9798 6.378 12.2882 7.03677C12.4905 7.61998 13.046 8.03788 13.6982 8.03441H10.8896"
          stroke={strokeColor}
          strokeWidth="0.7"
          strokeMiterlimit="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8.26932 11.4674C9.61077 10.1259 9.61074 7.95094 8.26924 6.60949C6.92774 5.26804 4.75278 5.26808 3.41133 6.60958C2.06988 7.95108 2.06992 10.126 3.41142 11.4675C4.75291 12.8089 6.92787 12.8089 8.26932 11.4674Z"
          stroke={strokeColor}
          strokeWidth="0.7"
          strokeMiterlimit="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.59961 7.69221V8.97693M6.89564 7.68359L6.12061 9.07088H7.38979L6.71673 10.3938"
          stroke={strokeColor}
          strokeWidth="0.7"
          strokeMiterlimit="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <clipPath id="clip0_1015_8110">
          <rect width="14" height="14" fill="white" transform="translate(0 0.5)" />
        </clipPath>
      </defs>
    </svg>
  );
};

export default OffensiveIcon;
