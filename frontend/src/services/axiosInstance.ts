import { getCookie } from '@/utils/getCookie';
import axios, { AxiosInstance } from 'axios';
import Cookies from "js-cookie"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "";

export const axiosInstance: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 100000,
    headers: {
        "Content-Type": "application/json"
    }
});


axiosInstance.interceptors.request.use( async (config) => {
    const token = getCookie("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } 
    
    else {
        window.location.href = "/login";
        localStorage.clear();
        return Promise.reject(new Error("No token found"));
    }
    return config;
  });
  
  axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.error('Unauthorized! Redirecting to login...');
        window.location.href = "/login";
        localStorage.clear();
      }
      return Promise.reject(error);
    }
  );