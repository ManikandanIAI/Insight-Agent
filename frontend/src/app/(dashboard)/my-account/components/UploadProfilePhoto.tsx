//uploadprofilephoto.tsx
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  //DialogTrigger,
} from "@/components/ui/dialog";
//import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { axiosInstance } from "@/services/axiosInstance";
import { API_ENDPOINTS } from "@/services/endpoints";
import { Button } from "@/components/ui/button";
import { UploadCloud } from "lucide-react";
import Image from "next/image";
//import { verifyToken } from "@/utils/auth";
import { useAuthStore } from "@/store/useZustandStore";

interface IUploadProfilePhotoDialog {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  setImage: React.Dispatch<React.SetStateAction<string>>;
}

const UploadProfilePhotoDialog: React.FC<IUploadProfilePhotoDialog> = ({
  isOpen,
  onOpenChange,
  //setImage,
}) => {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleFileUploadClick = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setLoading(true);
    try {
      const userId = localStorage.getItem("user_id") || "";

      const toBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
        });

      const base64Image = await toBase64(selectedFile);

      const res = await axiosInstance.patch(
        `${API_ENDPOINTS.UPDATE_USER_PROFILE}/${userId}`,
        { profile_picture: base64Image }
      );

      useAuthStore.getState().setProfilePicture(res.data.profile_picture);
      //await verifyToken();
      toast.success("Profile photo updated successfully.");
      setSelectedFile(null);
      setPreviewUrl(null);
      onOpenChange(false);
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload profile photo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Profile Photo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {previewUrl && (
            <div className="relative w-32 h-32 rounded-full mx-auto overflow-hidden">
              <Image
                src={previewUrl}
                alt="Preview"
                fill
                unoptimized
                className="object-cover rounded-full"
              />
            </div>
          )}

          <div className="flex flex-col items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <Button
              variant="outline"
              type="button"
              onClick={handleFileUploadClick}
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              Choose Photo
            </Button>

            {selectedFile && (
              <p className="text-sm text-gray-500 text-center">
                {selectedFile.name}
              </p>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading || !selectedFile}
            className="w-full bg-primary-main hover:bg-primary-dark"
          >
            {loading ? "Uploading..." : "Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadProfilePhotoDialog;
