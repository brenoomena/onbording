"use client";

import { useState } from "react";
import { AudienceEditor } from "@/components/audience-editor";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Field, Input, Select, cx } from "@/components/ui";
import { RichTextarea } from "@/components/rich-textarea";
import type { ActionState } from "@/lib/action-state";
import { KIND_LABEL, PUBLISH_LABEL, formatBytes, type AudienceRule, type ContentKind, type ContentRow, type PublishStatus } from "@/lib/learning";
import type { PersonOption, Structure } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 50 * 1024 * 1024;

export function ContentForm({
  action,
  content,
  rules,
  structure,
  owners,
  categories,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  content?: ContentRow;
  rules: AudienceRule[];
  structure: Structure;
  owners: PersonOption[];
  categories: string[];
}) {
  const [kind, setKind] = useState<ContentKind>(content?.kind ?? "link");
  const [library, setLibrary] = useState(content?.is_library ?? false);
  const [file, setFile] = useState({
    path: content?.storage_path ?? "",
    name: content?.file_name ?? "",
    size: content?.file_size ?? 0,
    mime: content?.mime_type ?? "",
  });
  const [upload, setUpload] = useState<{ busy: boolean; error?: string }>({ busy: false });

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setUpload({ busy: false, error: "O arquivo passa de 50 MB, o limite do plano atual. Publique-o no Drive e cadastre como link." });
      return;
    }
    setUpload({ busy: true });
    const safe = f.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_");
    const path = `${crypto.randomUUID()}/${safe}`;
    const { error } = await createClient().storage.from("conteudos").upload(path, f, { contentType: f.type || undefined });
    if (error) {
      setUpload({ busy: false, error: "Não foi possível enviar o arquivo. Tente de novo." });
      return;
    }
    setFile({ path, name: f.name, size: f.size, mime: f.type });
    setUpload({ busy: false });
  }

  return (
    <ActionForm action={action}>
      {(state) => {
        const e = state.fieldErrors ?? {};
        return (
          <>
            {content && <input type="hidden" name="id" value={content.id} />}

            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <Field label="Título" htmlFor="title" error={e.title}>
                <Input id="title" name="title" defaultValue={content?.title} required minLength={3} maxLength={160} />
              </Field>
              <Field label="Categoria" htmlFor="category" hint="Ex.: Produtos, Técnicas de vendas" error={e.category}>
                <Input id="category" name="category" list="categories" defaultValue={content?.category ?? ""} maxLength={60} />
                <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
            </div>
            <Field label="Descrição" htmlFor="description" hint="Aparece na lista e no topo do conteúdo." error={e.description}>
              <RichTextarea id="description" name="description" rows={3} defaultValue={content?.description ?? ""} maxLength={1000} />
            </Field>

            <fieldset className="grid gap-3">
              <legend className="mb-2 text-[13px] font-medium">Formato</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(KIND_LABEL) as ContentKind[]).map((k) => (
                  <label
                    key={k}
                    className={cx(
                      "cursor-pointer rounded-lg border px-3.5 py-2 text-[13px] font-medium",
                      kind === k ? "border-brand bg-accent-soft text-accent" : "border-line bg-surface",
                    )}
                  >
                    <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                    {KIND_LABEL[k]}
                  </label>
                ))}
              </div>

              {kind === "texto" && (
                <div className="grid gap-1.5">
                  <label htmlFor="body" className="text-[13px] font-medium">Texto do conteúdo</label>
                  <RichTextarea
                    id="body"
                    name="body"
                    rows={16}
                    defaultValue={content?.body ?? ""}
                    placeholder="Escreva o conteúdo. Use a barra acima para títulos, listas, links e logins."
                  />
                  {e.body && <p className="text-[12px] text-danger">{e.body}</p>}
                </div>
              )}

              {(kind === "link" || kind === "video") && (
                <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                  <Field
                    label="Endereço"
                    htmlFor="url"
                    error={e.url}
                    hint={kind === "video" ? "YouTube, Vimeo e arquivos do Google Drive aparecem dentro da plataforma." : undefined}
                  >
                    <Input id="url" name="url" type="url" defaultValue={content?.url ?? ""} placeholder="https://" />
                  </Field>
                  <Field label="Plataforma" htmlFor="external_platform" hint="Ex.: Learning Rocks, Google Drive" error={e.external_platform}>
                    <Input id="external_platform" name="external_platform" defaultValue={content?.external_platform ?? ""} maxLength={80} />
                  </Field>
                  <Field
                    label="Instruções de acesso"
                    htmlFor="access_note"
                    className="sm:col-span-2"
                    hint="Aparece só para quem tem acesso ao conteúdo. Ex.: login e senha padrão da plataforma externa."
                    error={e.access_note}
                  >
                    <RichTextarea id="access_note" name="access_note" rows={3} defaultValue={content?.access_note ?? ""} maxLength={1000} />
                  </Field>
                </div>
              )}

              {kind === "arquivo" && (
                <div className="grid gap-2">
                  <input type="hidden" name="storage_path" value={file.path} />
                  <input type="hidden" name="file_name" value={file.name} />
                  <input type="hidden" name="file_size" value={file.size || ""} />
                  <input type="hidden" name="mime_type" value={file.mime} />
                  <label htmlFor="file" className="text-[13px] font-medium">Arquivo (até 50 MB)</label>
                  <input
                    id="file"
                    type="file"
                    onChange={(ev) => onFile(ev.target.files?.[0])}
                    className="text-[13px] file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-[13px] file:font-medium"
                  />
                  {upload.busy && <p className="text-[12px] text-muted">Enviando…</p>}
                  {upload.error && <Alert>{upload.error}</Alert>}
                  {file.path && !upload.busy && (
                    <p className="text-[13px]">
                      Arquivo atual: <span className="font-medium">{file.name}</span> <span className="text-muted">{formatBytes(file.size)}</span>
                    </p>
                  )}
                  {e.storage_path && <p className="text-[12px] text-danger">{e.storage_path}</p>}
                </div>
              )}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Tempo estimado (min)" htmlFor="estimated_minutes" error={e.estimated_minutes}>
                <Input id="estimated_minutes" name="estimated_minutes" type="number" min={1} max={1440} defaultValue={content?.estimated_minutes ?? ""} />
              </Field>
              <Field label="Responsável" htmlFor="owner_id">
                <Select id="owner_id" name="owner_id" defaultValue={content?.owner_id ?? ""}>
                  <option value="">Sem responsável</option>
                  {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                </Select>
              </Field>
              <Field label="Status" htmlFor="status">
                <Select id="status" name="status" defaultValue={content?.status ?? "rascunho"}>
                  {(Object.keys(PUBLISH_LABEL) as PublishStatus[]).map((s) => <option key={s} value={s}>{PUBLISH_LABEL[s]}</option>)}
                </Select>
              </Field>
            </div>
            <Field
              label="Objetivo e orientações"
              htmlFor="objective"
              hint="Aparece logo abaixo do conteúdo (vídeo, foto, arquivo). Use para o objetivo, orientações, links extras e logins de acesso."
              error={e.objective}
            >
              <RichTextarea id="objective" name="objective" rows={5} defaultValue={content?.objective ?? ""} maxLength={4000} />
            </Field>

            <fieldset className="grid gap-3 rounded-xl border border-line p-4">
              <legend className="px-1 text-[13px] font-semibold">Biblioteca de materiais</legend>
              <label className="flex items-start gap-3 text-[14px]">
                <input type="checkbox" name="is_library" checked={library} onChange={(ev) => setLibrary(ev.target.checked)} className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]" />
                <span>
                  Mostrar na biblioteca para consulta, fora das trilhas
                  <span className="block text-[12.5px] text-muted">Conteúdos de trilha já aparecem para quem está matriculado nela.</span>
                </span>
              </label>
              {library && (
                <AudienceEditor
                  structure={structure}
                  initial={rules}
                  emptyHint="Sem público definido, ninguém vê na biblioteca. Adicione um público; deixe os campos em branco para liberar a todos."
                />
              )}
            </fieldset>

            <div className="border-t border-line pt-4">
              <SubmitButton>{content ? "Salvar conteúdo" : "Criar conteúdo"}</SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
