export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "Not Specified";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);

  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr.`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} Lakh`;
  if (num >= 1000) return `₹${num.toLocaleString("en-IN")}`;
  return `₹${num}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function daysLeft(closingDate: string): number {
  const now = new Date();
  const closing = new Date(closingDate);
  const diff = closing.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
