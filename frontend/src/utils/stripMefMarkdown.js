/** Quita el bloque de índice MEF duplicado cuando ya se muestra MefScoreCard. */
export function stripMefIndexMarkdown(text) {
  if (!text) return text;
  const parts = text.split(/##\s*Índice de aprobación MEF/i);
  if (parts.length <= 1) return text;
  return parts[0].trim();
}
