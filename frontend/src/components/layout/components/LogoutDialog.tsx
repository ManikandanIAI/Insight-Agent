// components/LogoutDialog.tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { logout } from "@/utils/auth";



interface ILogoutDialogProps {
    open: boolean;
    onHandleChange: () => void;
}

export const LogoutDialog:React.FC<ILogoutDialogProps> = ({open, onHandleChange}) => {
  const handleConfirm = () => {
    onHandleChange();
  };

  const handleLogout = () => {
    logout();
  }

  return (
    <Dialog open={open} onOpenChange={handleConfirm}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This will end your current session.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleConfirm}>
            Cancel
          </Button>
          <Button onClick={handleLogout} variant="destructive">
            Confirm Logout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
