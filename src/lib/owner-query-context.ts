"use client";
import { createContext } from "react";
/** A retained owner subtree may stay mounted during a refresh, but cannot start reads. */
export const OwnerQueriesEnabled = createContext(true);
