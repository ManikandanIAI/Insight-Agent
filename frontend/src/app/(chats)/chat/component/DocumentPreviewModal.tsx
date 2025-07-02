"use client";
import React, { useEffect, useState, useCallback, use } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, FileSpreadsheet, FileType2, Loader2 } from "lucide-react";
import ApiServices from "@/services/ApiServices";

interface FilePreviewDialogProps {
  open: boolean;
  onClose: (open: boolean) => void;
  fileId: string;
  fileName: string;
  fileType: string;
}

const FilePreviewDialog: React.FC<FilePreviewDialogProps> = ({ open, onClose, fileId, fileName, fileType }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create and cleanup object URL
  // useEffect(() => {
  //   if (!file || !open) {
  //     return;
  //   }

  //   let url: string | null = null;

  //   try {
  //     url = URL.createObjectURL(file);
  //     setObjectUrl(url);
  //     setError(null);
  //   } catch (err) {
  //     setError("Failed to create file preview");
  //     console.error("Error creating object URL:", err);
  //   }

  //   // Cleanup function
  //   return () => {
  //     if (url) {
  //       URL.revokeObjectURL(url);
  //     }
  //     setObjectUrl(null);
  //     setIsLoading(true);
  //     setError(null);
  //   };
  // }, [file, open]);

  useEffect(() => {
    if (!fileId || !open) {
      return;
    }

    setIsLoading(true);
    setError(null);

    // Simulate fetching file data
    const fetchFileData = async () => {
      try {

        console.log("Fetching file data for preview:", fileId);
        // Replace with actual API call to fetch file data
        const response = await ApiServices.handlePreviewFile(fileId);
        setObjectUrl(response);
      } catch (err) {
        setError("Failed to load file preview");
        console.error("Error fetching file data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFileData();

    // Cleanup function
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setObjectUrl(null);
      setIsLoading(true);
      setError(null);
    };
  }, [fileId, open]);

  const getFileIcon = () => {
    
    if (fileType.includes("pdf")) return <FileText className="w-8 h-8" />;
    if (fileType.includes("spreadsheet") || fileName.endsWith(".xlsx")) return <FileSpreadsheet className="w-8 h-8" />;
    if (fileType.includes("text")) return <FileType2 className="w-8 h-8" />;
    return <FileText className="w-8 h-8" />;
  };

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleIframeError = useCallback(() => {
    setIsLoading(false);
    setError("Failed to load file preview");
  }, []);

  const getPreview = () => {
    if (error) {
      return (
        <div className="text-center text-sm text-red-600 p-8">
          <div className="mb-2">❌ {error}</div>
          {objectUrl && (
            <a
              href={objectUrl}
              download={fileName}
              className="text-blue-600 underline hover:text-blue-800"
            >
              Download file instead
            </a>
          )}
        </div>
      );
    }

    if (!objectUrl) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Preparing preview...</span>
        </div>
      );
    }

    if (fileType.includes("pdf")) {
      return (
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Loading PDF...</span>
            </div>
          )}
          <iframe
            allowFullScreen
            key={objectUrl + fileName}
            src={`${objectUrl}#toolbar=1&navpanes=1&scrollbar=1`}
            className="w-full h-[50dvh] border-0 rounded-lg"
            title={`Preview of ${fileName}`}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        </div>
      );
    }

    if (fileType.includes("spreadsheet") || fileName.endsWith(".xlsx")) {
      return (
        <div className="text-center text-sm text-muted-foreground p-8">
          <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <div className="mb-4">Excel preview not supported in browser.</div>
          <a
            href={objectUrl}
            download={fileName}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            📥 Download {fileName}
          </a>
        </div>
      );
    }

    if (fileType.includes("text")) {
      return (
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Loading text...</span>
            </div>
          )}
          <iframe
            src={objectUrl}
            className="w-full h-[80vh] bg-white border border-gray-200"
            title={`Preview of ${fileName}`}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        </div>
      );
    }

    return (
      <div className="text-center text-sm text-muted-foreground p-8">
        <FileType2 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <div className="mb-4">Preview not supported for this file type.</div>
        <a
          href={objectUrl}
          download={fileName}
          className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          📥 Download {fileName}
        </a>
      </div>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl  max-h-[60dvh] p-4 gap-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {getFileIcon()}
            <div className="flex flex-col items-start">
              <span className="font-medium">{fileName}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {fileType || 'Unknown type'} 
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 h-full overflow-hidden">
          {getPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FilePreviewDialog;