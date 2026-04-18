import { useTranslation } from 'react-i18next';

export const NOTE_NAMES_PT = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];
export const NOTE_NAMES_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const getNoteNamesForLang = (lang) => {
  const code = (lang || 'pt').toLowerCase();
  return code.startsWith('en') ? NOTE_NAMES_EN : NOTE_NAMES_PT;
};

export const useNoteNames = () => {
  const { i18n } = useTranslation();
  return getNoteNamesForLang(i18n.language);
};
