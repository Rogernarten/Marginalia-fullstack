"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { connect } from "@/lib/storage";

/** Points the saved-data store at whoever is signed in, or no one. Renders nothing. */
export function SavedSync() {
  const { isLoaded, userId, getToken } = useAuth();
  useEffect(() => {
    if (isLoaded) void connect(userId ?? null, () => getToken());
  }, [isLoaded, userId, getToken]);
  return null;
}
