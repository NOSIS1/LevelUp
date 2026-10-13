export type WordCsvRow = {
  word: string;
  translation: string;
  definition?: string;
  example?: string;
  partOfSpeech?: string;
  tags?: string[];
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      result.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }
  result.push(value.trim());
  return result;
}

export function parseWordsCsv(csv: string): WordCsvRow[] {
  if (csv.length > 2_000_000) throw new Error('CSV file exceeds the 2 MB limit');
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  if (lines.length > 5001) throw new Error('CSV can contain at most 5000 words per import');
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const required = ['word', 'translation'];
  if (required.some((header) => !headers.includes(header))) {
    throw new Error('CSV must contain word and translation columns');
  }
  const indexOf = (header: string) => headers.indexOf(header);
  return lines.slice(1).map((line, rowIndex) => {
    const cells = parseCsvLine(line);
    const word = cells[indexOf('word')]?.trim();
    const translation = cells[indexOf('translation')]?.trim();
    if (!word || !translation) throw new Error(`CSV row ${rowIndex + 2} has empty word or translation`);
    const tags = indexOf('tags') >= 0 ? cells[indexOf('tags')]?.split('|').map((tag) => tag.trim()).filter(Boolean) : undefined;
    return {
      word,
      translation,
      definition: indexOf('definition') >= 0 ? cells[indexOf('definition')] : undefined,
      example: indexOf('example') >= 0 ? cells[indexOf('example')] : undefined,
      partOfSpeech: indexOf('partofspeech') >= 0 ? cells[indexOf('partofspeech')] : undefined,
      tags,
    };
  });
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function wordsToCsv(rows: WordCsvRow[]): string {
  const header = 'word,translation,definition,example,partOfSpeech,tags';
  return [header, ...rows.map((row) => [row.word, row.translation, row.definition || '', row.example || '', row.partOfSpeech || '', (row.tags || []).join('|')].map(escapeCsv).join(','))].join('\r\n');
}
