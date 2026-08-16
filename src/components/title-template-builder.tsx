"use client";

import { useMemo, useRef, useState } from "react";

export type TemplateField = {
  token: string;
  label: string;
  example: string;
  group: "Plan" | "Team" | "Organisation";
};

export function TitleTemplateBuilder({ initialTemplate, fields }: { initialTemplate: string; fields: TemplateField[] }) {
  const [template, setTemplate] = useState(initialTemplate);
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => fields.reduce((value, field) => value.split(field.token).join(field.example), template), [fields, template]);

  function insertToken(token: string) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? template.length;
    const end = input?.selectionEnd ?? template.length;
    const next = `${template.slice(0, start)}${token}${template.slice(end)}`;
    setTemplate(next);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return <div className="template-builder">
    <label>Titelschema<input ref={inputRef} name="titleTemplate" required value={template} onChange={event => setTemplate(event.target.value)} /></label>
    <div className="title-preview"><span>Live-Vorschau</span><strong>{preview || "Noch kein Titel definiert"}</strong></div>
    <div className="field-browser">
      {(["Plan", "Team", "Organisation"] as const).map(group => {
        const groupFields = fields.filter(field => field.group === group);
        if (!groupFields.length) return null;
        return <section key={group}><h3>{group}</h3><div className="field-list">{groupFields.map(field => <button type="button" className="field-option" key={field.token} onClick={() => insertToken(field.token)} title={`${field.token} einfügen`}><span><code>{field.token}</code><small>{field.label}</small></span><strong>{field.example || "—"}</strong><b>+</b></button>)}</div></section>;
      })}
    </div>
  </div>;
}
