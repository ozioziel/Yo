import type { ReactNode } from 'react';
import { Fragment } from 'react';

/**
 * Tiny Markdown renderer for a GitHub profile README: headings, paragraphs, lists,
 * quotes, rules, emphasis, code, links and (badge) images. Raw HTML is dropped and
 * nothing is injected as HTML, so the content cannot run scripts.
 */
const SAFE_URL = /^(https?:|mailto:)/i;

function inline(text: string, key = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  // linked image | image | link | bold | italic | code | bare url
  const re = /\[!\[([^\]]*)\]\(([^)\s]+)\)\]\(([^)\s]+)\)|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[1] !== undefined) {
      out.push(SAFE_URL.test(m[3]) ? (
        <a key={k} href={m[3]} target="_blank" rel="noreferrer" className="md-badge-link">
          <img src={m[2]} alt={m[1]} loading="lazy" />
        </a>
      ) : m[1]);
    } else if (m[4] !== undefined) {
      out.push(SAFE_URL.test(m[5]) ? <img key={k} src={m[5]} alt={m[4]} loading="lazy" className="md-badge" /> : m[4]);
    } else if (m[6] !== undefined) {
      out.push(SAFE_URL.test(m[7]) ? (
        <a key={k} href={m[7]} target="_blank" rel="noreferrer">
          {inline(m[6], k)}
        </a>
      ) : m[6]);
    } else if (m[8] !== undefined) out.push(<strong key={k}>{inline(m[8], k)}</strong>);
    else if (m[9] !== undefined) out.push(<em key={k}>{inline(m[9], k)}</em>);
    else if (m[10] !== undefined) out.push(<code key={k}>{m[10]}</code>);
    else if (m[11] !== undefined) {
      out.push(
        <a key={k} href={m[11]} target="_blank" rel="noreferrer">
          {m[11].replace(/^https?:\/\/(www\.)?/, '')}
        </a>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  const flush = () => {
    const k = blocks.length;
    if (para.length) {
      const onlyImages = para.every(l => /^\s*(\[?!\[)/.test(l));
      blocks.push(
        <p key={`p${k}`} className={onlyImages ? 'md-badges' : undefined}>
          {para.map((l, i) => (
            <Fragment key={i}>
              {inline(l, `p${k}-${i}`)}
              {i < para.length - 1 && (onlyImages ? ' ' : <br />)}
            </Fragment>
          ))}
        </p>,
      );
      para = [];
    }
    if (list.length) {
      blocks.push(
        <ul key={`u${k}`}>
          {list.map((l, i) => (
            <li key={i}>{inline(l, `u${k}-${i}`)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
    if (quote.length) {
      blocks.push(<blockquote key={`q${k}`}>{inline(quote.join(' '), `q${k}`)}</blockquote>);
      quote = [];
    }
  };
  for (const raw of lines) {
    const line = raw.replace(/<\/?[a-z][^>]*>/gi, '').trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = Math.min(4, h[1].length + 1);
      const Tag = `h${level}` as 'h2' | 'h3' | 'h4';
      blocks.push(<Tag key={`h${blocks.length}`}>{inline(h[2], `h${blocks.length}`)}</Tag>);
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      flush();
      blocks.push(<hr key={`r${blocks.length}`} />);
      continue;
    }
    const li = /^\s*[-*]\s+(.*)$/.exec(line);
    if (li) {
      if (para.length) flush();
      list.push(li[1]);
      continue;
    }
    const q = /^>\s?(.*)$/.exec(line);
    if (q) {
      if (para.length || list.length) flush();
      quote.push(q[1]);
      continue;
    }
    if (list.length) flush();
    para.push(line.trim());
  }
  flush();
  return <div className="md">{blocks}</div>;
}
