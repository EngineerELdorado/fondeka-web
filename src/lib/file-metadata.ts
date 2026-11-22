export type FileMetadata = {
  fileName?: string | null;
  contentType?: string | null;
  /** Bytes, as returned by training resources or the successfully uploaded File. */
  fileSize?: number | null;
};

export function fileFormat(metadata: FileMetadata, assetKey?: string | null) {
  const extension =
    /\.([a-z0-9]{1,12})$/i.exec(
      typeof metadata.fileName === "string" ? metadata.fileName.trim() : "",
    )?.[1] || /\.([a-z0-9]{1,12})$/i.exec(assetKey || "")?.[1];
  if (extension) return extension.toUpperCase();
  const type =
    typeof metadata.contentType === "string"
      ? metadata.contentType.split(";")[0].trim().toLowerCase()
      : undefined;
  if (!type || type === "application/octet-stream") return undefined;
  return (
    (
      {
        "application/pdf": "PDF",
        "application/epub+zip": "EPUB",
        "text/plain": "TXT",
        "application/msword": "DOC",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
        "application/vnd.ms-excel": "XLS",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
        "application/vnd.ms-powerpoint": "PPT",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
        "application/zip": "ZIP",
        "audio/mpeg": "MP3",
        "audio/mp4": "M4A",
        "video/mp4": "MP4",
        "video/quicktime": "MOV",
        "image/jpeg": "JPG",
        "image/png": "PNG",
        "image/webp": "WEBP",
      } as Record<string, string>
    )[type] || type
  );
}

export function fileSizeLabel(bytes?: number | null, language = "en") {
  if (!Number.isSafeInteger(bytes) || bytes! <= 0) return undefined;
  const units = language === "fr" ? ["o", "Kio", "Mio", "Gio"] : ["B", "KiB", "MiB", "GiB"];
  const index = Math.min(Math.floor(Math.log(bytes!) / Math.log(1024)), units.length - 1);
  return `${new Intl.NumberFormat(language, { maximumFractionDigits: index ? 2 : 0 }).format(bytes! / 1024 ** index)} ${units[index]}`;
}
