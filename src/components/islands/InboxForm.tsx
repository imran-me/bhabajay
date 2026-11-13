/**
 * Generic inbox form: "Dadu said" myth tips, Ask ভাবু, mentor sign-up,
 * contact, join-a-series-team. Validates in Bangla, writes via the backend.
 */
import { useState, type FormEvent } from 'react';
import { getBackend, type InboxItem } from '../../lib/backend';
import { toast } from '../../lib/store';
import { sound, confetti } from '../../lib/fx';
import { Bhabu, Field, isEmail } from './ui';

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'email' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: string[];
  maxLength?: number;
  hint?: string;
}

interface Props {
  kind: InboxItem['kind'];
  fields: FieldDef[];
  submitLabel: string;
  successTitle: string;
  successBody: string;
  hidden?: Record<string, string>;
  dark?: boolean;
}

export default function InboxForm({ kind, fields, submitLabel, successTitle, successBody, hidden = {}, dark = false }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [honey, setHoney] = useState('');

  function validate() {
    const e: Record<string, string> = {};
    for (const f of fields) {
      const v = (values[f.name] ?? '').trim();
      if (f.required && !v) e[f.name] = 'এটা লিখতে হবে';
      else if (f.type === 'email' && v && !isEmail(v)) e[f.name] = 'উফ! ইমেইলটা ঠিক মনে হচ্ছে না';
      else if (f.maxLength && v.length > f.maxLength) e[f.name] = `${f.maxLength} অক্ষরের মধ্যে লেখো`;
      else if (f.type === 'textarea' && f.required && v.length < 8) e[f.name] = 'আরেকটু বিস্তারিত লেখো';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (honey) return; // bot trap
    if (!validate()) return;
    setBusy(true);
    try {
      const b = await getBackend();
      const clean = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
      await b.submitInbox(kind, { ...hidden, ...clean });
      setDone(true);
      sound.cheer();
      confetti({ count: 60 });
    } catch {
      toast('উফ! পাঠানো গেল না। নেটওয়ার্ক দেখে আবার চেষ্টা করো।', { kind: 'error', mood: 'think' });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className={`flex items-center gap-4 rounded-2xl p-4 ${dark ? 'bg-white/10' : 'bg-surface ring-1 ring-line'}`} role="status">
        <Bhabu face="wow" body={dark ? 'coral' : 'teal'} dot={dark ? 'sun' : 'coral'} brows={dark ? 'light' : 'dark'} className="w-12" />
        <div>
          <p className="text-lg font-bold">{successTitle}</p>
          <p className={dark ? 'text-white/80' : 'text-ink-soft'}>{successBody}</p>
          <button type="button" className={`mt-2 text-sm font-bold underline-offset-4 hover:underline ${dark ? 'text-sun' : 'text-link'}`} onClick={() => { setDone(false); setValues({}); }}>আরেকটা পাঠাও</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {fields.map((f) => {
        const id = `${kind}-${f.name}`;
        const common = {
          id,
          name: f.name,
          value: values[f.name] ?? '',
          'aria-invalid': errors[f.name] ? true : undefined,
          placeholder: f.placeholder,
          maxLength: f.maxLength,
          className: `field ${dark ? '!bg-white !text-deep' : ''}`,
          onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [f.name]: e.target.value })),
        };
        return (
          <Field key={f.name} label={f.label + (f.required ? '' : ' (ঐচ্ছিক)')} hint={f.hint} error={errors[f.name]} htmlFor={id}>
            {f.type === 'textarea' ? (
              <textarea {...common} rows={4} />
            ) : f.type === 'select' ? (
              <select {...common}>
                <option value="">বেছে নাও…</option>
                {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input {...common} type={f.type === 'email' ? 'email' : 'text'} inputMode={f.type === 'email' ? 'email' : undefined} autoComplete={f.type === 'email' ? 'email' : 'off'} />
            )}
          </Field>
        );
      })}
      <input type="text" tabIndex={-1} autoComplete="off" value={honey} onChange={(e) => setHoney(e.target.value)} className="hidden" aria-hidden="true" name="website" />
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'পাঠাচ্ছি…' : submitLabel}</button>
      </div>
    </form>
  );
}
