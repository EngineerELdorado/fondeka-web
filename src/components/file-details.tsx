"use client";
import { FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { fileFormat, fileSizeLabel, type FileMetadata } from "@/lib/file-metadata";

export function FileDetails({
  metadata,
  assetKey,
  compact = false,
}: {
  metadata: FileMetadata;
  assetKey?: string | null;
  compact?: boolean;
}) {
  const { t, language } = useI18n();
  const name =
    (typeof metadata.fileName === "string" ? metadata.fileName.trim() : "") ||
    t("Uploaded file", "Fichier importé");
  const format = fileFormat(metadata, assetKey);
  const size = fileSizeLabel(metadata.fileSize, language);
  return (
    <span className={`file-details${compact ? " file-details--compact" : ""}`}>
      {!compact && <FileText size={25} aria-hidden="true" />}
      <span className="file-details-copy">
        <strong title={name}>{name}</strong>
        {(format || size) && <small>{[format, size].filter(Boolean).join(" · ")}</small>}
      </span>
    </span>
  );
}
