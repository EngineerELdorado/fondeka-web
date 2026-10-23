"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { toolLinkDestination } from "@/lib/business-tools-ui";
import { useToolNavigation } from "./business-tools-provider";

/** Tool selection reuses current account access, including keyboard-activated links. */
export function BusinessToolLink({ href, onClick, ...props }: ComponentProps<typeof Link>) {
  const navigation = useToolNavigation();
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          props.target === "_blank" ||
          typeof href !== "string"
        )
          return;
        const destination = toolLinkDestination(href);
        if (destination && (navigation.enabled || destination === "/pos")) {
          event.preventDefault();
          navigation.open(destination);
        }
      }}
    />
  );
}
