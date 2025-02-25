export function saveFileFromText(content: string, name: string, type?: string): void {
  const blob = new Blob([content], { type: type || "text/plain" });

  const a = document.createElement("a");
  a.download = name;
  a.href = window.URL.createObjectURL(blob);
  a.click();
}

export function saveFileFromURL(url: string, name: string): void {
  const a = document.createElement("a");
  a.download = name;
  a.href = url;
  a.click();
}
