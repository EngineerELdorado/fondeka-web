"use client";

import { api } from "./api";
import { demoMode } from "./auth";
import { demoRequest } from "./demo";
import { normalizePageResponse } from "./page-response";

export async function request<T>(path: string, init?: RequestInit) {
  const response = await (demoMode ? demoRequest<T>(path, init) : api<T>(path, init));
  return normalizePageResponse(response);
}
