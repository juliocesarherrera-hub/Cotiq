function normalizeHeader(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function findTableColumns(rows) {
  for (const row of rows) {
    const words = [...row.words].sort((first, second) => first.left - second.left);
    const text = normalizeHeader(words.map(({ text: value }) => value).join(' '));
    if (!/(?:cantidad|cant)\b/.test(text)
      || !/(?:descripcion|concepto|partida)\b/.test(text)
      || !/(?:precio|importe|valor)\b/.test(text)) continue;

    const columns = [];
    for (let index = 0; index < words.length; index += 1) {
      const word = normalizeHeader(words[index].text);
      const nextWord = normalizeHeader(words[index + 1]?.text || '');
      let type = '';
      if (/^(?:cantidad|cant\.?|qty)$/.test(word)) type = 'quantity';
      else if (/^(?:descripcion|concepto|partida)$/.test(word)) type = 'concept';
      else if (/^(?:unidad|unit)$/.test(word)) type = 'unit';
      else if (/^(?:(?:valor|precio)\s+unitario|unitario)$/.test(word)
        || (/^(?:valor|precio)$/.test(word) && nextWord === 'unitario')) type = 'unitPrice';
      else if (/^(?:precio|importe|total|valor)$/.test(word)) type = 'amount';
      if (!type || columns.some((column) => column.type === type)) continue;
      columns.push({ type, x: (words[index].left + words[index].right) / 2 });
    }

    if (columns.some(({ type }) => type === 'concept')
      && columns.some(({ type }) => type === 'amount' || type === 'unitPrice')) {
      return columns.sort((first, second) => first.x - second.x);
    }
  }

  return null;
}

function renderWithColumns(words, columns) {
  const cells = columns.map(() => []);
  const boundaries = columns.slice(0, -1).map((column, index) => (column.x + columns[index + 1].x) / 2);

  for (const word of words) {
    const center = (word.left + word.right) / 2;
    let columnIndex = boundaries.findIndex((boundary) => center < boundary);
    if (columnIndex < 0) columnIndex = columns.length - 1;
    cells[columnIndex].push(word);
  }

  return cells
    .map((cell) => cell.sort((first, second) => first.left - second.left).map(({ text }) => text).join(' '))
    .join('\t');
}

function renderWithoutColumns(words) {
  return [...words]
    .sort((first, second) => first.left - second.left)
    .reduce((line, word, index, sortedWords) => {
      if (index === 0) return word.text;
      const previous = sortedWords[index - 1];
      const separator = word.left - previous.right > 32 ? '\t' : ' ';
      return `${line}${separator}${word.text}`;
    }, '');
}

export function formatPositionedRows(rows) {
  const columns = findTableColumns(rows);
  return [...rows]
    .sort((first, second) => second.y - first.y)
    .map(({ words }) => columns ? renderWithColumns(words, columns) : renderWithoutColumns(words))
    .join('\n');
}
