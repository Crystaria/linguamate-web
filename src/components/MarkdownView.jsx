import React from 'react';

function renderInline(text, keyPrefix) {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|\[[^\]]+\]\([^)]+\))/g;

  return String(text)
    .split(pattern)
    .filter((part) => part !== '')
    .map((part, index) => {
      const key = `${keyPrefix}-${index}`;

      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={key}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={key} className="px-1 py-0.5 rounded bg-gray-100 text-pink-600 text-[0.9em]">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={key}>{part.slice(1, -1)}</em>;
      }

      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
      if (link) {
        return (
          <a
            key={key}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="text-primary-600 underline"
          >
            {link[1]}
          </a>
        );
      }

      return <React.Fragment key={key}>{part}</React.Fragment>;
    });
}

function tableCells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

const HEADING_CLASS = {
  1: 'text-2xl font-bold text-gray-900',
  2: 'text-xl font-semibold text-gray-900',
  3: 'text-lg font-semibold text-gray-900',
  4: 'text-base font-semibold text-gray-900',
  5: 'text-sm font-semibold text-gray-900',
  6: 'text-sm font-semibold text-gray-700',
};

/**
 * Dependency-free Markdown renderer for the analysis_markdown field.
 * Supports headings, bold/italic/inline code, links, lists, tables,
 * blockquotes, fenced code blocks and horizontal rules.
 */
export default function MarkdownView({ content, className = '' }) {
  const markdown = typeof content === 'string' ? content : '';
  if (!markdown.trim()) return null;

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;
  const nextKey = () => `md-${key++}`;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre key={nextKey()} className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-xs">
          <code data-language={language}>{code.join('\n')}</code>
        </pre>
      );
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}`;
      blocks.push(
        <Tag key={nextKey()} className={HEADING_CLASS[level]}>
          {renderInline(heading[2], nextKey())}
        </Tag>
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quote = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push(
        <blockquote key={nextKey()} className="border-l-4 border-primary-300 pl-4 text-gray-600 italic">
          {renderInline(quote.join(' '), nextKey())}
        </blockquote>
      );
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={nextKey()} className="border-gray-200" />);
      i += 1;
      continue;
    }

    const isTable =
      /^\|.*\|$/.test(trimmed) &&
      i + 1 < lines.length &&
      /^\|?[\s:-]*-{2,}[\s|:-]*\|?$/.test(lines[i + 1].trim());

    if (isTable) {
      const header = tableCells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        rows.push(tableCells(lines[i]));
        i += 1;
      }
      blocks.push(
        <div key={nextKey()} className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                {header.map((cell, index) => (
                  <th key={index} className="border border-gray-200 px-3 py-2 text-left font-semibold">
                    {renderInline(cell, nextKey())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="odd:bg-white even:bg-gray-50">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border border-gray-200 px-3 py-2 align-top">
                      {renderInline(cell, nextKey())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const listMatch = /^([-*+]|\d+\.)\s+/.exec(trimmed);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[1]);
      const items = [];
      while (i < lines.length) {
        const item = /^([-*+]|\d+\.)\s+(.*)$/.exec(lines[i].trim());
        if (!item || /\d+\./.test(item[1]) !== ordered) break;
        items.push(item[2]);
        i += 1;
      }
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag
          key={nextKey()}
          className={`${ordered ? 'list-decimal' : 'list-disc'} pl-6 space-y-1 text-gray-700`}
        >
          {items.map((item, index) => (
            <li key={index}>{renderInline(item, nextKey())}</li>
          ))}
        </ListTag>
      );
      continue;
    }

    const paragraph = [];
    while (i < lines.length) {
      const current = lines[i].trim();
      const startsBlock =
        !current ||
        current.startsWith('```') ||
        /^#{1,6}\s+/.test(current) ||
        current.startsWith('>') ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(current) ||
        /^([-*+]|\d+\.)\s+/.test(current) ||
        /^\|.*\|$/.test(current);

      if (startsBlock) break;
      paragraph.push(current);
      i += 1;
    }

    if (paragraph.length) {
      blocks.push(
        <p key={nextKey()} className="text-gray-700 leading-relaxed">
          {renderInline(paragraph.join(' '), nextKey())}
        </p>
      );
    }
  }

  return <div className={`space-y-3 ${className}`}>{blocks}</div>;
}

