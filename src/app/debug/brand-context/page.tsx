"use client";

import { useEffect, useState } from "react";
import { buildBrandContext } from "@/lib/brand-context";
import { getAccount } from "@/lib/store";
import type { Account } from "@/lib/types";

export default function BrandContextDebug() {
  const [account, setAccount] = useState<Account | null>(null);
  const [focusId, setFocusId] = useState<string>("");

  useEffect(() => {
    const a = getAccount();
    setAccount(a);
    if (a && a.products.length > 0) setFocusId(a.products[0].id);
  }, []);

  if (!account) {
    return <div className="text-sm text-muted-foreground">No active account.</div>;
  }

  const focusContext = focusId ? buildBrandContext(account, focusId) : "";
  const nonFocusContext = buildBrandContext(account);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Brand Context Preview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live output of <code className="text-xs">buildBrandContext(account, focusProductId)</code>
          {" "}— the actual string injected as <code className="text-xs">${"{brandContext}"}</code> in topic / script prompts.
        </p>
      </div>

      <div className="rounded-lg border p-4 bg-muted/20">
        <p className="text-xs text-muted-foreground">Active account</p>
        <p className="text-sm font-medium mt-0.5">
          {account.brand.name} <span className="text-muted-foreground">· {account.brand.industry} · {account.platform}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Products: {account.products.map((p) => p.name).join(" | ") || "(none)"}
        </p>
      </div>

      {/* Focus mode */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold">Focus Mode</h2>
          <select
            value={focusId}
            onChange={(e) => setFocusId(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            {account.products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <pre className="text-[12px] leading-[1.6] bg-slate-950 text-slate-200 p-5 rounded-xl whitespace-pre-wrap font-mono overflow-x-auto">
{focusContext}
        </pre>
      </div>

      {/* Non-focus mode */}
      <div>
        <h2 className="text-base font-semibold mb-2">Non-Focus Mode (topic has no bound product)</h2>
        <pre className="text-[12px] leading-[1.6] bg-slate-950 text-slate-200 p-5 rounded-xl whitespace-pre-wrap font-mono overflow-x-auto">
{nonFocusContext}
        </pre>
      </div>
    </div>
  );
}
