// Standard rendered-markdown surface — the same prose className wrap +
// ReactMarkdown invocation that strategy-view and matchups-view both
// used inline. GFM enabled (tables, task lists, strikethrough).

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface Props {
    source: string;
    className?: string;
}

const PROSE_CLASSES =
    'prose prose-sm max-w-none dark:prose-invert ' +
    'prose-headings:scroll-mt-4 prose-table:my-4 ' +
    'prose-th:bg-muted prose-th:px-2 prose-th:py-1 ' +
    'prose-td:px-2 prose-td:py-1 ' +
    'prose-td:border prose-th:border prose-table:border-collapse';

export function MarkdownArticle({ source, className }: Props) {
    return (
        <article className={cn(PROSE_CLASSES, className)}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
        </article>
    );
}
