"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listDiagrams, loadProject, deleteDiagram } from "@/lib/storage/local-storage";
import type { Project } from "@/lib/project/project";
import { useTranslation } from "@/lib/i18n/context";

export function RecentProjects({ onOpen }: { onOpen: (project: Project) => void }) {
  const [recent, setRecent] = useState(listDiagrams);
  const { t, locale } = useTranslation();
  if (!recent.length) return null;
  return (
    <section aria-label={t("project.recent")} className="mx-auto mb-12 max-w-5xl px-6">
      <h2 className="mb-3 text-xl font-semibold">{t("project.recent")}</h2>
      <ul className="max-h-72 divide-y divide-border overflow-y-auto border-y border-border">
        {recent.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 py-3">
            <button className="min-w-0 flex-1 rounded-md p-2 text-left hover:bg-accent" onClick={() => {
              const project = loadProject(entry.id);
              if (project) onOpen(project);
              else { toast.error(t("project.invalid")); setRecent(listDiagrams()); }
            }}>
              <span className="block truncate font-medium">{entry.name}</span>
              <span className="text-xs text-muted-foreground">{t("sidebar.tables", { count: entry.tableCount })} · {entry.databaseType} · {Number.isNaN(Date.parse(entry.updatedAt)) ? entry.updatedAt : new Date(entry.updatedAt).toLocaleString(locale)}</span>
            </button>
            <button className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-destructive" aria-label={t("project.delete", { name: entry.name })} onClick={() => {
              if (!window.confirm(t("project.confirmDelete", { name: entry.name }))) return;
              try { deleteDiagram(entry.id); setRecent(listDiagrams()); }
              catch { toast.error(t("project.saveError")); }
            }}><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
    </section>
  );
}
