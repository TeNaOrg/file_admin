import axios, {AxiosInstance, AxiosRequestConfig} from "axios";
import Cookies from "js-cookie";
import {SystemRequirements} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://202.180.218.186:9000/";

// Utility function to get full image URL
export const getImageUrl = (imagePath: string): string => {
  if (!imagePath) return "";

  // If it's already a full URL, return as is
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // If it starts with /, it's a relative path from the server
  if (imagePath.startsWith("/")) {
    return `${API_BASE_URL.replace(/\/$/, "")}${imagePath}`;
  }

  // Otherwise, assume it's a relative path and add /uploads/
  return `${API_BASE_URL.replace(/\/$/, "")}/uploads/${imagePath}`;
};

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = Cookies.get("admin_token");
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Skip the login request itself: a 401 there just means wrong
        // credentials (handled inline by the login form) — it must not
        // trigger a hard redirect back to the page it was submitted from.
        const isLoginRequest = error.config?.url === "/auth/login";
        if (error.response?.status === 401 && !isLoginRequest) {
          // Clear token and redirect to login
          Cookies.remove("admin_token");
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth methods
  async login(username: string, password: string) {
    const response = await this.client.post("/auth/login", {
      username,
      password,
    });
    return response.data;
  }

  // Games methods
  async getGames() {
    const response = await this.client.get("/admin/games/game");
    // Map _id to id for frontend compatibility
    const games = response.data;
    if (Array.isArray(games)) {
      return games.map((game) => ({
        ...game,
        id: game._id || game.id,
        additionalTags: (game.additionalTags || []).filter(
          (tag: any) => tag !== null && tag !== undefined
        ),
      }));
    }
    return games;
  }

  async createGame(gameData: {
    title: string;
    description: string;
    path: string;
    imageUrl: string;
    mainTag: string;
    additionalTags: string[];
    youtubeLink?: string;
    gameImages?: string[];
    systemRequirements?: SystemRequirements;
  }) {
    const response = await this.client.post("/admin/games/game", gameData);
    return response.data;
  }

  async updateGame(gameData: {
    id: string;
    title: string;
    description: string;
    path: string;
    imageUrl: string;
    mainTag: string;
    additionalTags: string[];
    youtubeLink?: string;
    gameImages?: string[];
    systemRequirements?: SystemRequirements;
  }) {
    const response = await this.client.put("/admin/games/game", gameData);
    return response.data;
  }

  async deleteGame(id: string) {
    const response = await this.client.delete("/admin/games/game", {
      data: {id},
    });
    return response.data;
  }

  // Additional Tags methods
  async getAdditionalTags() {
    const response = await this.client.get("/admin/games/additional_tags");
    // Map _id to id for frontend compatibility
    const tags = response.data;
    if (Array.isArray(tags)) {
      return tags.map((tag) => ({
        ...tag,
        id: tag._id || tag.id,
      }));
    }
    return tags;
  }

  async createAdditionalTag(name: string, belongsTo: string = "Game") {
    const response = await this.client.post("/admin/games/additional_tags", {
      name,
      belongsTo,
    });
    return response.data;
  }

  async deleteAdditionalTag(id: string) {
    const response = await this.client.delete("/admin/games/additional_tags", {
      data: {id},
    });
    return response.data;
  }

  // Users methods
  async getUsers() {
    const response = await this.client.get("/admin/user");
    // Map _id to id for frontend compatibility
    const users = response.data;
    if (Array.isArray(users)) {
      return users.map((user) => ({
        ...user,
        id: user._id || user.id,
      }));
    }
    return users;
  }

  async setSubscription(userId: string, isSubscribed: boolean) {
    const requestData = {
      id: userId, // Using 'id' as the field name
      isSubscribed,
    };
    console.log("Sending subscription request:", requestData);
    const response = await this.client.put(
      "/admin/user/set_subscription",
      requestData
    );
    return response.data;
  }

  // Bank info methods
  async getBankInfo() {
    const response = await this.client.get("/admin/bank-info");
    return response.data;
  }

  async updateBankInfo(bankInfo: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    amount: number;
    currency: string;
  }) {
    const response = await this.client.put("/admin/bank-info", bankInfo);
    return response.data;
  }

  // Game archive (chunked) upload methods
  async initGameUpload(originalFilename: string, totalSize: number) {
    const response = await this.client.post(
      "/admin/games/upload/archive/init",
      {originalFilename, totalSize}
    );
    return response.data;
  }

  async uploadGameUploadChunk(
    uploadId: string,
    offset: number,
    chunk: Blob,
    onUploadProgress?: (loaded: number) => void
  ) {
    const response = await this.client.put(
      `/admin/games/upload/archive/${uploadId}/chunk`,
      chunk,
      {
        params: {offset},
        headers: {"Content-Type": "application/octet-stream"},
        timeout: 120000,
        onUploadProgress: onUploadProgress
          ? (event) => onUploadProgress(event.loaded)
          : undefined,
      }
    );
    return response.data;
  }

  async getGameUploadStatus(uploadId: string) {
    const response = await this.client.get(
      `/admin/games/upload/archive/${uploadId}/status`
    );
    return response.data;
  }

  async completeGameUpload(uploadId: string) {
    const response = await this.client.post(
      `/admin/games/upload/archive/${uploadId}/complete`
    );
    return response.data;
  }

  async cancelGameUpload(uploadId: string) {
    const response = await this.client.delete(
      `/admin/games/upload/archive/${uploadId}`
    );
    return response.data;
  }

  // Image upload method
  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await this.client.post(
      "/admin/games/upload/picture",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
