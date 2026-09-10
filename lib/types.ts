export interface SystemRequirements {
  os?: string;
  processor?: string;
  memory?: string;
  graphics?: string;
  storage?: string;
}

export interface Game {
  _id: string;
  title: string;
  description: string;
  path: string;
  imageUrl: string;
  mainTag: "Game" | "Software";
  additionalTags: (string | AdditionalTag)[];
  youtubeLink?: string;
  gameImages?: string[];
  systemRequirements?: SystemRequirements;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdditionalTag {
  _id: string;
  name: string;
  belongsTo?: string;
  createdAt?: string;
}

export interface User {
  _id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  subscriptionEndDate?: string;
  isSubscribed: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BankInfo {
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  amount: number;
  currency: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
