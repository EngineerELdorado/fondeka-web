"use client";

import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { fetchAuthSession } from "aws-amplify/auth";

export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
export const authConfigured = Boolean(
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID &&
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID,
);
let initialized = false;

export function initializeAuth() {
  if (initialized || !authConfigured || typeof window === "undefined") return;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
        userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID!,
        loginWith: { email: true },
        signUpVerificationMethod: "code",
      },
    },
  });
  cognitoUserPoolsTokenProvider.setKeyValueStorage({
    async setItem(key, value) {
      window.sessionStorage.setItem(key, value);
    },
    async getItem(key) {
      return window.sessionStorage.getItem(key);
    },
    async removeItem(key) {
      window.sessionStorage.removeItem(key);
    },
    async clear() {
      Object.keys(window.sessionStorage)
        .filter((key) => key.startsWith("CognitoIdentityServiceProvider."))
        .forEach((key) => window.sessionStorage.removeItem(key));
    },
  });
  initialized = true;
}

export async function accessToken() {
  initializeAuth();
  const session = await fetchAuthSession();
  return session.tokens?.accessToken.toString();
}
