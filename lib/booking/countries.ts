export function getCountryLabel(code: string, locale: string, otherLabel: string): string {
  if (code === "OTHER") return otherLabel;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
