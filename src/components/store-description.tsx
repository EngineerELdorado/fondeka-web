"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Modal } from "./ui";

export function StoreDescription({ description }: { description: string }) {
  const { t } = useI18n();
  const text = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const element = text.current;
    if (!element) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      setOverflowing(element.scrollHeight > element.clientHeight + 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    void document.fonts.ready.then(measure);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [description]);

  return (
    <>
      <div className="store-profile-description">
        <p ref={text} className="clamped">
          {description}
        </p>
        {(overflowing || open) && (
          <button
            type="button"
            className="text-button"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          >
            {t("Read more", "Lire la suite")}
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      {open && (
        <Modal
          title={t("Store description", "Description de la boutique")}
          onClose={() => setOpen(false)}
        >
          <p className="store-description-full">{description}</p>
        </Modal>
      )}
    </>
  );
}
