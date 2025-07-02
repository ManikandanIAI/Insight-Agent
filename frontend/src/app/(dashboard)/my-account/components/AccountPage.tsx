"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import ProfileAvatar from "./ProfileAvatar";
import AccountField from "./AccopuntField";
import { useAuthStore } from "@/store/useZustandStore";
import { DeleteAccountModal } from "./DeleteAccountModal";
import { LogoutDialog } from "@/components/layout/components/LogoutDialog";
import { OtpPasswordResetDialog } from "@/app/(auth)/components/ResetPassword";
import UploadProfilePhotoDialog from "./UploadProfilePhoto";
const AccountPage = () => {
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isOtpDialogOpen, setIsOtpDialogOpen] = useState(false);
  const [openProfilePhotoDialog, setOpenProfilePhotoDialog] = useState(false);
  const [image, setImage] = useState("");

  const { username, email, profilePicture } = useAuthStore();

  return (
    <div className="space-y-10 lg:max-w-2xl w-full">
      <motion.h1 className="text-2xl text-center font-medium text-gray-900 py-6 border-b border-primary-100 hidden md:block">
        My Account
      </motion.h1>

      {/* Profile Section */}
      <motion.section className="w-full">
        <div className="flex flex-col w-full sm:flex-row items-start sm:items-center">
          <div className="flex w-full items-center mb-4 sm:mb-0">
            <ProfileAvatar
              name={username || ""}
              size="md"
              className="mr-4 flex-shrink-0"
              image={profilePicture ? profilePicture : image}
            />
            <div className="w-full">
              <AccountField
                label={username || ""}
                value={email || ""}
                buttonText="Change Profile Photo"
                onButtonClick={() => setOpenProfilePhotoDialog(true)}
              />
            </div>
          </div>
        </div>
      </motion.section>

      {/* Account Information Section */}
      <motion.section className="space-y-7">
        <AccountField
          label="Full Name"
          value={username || ""}
          hideButton={true}
        />
        {/* <AccountField
                    label="Username"
                    value={username || ""}
                    buttonText="Change Username"
                    onButtonClick={() => console.log('Change username')}
                /> */}
        <AccountField label="Email" value={email || ""} hideButton={true} />
        <AccountField
          label="Password"
          value="••••••••••"
          buttonText="Change Password"
          onButtonClick={() => setIsOtpDialogOpen(true)}
        />
        {/* <AccountField
                    label="Current Plan"
                    value="Free Plan"
                    buttonText="Learn about Pro Plan"
                    onButtonClick={() => console.log('Change password')}
                /> */}
      </motion.section>
      <hr className="w-full border-primary-100" />

      {/* Subscription Section */}
      <motion.section className="space-y-7">
        <AccountField
          label="Support"
          hideButton={false}
          buttonText="Contact"
          variant="primary"
        />
        <AccountField
          label={`You  are logged in as ${email || ""}`}
          buttonText="Logout"
          variant="primary"
          onButtonClick={() => setLogoutDialogOpen(true)}
        />
        {/* <AccountField
                    label="Log out of all devices"
                    value='Devices or browsers where you are signed in'
                    buttonText="Log out from all devices"
                    variant='primary'
                    onButtonClick={() => console.log('Change username')}
                /> */}
        <AccountField
          label="Delete account"
          value="Permanently delete your account and data"
          buttonText="Learn More"
          variant="outline"
          onButtonClick={() => setDeleteAccountModalOpen(true)}
        />
      </motion.section>

      <DeleteAccountModal
        isOpen={deleteAccountModalOpen}
        onClose={() => setDeleteAccountModalOpen(false)}
      />
      <LogoutDialog
        open={logoutDialogOpen}
        onHandleChange={() => setLogoutDialogOpen(false)}
      />
      <OtpPasswordResetDialog
        open={isOtpDialogOpen}
        onOpenChange={setIsOtpDialogOpen}
      />
      <UploadProfilePhotoDialog
        isOpen={openProfilePhotoDialog}
        onOpenChange={setOpenProfilePhotoDialog}
        setImage={setImage}
      />
    </div>
  );
};

export default AccountPage;
