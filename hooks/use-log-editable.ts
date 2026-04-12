"use client";

import { useMemo } from "react";

const LOCK_MS = 24 * 60 * 60 * 1000;

export function useLogEditable(createdAt: string, isLocked: boolean) {
  return useMemo(() => {
    if (isLocked) return false;
    const created = new Date(createdAt).getTime();
    if (Number.isNaN(created)) return false;
    return Date.now() < created + LOCK_MS;
  }, [createdAt, isLocked]);
}
