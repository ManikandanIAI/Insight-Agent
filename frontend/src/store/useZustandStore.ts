// store/useMessageStore.ts
import { IPreviewFileData } from "@/app/(chats)/chat/component/SpecificChat";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type SearchMode = "fast" | "agentic-planner" | "agentic-reasoning";

type MessageState = {
  message: string | null;
  searchMode: SearchMode;
  deepResearch: boolean;
  documents: IPreviewFileData[] | [];
  setMessage: (message: string) => void;
  setSearchMode: (searchMode: SearchMode) => void;
  setDeepResearch: (deepResearch: boolean) => void;
  setDocuments: (documents: IPreviewFileData[]) => void;
  removeDocuments: () => void;
};

export const useMessageStore = create<MessageState>()(
  devtools(
    (set) => ({
      message: null,
      searchMode: "fast",
      deepResearch: false,
      documents: [],
      setMessage: (message) => set({ message }, false, "setMessage"),
      setSearchMode: (searchMode: SearchMode) =>
        set({ searchMode }, false, "setSearchMode"),
      setDeepResearch: (deepResearch) =>
        set({ deepResearch }, false, "setDeepResearch"),
      setDocuments: (documents: IPreviewFileData[]) =>
        set({ documents }, false, "setDocuments"),
      removeDocuments: () => set({ documents: [] }, false, "removeDocuments"),
    }),
    { name: "MessageStore" }
  )
);

interface AuthState {
  userId: string | null;
  username: string | null;
  email: string | null;
  isAuthenticated: boolean;
  profilePicture: string | null;
  setUser: (
    userId: string,
    userName: string,
    email: string,
    profilePicture: string
  ) => void;
  resetUser: () => void;
  setProfilePicture: (url: string) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      userId: null,
      username: null,
      email: null,
      isAuthenticated: false,
      profilePicture: null,
      setUser: (userId, userName, email, profilePicture) =>
        set(
          {
            userId,
            username: userName,
            email,
            isAuthenticated: true,
            profilePicture,
          },
          false,
          "setUser"
        ),
      resetUser: () =>
        set(
          {
            userId: null,
            username: null,
            email: null,
            isAuthenticated: false,
            profilePicture: null,
          },
          false,
          "resetUser"
        ),
      setProfilePicture: (url: string) =>
        set({ profilePicture: url }, false, "setProfilePicture"),
    }),
    { name: "AuthStore" }
  )
);
