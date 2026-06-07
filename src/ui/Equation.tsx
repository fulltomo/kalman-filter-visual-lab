import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export function Equation({ latex }: { latex: string }) {
  const html = useMemo(() => {
    if (!latex) return '';
    try {
      return katex.renderToString(latex, { throwOnError: false, displayMode: true });
    } catch {
      return latex;
    }
  }, [latex]);
  return <div className="equation" dangerouslySetInnerHTML={{ __html: html }} />;
}
