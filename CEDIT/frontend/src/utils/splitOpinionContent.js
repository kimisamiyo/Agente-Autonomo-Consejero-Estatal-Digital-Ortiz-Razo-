/** Secciones estructuradas que van al panel del header, no al chat. */
const PANEL_HEADING =
  /^##\s*(avance del expediente|lo que ya sabemos|para alimentar|datos críticos)/i;

/**
 * Separa la opinión del mentor: parte conversacional (chat) vs checklist/PDF (panel).
 * @returns {{ chat: string, panel: string }}
 */
export function splitOpinionContent(opinion = '') {
  const text = (opinion || '').trim();
  if (!text) return { chat: '', panel: '' };

  const lines = text.split('\n');
  let splitAt = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (PANEL_HEADING.test(lines[i].trim())) {
      splitAt = i;
      break;
    }
  }

  if (splitAt >= lines.length) {
    return { chat: text, panel: '' };
  }

  const chat = lines.slice(0, splitAt).join('\n').trim();
  const panel = lines.slice(splitAt).join('\n').trim();
  return { chat: chat || text, panel };
}

/** Une bloques del panel (opinión estructurada + sección PDF del contenido completo). */
export function buildMentorPanelMarkdown(opinion = '', fullContent = '', content = '') {
  const { panel: fromOpinion } = splitOpinionContent(opinion);
  const follow = getFollowUpFromContent(fullContent || content);
  const parts = [fromOpinion, follow].filter(Boolean);
  return parts.join('\n\n').trim();
}

function getFollowUpFromContent(text) {
  if (!text || !text.toLowerCase().includes('para alimentar')) return '';
  const part = text.split(/## Para alimentar/i)[1];
  return part ? `## Para alimentar${part}`.trim() : '';
}
