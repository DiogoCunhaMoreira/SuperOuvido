const PT_PROMPT = (formattedNotes) => `NOTAS TOCADAS: ${formattedNotes}

## Identificação Harmónica
Identifica que acorde ou acordes estas notas podem formar. Se as notas não formarem um acorde convencional, explica que tipo de sonoridade criam (cluster, intervalo dissonante, etc.).

## Análise Intervalar
Descreve os intervalos presentes entre as diferentes notas e o que estes intervalos contribuem para a sonoridade geral.

## Contexto Tonal
Explica em que tonalidades ou escalas estas notas fazem mais sentido. Menciona se sugerem um modo específico ou se têm uma função harmónica particular em determinadas tonalidades.

## Carácter Sonoro
Descreve o carácter emocional e a qualidade sonora desta combinação de notas - se é consonante ou dissonante, estável ou instável, e que tipo de atmosfera musical cria.

## Aplicações Musicais
Fornece exemplos de como estas notas são tipicamente usadas em diferentes estilos musicais e sugere possíveis resoluções ou desenvolvimentos harmónicos.

INSTRUÇÕES CRÍTICAS:
- Responde DIRETAMENTE com a análise sem introduções como "Claro", "Com certeza", "Vamos analisar", etc.
- USA APENAS português de Portugal (não do Brasil)
- NÃO uses listas com bullet points ou hífens
- Escreve SEMPRE em parágrafos completos e fluidos
- Formata em markdown mantendo os títulos das secções exactamente como estão acima`;

const EN_PROMPT = (formattedNotes) => `NOTES PLAYED: ${formattedNotes}

## Harmonic Identification
Identify which chord or chords these notes can form. If the notes do not form a conventional chord, explain what kind of sonority they create (cluster, dissonant interval, etc.).

## Interval Analysis
Describe the intervals present between the different notes and what these intervals contribute to the overall sonority.

## Tonal Context
Explain in which keys or scales these notes make the most sense. Mention whether they suggest a specific mode or have a particular harmonic function in certain keys.

## Sonic Character
Describe the emotional character and sonic quality of this combination of notes — whether it is consonant or dissonant, stable or unstable, and what kind of musical atmosphere it creates.

## Musical Applications
Provide examples of how these notes are typically used across different musical styles and suggest possible resolutions or harmonic developments.

CRITICAL INSTRUCTIONS:
- Respond DIRECTLY with the analysis without introductions like "Sure", "Of course", "Let's analyze", etc.
- Respond ONLY in English
- Do NOT use bullet-point or hyphen lists
- ALWAYS write in complete, flowing paragraphs
- Format in markdown, keeping the section titles exactly as they appear above`;

export const buildAnalysisPrompt = (formattedNotes, lang) => {
  const code = (lang || 'pt').toLowerCase();
  if (code.startsWith('en')) return EN_PROMPT(formattedNotes);
  return PT_PROMPT(formattedNotes);
};
