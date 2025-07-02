
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "";


export const API_ENDPOINTS = {
    LOGIN: `${BASE_URL}/login`,
    SIGNUP: `${BASE_URL}/registration`,
    GET_TOKEN: "/get-token",
    SESSION_HISTORY: "/sessions",
    LOGOUT: "/auth/logout",
    REFRESH_TOKEN: "/auth/refresh-token",
    GOOGLE_AUTH: `${BASE_URL}/google-auth`,
    OUTLOOK_AUTH: `${BASE_URL}/microsoft-auth`,
    EXPORT_RESPONSE: `/export-response`,
    QUERY_STREAM: `${BASE_URL}/query-stream`,
    SEND_VERIFICATION_OTP: `${BASE_URL}/send-verification-otp`,
    VERIFY_OTP: `${BASE_URL}/verify-otp`,
    RESET_PASSWORD: `${BASE_URL}/forgot-password/reset`,
    UPDATE_USER_PROFILE: `/user`,
    SEARCH_THREAD: "/filter-with-title",
    SHARED_CONVERSATION: "/public",
    UPDATE_SESSION_ACCESS: "/update-session-access",
    UPLOAD_FILE: "/upload-files",
    PREVIEW_FILE: "/preview_file",
    DELETE_SESSION: "/delete",
    USER_ONBOARDING: "/onboarding",
    STOP_GENERATING_RESPONSE: "/stop-generation",
    STOCK_PREDICTION: `${BASE_URL}/stock-predict`,
    GET_USER_DETAILS:"/get_user_info",
};