import { axiosInstance } from "@/services/axiosInstance";
import { useAuthStore } from "@/store/useZustandStore";
import Cookies from "js-cookie";
import { getCookie } from "./getCookie";
import ApiServices from "@/services/ApiServices";

export const verifyToken = async (): Promise<boolean> => {
  try {
    // Check if we already have a user in the store
    const authStore = useAuthStore.getState();
    if (authStore.isAuthenticated && authStore.userId) {
      return true;
    }

    // Get token from localStorage
    const accessToken = getCookie("access_token");
    if (!accessToken) {
      return false;
    }

    // Verify token with API
    const response = await axiosInstance.get("/get-token");

    const data = response.data;
    localStorage.setItem("user_id", data._id);

    const user = await ApiServices.getUserDetails(data._id).then(
      (res) => res.data
    );
    // Update the auth store with user data
    useAuthStore
      .getState()
      .setUser(data._id, data.full_name, data.email, user.profile_picture);
    return true;
  } catch (error) {
    console.error("Token verification failed:", error);
    return false;
  }
};

export const logout = () => {
  localStorage.removeItem("access_token");
  useAuthStore.getState().resetUser();
  Cookies.remove("access_token");
  window.location.href = "/login";
};
