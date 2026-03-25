"use client";

import { FolderOpen } from "lucide-react";

export default function AssetsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <FolderOpen size={48} className="text-muted-foreground mb-4" strokeWidth={1.5} />
      <h2 className="text-lg font-semibold mb-2">素材库</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        AI 生成的图文 Demo、视频 Demo，以及上传的品牌素材，统一管理。
      </p>
      <p className="text-xs text-muted-foreground mt-4">即将上线</p>
    </div>
  );
}
