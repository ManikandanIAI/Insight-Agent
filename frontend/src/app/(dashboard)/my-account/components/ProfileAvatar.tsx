import React from 'react';
import { motion } from 'framer-motion';

interface ProfileAvatarProps {
    name: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    image:string;
}
const ProfileAvatar:React.FC<ProfileAvatarProps> = ({ name, size = 'md', className = '' ,image}) => {
  const initials = name
    ? name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)
    : 'NA';

  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-16 h-16 text-xl',
    lg: 'w-24 h-24 text-2xl'
  };

  return (
    <div>
  {!image ? (
    <motion.div
      className={`bg-primary-600 text-white rounded-full flex items-center justify-center font-semibold ${sizeClasses[size]} ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      {initials}
    </motion.div>
  ) : (
    <motion.img
      src={image}
      alt="Profile"
      className={`object-cover rounded-full ${sizeClasses[size]} ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2 }}
    />
  )}
</div>

  );
};

export default ProfileAvatar;