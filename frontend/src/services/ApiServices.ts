import axios from "axios";
import { API_ENDPOINTS } from "./endpoints";
import { axiosInstance } from "./axiosInstance";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "";
class ApiServices {
  async login(username: string, password: string): Promise<any> {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);
    const response = await axios.post(API_ENDPOINTS.LOGIN, formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return response;
  }
  async signup(
    fullName: string,
    email: string,
    // phone: string,
    password: string
  ): Promise<any> {
    const response = await axios.post(
      API_ENDPOINTS.SIGNUP,
      {
        full_name: fullName,
        email,
        // phone,
        password,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return response;
  }

  async getSessionHistory(userId: string): Promise<any> {
    const response = await axiosInstance.get(
      `${API_ENDPOINTS.SESSION_HISTORY}/${userId}`
    );
    return response;
  }

  async getSessionTitle(userId: string, input: string): Promise<any> {
    const response = await axiosInstance.get(
      `${API_ENDPOINTS.SEARCH_THREAD}/${userId}/search?keyword=${input}`
    );
    return response;
  }

  async updatePublicSession(
    sessionId: string,
    userId: string,
    access = "public"
  ) {
    const response = await axiosInstance.put(
      API_ENDPOINTS.UPDATE_SESSION_ACCESS,
      {
        session_id: sessionId,
        user_id: userId,
        access_level: access,
      }
    );

    return response;
  }

  async getSharedCoversationData(sessionId: string) {
    const response = await axios.get(
      `${BASE_URL}${API_ENDPOINTS.SHARED_CONVERSATION}/${sessionId}`
    );
    return response;
  }

  async exportResponse(messageId: string, format: string) {
    try {
      const response = await axiosInstance.post(API_ENDPOINTS.EXPORT_RESPONSE, {
        message_id: messageId,
        format,
      });
      return response.data;
    } catch (error) {
      console.error("error in exprt response api", error);
      throw error;
    }
  }

  async uploadFiles(userId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file); // ✅ Must match the 'file' field in curl

    const response = await axiosInstance.post(
      `${API_ENDPOINTS.UPLOAD_FILE}?user_id=${userId}`, // ✅ Put user_id in query string like curl
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data", // optional — axios sets this automatically when using FormData
        },
      }
    );

    return response;
  }

  async handlePreviewFile(fileId: string): Promise<any> {
    try {
      const response = await axiosInstance.get(
        `${API_ENDPOINTS.PREVIEW_FILE}/${fileId}`,
        {
          responseType: "blob", // Ensure the response is treated as a blob
        }
      );
      // Create a URL for the blob
      const blob = response.data; // already a valid Blob with correct MIME type
      const url = URL.createObjectURL(blob);
      return url;
    } catch (error) {
      console.error("Error fetching file preview:", error);
      throw error;
    }
  }

  async handleSessionDelete(sessionId: string) {
    try {
      const response = await axiosInstance.delete(
        `${API_ENDPOINTS.DELETE_SESSION}/${sessionId}`
      );
      return response.data;
    } catch (error) {
      console.error("Error deleting session:", error);
      throw error;
    }
  }

  async handleOnboardingQuestion(userId: string, onBoardingData: any) {
    try {
      const response = await axiosInstance.post(
        `${API_ENDPOINTS.USER_ONBOARDING}/${userId}`,
        {
          ...onBoardingData,
        }
      );
      return response;
    } catch (error) {
      console.error("Error in onboarding", error);
      throw error;
    }
  }

  async handleStopGeneratingResponse(
    sessionId: string,
    messageId: string
  ): Promise<any> {
    try {
      const response = await axiosInstance.post(
        `${API_ENDPOINTS.STOP_GENERATING_RESPONSE}?session_id=${sessionId}&message_id=${messageId}`
      );
      return response;
    } catch (error) {
      console.error("Error stopping response generation:", error);
      throw error;
    }
  }

  async getStockPredictionData(
    ticker: string,
    symbol: string,
    messageId: string
  ): Promise<any> {
    const data = {
      ticker: ticker,
      exchange_symbol: symbol,
      message_id: messageId,
    };
    try {
      const response = await axiosInstance.post(
        `${API_ENDPOINTS.STOCK_PREDICTION}`,
        data
      );
      return response;
    } catch (error) {
      console.error("Error fetching stock prediction:", error);
      throw error;
    }
  }

  async handleAccountDelete(userId: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(`user/${userId}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting account:", error);
      throw error;
    }
  }

  async getUserDetails(id: number): Promise<any> {
    try {
      const response = await axiosInstance.get(
        `${API_ENDPOINTS.GET_USER_DETAILS}?user_id=${id}`
      );
      return response;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}

export default new ApiServices();
