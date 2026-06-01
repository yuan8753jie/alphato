"use client";

import { FolderOpen } from "lucide-react";
import { useLang } from "@/lib/i18n";

export default function AssetsPage() {
  const { t } = useLang();
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <FolderOpen size={48} className="text-muted-foreground mb-4" strokeWidth={1.5} />
      <h2 className="text-lg font-semibold mb-2">{t("素材库", "Assets")}</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {t("AI 生成的图文 Demo、视频 Demo，以及上传的品牌素材，统一管理。", "Unified management of AI-generated image/video demos and uploaded brand assets.")}
      </p>
      <p className="text-xs text-muted-foreground mt-4">{t("即将上线", "Coming soon")}</p>
    </div>
  );
}
