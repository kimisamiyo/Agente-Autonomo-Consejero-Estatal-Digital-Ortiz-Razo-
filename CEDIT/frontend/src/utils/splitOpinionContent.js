/** Secciones estructuradas que van al panel del header, no al chat. */
const PANEL_HEADING =
  /^##\s*(avance del expediente|lo que ya sabemos|datos críticos)/i;

/**
 * Separa la opinión del mentor: parte conversacional (chat) vs checklist (panel).
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
    return { chat: stripParaAlimentar(text), panel: '' };
  }

  const chat = stripParaAlimentar(lines.slice(0, splitAt).join('\n').trim());
  const panel = stripParaAlimentar(lines.slice(splitAt).join('\n').trim());
  return { chat: chat || stripParaAlimentar(text), panel };
}

/** Une bloques del panel (sin la sección "Para alimentar"). */
export function buildMentorPanelMarkdown(opinion = '') {
  const { panel: fromOpinion } = splitOpinionContent(opinion);
  return stripParaAlimentar(fromOpinion).trim();
}

function stripParaAlimentar(text = '') {
  if (!text) return '';
  return text
    .replace(/^##\s*Para alimentar[\s\S]*?(?=\n##\s|$)/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
