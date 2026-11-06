import { Fragment, type ReactNode } from "react";

/**
 * Safe, dependency-free Markdown subset for Studio news.
 * This parser renders text through React (never innerHTML), so pasted HTML
 * and unsafe links are not executed. The same component is used in the
 * public article and in the editorial preview.
 */
const inlinePattern = /\\([\\\x60*_{}\[\]()#+.!>-])|\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*(\S(?:[^\n]*?\S)?)\*\*|__(\S(?:[^\n]*?\S)?)__|\*(\S(?:[^*\n]*?\S)?)\*|_(\S(?:[^_\n]*?\S)?)_|\x60([^\x60\n]+)\x60/g;
const headingPattern = /^ {0,3}(#{1,4})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const unorderedPattern = /^ {0,3}[-*+][ \t]+(.+)$/;
const orderedPattern = /^ {0,3}\d+[.)][ \t]+(.+)$/;
const quotePattern = /^ {0,3}>[ \t]?(.*)$/;
const rulePattern = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/;

function safeLink(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let consumed = 0;
  let index = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const offset = match.index ?? 0;
    if (offset > consumed) parts.push(text.slice(consumed, offset));
    const key = index++;
    if (match[1] !== undefined) {
      parts.push(match[1]); // Escaped Markdown punctuation.
    } else if (match[2] !== undefined) {
      const href = safeLink(match[3]);
      parts.push(href
        ? <a key={key} href={href} target="_blank" rel="noopener noreferrer">{inline(match[2])}</a>
        : match[0]);
    } else if (match[4] !== undefined || match[5] !== undefined) {
      parts.push(<strong key={key}>{inline(match[4] ?? match[5])}</strong>);
    } else if (match[6] !== undefined || match[7] !== undefined) {
      parts.push(<em key={key}>{inline(match[6] ?? match[7])}</em>);
    } else if (match[8] !== undefined) {
      parts.push(<code key={key}>{match[8]}</code>);
    }
    consumed = offset + match[0].length;
  }
  if (consumed < text.length) parts.push(text.slice(consumed));
  return parts;
}

function paragraph(lines: string[], key: number): ReactNode {
  return <p key={key}>{lines.map((line, index) =>
    <Fragment key={index}>{index ? <br /> : null}{inline(line)}</Fragment>
  )}</p>;
}

export default function NewsMarkdown({ source }: { source: string }) {
  const lines = (source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const output: ReactNode[] = [];
  let index = 0;
  let key = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }

    const heading = headingPattern.exec(line);
    if (heading) {
      const contents = inline(heading[2]);
      // h1 is reserved for the article title, supplied outside this body.
      const level = heading[1].length;
      if (level === 1) output.push(<h2 key={key++}>{contents}</h2>);
      else if (level === 2) output.push(<h3 key={key++}>{contents}</h3>);
      else output.push(<h4 key={key++}>{contents}</h4>);
      index++;
      continue;
    }

    if (rulePattern.test(line)) {
      output.push(<hr key={key++} />);
      index++;
      continue;
    }

    const unordered = unorderedPattern.exec(line);
    const ordered = orderedPattern.exec(line);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const item = (isOrdered ? orderedPattern : unorderedPattern).exec(lines[index]);
        if (!item) break;
        items.push(<li key={items.length}>{inline(item[1])}</li>);
        index++;
      }
      output.push(isOrdered ? <ol key={key++}>{items}</ol> : <ul key={key++}>{items}</ul>);
      continue;
    }

    if (quotePattern.test(line)) {
      const quote: string[] = [];
      while (index < lines.length) {
        const item = quotePattern.exec(lines[index]);
        if (!item) break;
        quote.push(item[1]);
        index++;
      }
      output.push(<blockquote key={key++}>{paragraph(quote, 0)}</blockquote>);
      continue;
    }

    const textLines: string[] = [];
    while (index < lines.length && lines[index].trim()) {
      if (textLines.length && (headingPattern.test(lines[index]) ||
        rulePattern.test(lines[index]) || unorderedPattern.test(lines[index]) ||
        orderedPattern.test(lines[index]) || quotePattern.test(lines[index]))) break;
      textLines.push(lines[index]);
      index++;
    }
    output.push(paragraph(textLines, key++));
  }
  return <>{output}</>;
}
