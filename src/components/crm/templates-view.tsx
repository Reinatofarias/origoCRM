"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { MessageTemplate } from "@/lib/types";

export function Templates({
  templates,
  onAddTemplate,
  onDeleteTemplate,
}: {
  templates: MessageTemplate[];
  onAddTemplate: (title: string, body: string) => void;
  onDeleteTemplate: (template: MessageTemplate) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <form
        className="rounded-xl border border-white/10 bg-white/[0.035] p-5"
        onSubmit={(event) => {
          event.preventDefault();
          onAddTemplate(title, body);
          setTitle("");
          setBody("");
        }}
      >
        <h2 className="text-lg font-semibold">Nova mensagem pronta</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Variáveis: {"{{nome}}, {{empresa}}, {{telefone}}, {{origem}}"}
        </p>
        <input
          className="mt-4 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none transition focus:border-[#8B5CF6]"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Título"
          required
          value={title}
        />
        <textarea
          className="mt-3 min-h-36 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm outline-none transition focus:border-[#8B5CF6]"
          onChange={(event) => setBody(event.target.value)}
          placeholder="Mensagem"
          required
          value={body}
        />
        <button className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] text-sm font-medium">
          <Plus className="h-4 w-4" />
          Salvar mensagem
        </button>
      </form>
      <div className="grid gap-3">
        {templates.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.025] p-5 text-sm text-zinc-500">
            Nenhuma mensagem pronta cadastrada.
          </div>
        )}
        {templates.map((template) => (
          <article className="rounded-xl border border-white/10 bg-white/[0.035] p-5" key={template.id}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium">{template.title}</h3>
              <button
                className="rounded-md border border-red-400/20 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20"
                onClick={() => onDeleteTemplate(template)}
                title="Excluir mensagem pronta"
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{template.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
