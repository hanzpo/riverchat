/**
 * Shared copy-to-clipboard helper.
 *
 * Resolves to `true` on success and `false` on failure so callers can
 * surface their own success/error UX (toast, inline label, etc.).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
