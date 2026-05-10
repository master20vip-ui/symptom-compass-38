import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { Plus, Trash2, LogOut, MessageSquareText } from "lucide-react";
import type { Thread } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  threads: Thread[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onSignOut: () => void;
};

export function ThreadSidebar({
  threads,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onSignOut,
}: Props) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="border-b border-sidebar-border px-4 py-4">
        <Logo />
      </div>

      <div className="px-3 py-3">
        <Button onClick={onNew} className="w-full glow-neon" size="sm">
          <Plus className="mr-1 size-4" /> New symptom check
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <p className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          History
        </p>
        <ul className="space-y-0.5">
          {threads.map((t) => {
            const active = t.id === activeId;
            return (
              <li key={t.id}>
                <div
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition",
                    active
                      ? "bg-sidebar-accent text-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                  )}
                >
                  <button
                    onClick={() => onSelect(t.id)}
                    className="flex flex-1 items-center gap-2 truncate text-left"
                  >
                    <MessageSquareText className="size-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{t.title}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this symptom check?")) onDelete(t.id);
                    }}
                    className="opacity-0 transition group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    <Trash2 className="size-3.5 hover:text-destructive" />
                  </button>
                </div>
              </li>
            );
          })}
          {threads.length === 0 && (
            <li className="px-2 py-2 text-xs text-muted-foreground">
              No previous sessions.
            </li>
          )}
        </ul>
      </div>

      <div className="border-t border-sidebar-border p-3">
        <Button onClick={onSignOut} variant="ghost" size="sm" className="w-full justify-start">
          <LogOut className="mr-2 size-4" /> Sign out
        </Button>
      </div>
    </aside>
  );
}
