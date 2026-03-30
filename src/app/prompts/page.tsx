"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

export default function PromptsPage() {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/prompts-content")
      .then((r) => r.json())
      .then((d) => { setContent(d.content || ""); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-20 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="max-w-4xl">
      <div className="prose prose-sm prose-neutral max-w-none
        prose-headings:font-bold prose-headings:text-foreground
        prose-h1:text-2xl prose-h1:mb-4
        prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b
        prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
        prose-p:text-sm prose-p:leading-relaxed prose-p:text-foreground
        prose-li:text-sm prose-li:text-foreground
        prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
        prose-pre:bg-muted prose-pre:text-xs prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
        prose-table:text-xs
        prose-th:text-left prose-th:px-3 prose-th:py-1.5 prose-th:bg-muted
        prose-td:px-3 prose-td:py-1.5 prose-td:border-t
        prose-strong:text-foreground
        prose-hr:my-6
      ">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
