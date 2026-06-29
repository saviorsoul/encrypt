export function shortPrivateKeyFileName(fileName: string): string {
  if (fileName.length <= 12) {
    return fileName;
  }
  return `${fileName.slice(0, 12)}…`;
}
