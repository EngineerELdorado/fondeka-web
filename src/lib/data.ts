"use client";

import { api } from "./api";
import { demoMode } from "./auth";
import { demoRequest } from "./demo";

export function request<T>(path: string, init?: RequestInit) {
  return demoMode ? demoRequest<T>(path, init) : api<T>(path, init);
}
