import { useMemo, useState } from 'react';

import {
  filterGlossaryEntries,
  GLOSSARY_ENTRIES,
  type GlossaryEntry,
  type SupportedLocale,
} from '@tone-capture-doctor/glossary';

import type { Messages } from './i18n';

const REFERENCE_LABELS: Record<string, string> = {
  'internal:audio-core': 'ToneCaptureDoctor analysis engine',
  'internal:phase7-guidance': 'ToneCaptureDoctor measured guidance',
};

interface GlossaryPanelProps {
  locale: SupportedLocale;
  messages: Messages['glossary'];
}

function LocalizedList({
  items,
  locale,
}: {
  items: GlossaryEntry['commonCauses'];
  locale: SupportedLocale;
}) {
  return (
    <ul className="glossary-list">
      {items.map((item, index) => (
        <li key={`${item.en}-${index}`}>{item[locale]}</li>
      ))}
    </ul>
  );
}

export function GlossaryPanel({ locale, messages }: GlossaryPanelProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(GLOSSARY_ENTRIES[0]?.id ?? '');
  const entries = useMemo(() => filterGlossaryEntries(query, locale), [locale, query]);
  const selected = entries.find((entry) => entry.id === selectedId) ?? entries[0];

  return (
    <article className="panel glossary-panel">
      <p className="eyebrow">{messages.eyebrow}</p>
      <h3>{messages.title}</h3>
      <div className="glossary-controls">
        <label className="field-label" htmlFor="glossary-search">
          {messages.search}
          <input
            id="glossary-search"
            placeholder={messages.searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="field-label" htmlFor="glossary-term">
          {messages.term}
          <select
            id="glossary-term"
            value={selected?.id ?? ''}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {entries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.term[locale]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {selected ? (
        <div className="glossary-entry">
          <h4>{selected.term[locale]}</h4>
          <p>{selected.shortDefinition[locale]}</p>
          <dl className="glossary-definition">
            <div>
              <dt>{messages.measured}</dt>
              <dd>{selected.measuredByThisApp[locale]}</dd>
            </div>
            <div>
              <dt>{messages.notMeasured}</dt>
              <dd>{selected.notMeasuredByThisApp[locale]}</dd>
            </div>
          </dl>
          <div className="glossary-columns">
            <div>
              <strong>{messages.causes}</strong>
              <LocalizedList items={selected.commonCauses} locale={locale} />
            </div>
            <div>
              <strong>{messages.experiments}</strong>
              <LocalizedList items={selected.safeExperiments} locale={locale} />
            </div>
          </div>
          {selected.warnings && selected.warnings.length > 0 && (
            <div className="glossary-warning">
              <strong>{messages.warnings}</strong>
              <LocalizedList items={selected.warnings} locale={locale} />
            </div>
          )}
          <small className="glossary-references">
            {messages.references}:{' '}
            {selected.references
              .map((reference) => REFERENCE_LABELS[reference] ?? reference)
              .join(', ')}
          </small>
        </div>
      ) : (
        <p className="analysis-state">{messages.noResults}</p>
      )}
    </article>
  );
}
