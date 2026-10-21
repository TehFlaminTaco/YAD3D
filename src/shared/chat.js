// Speech rules, radio channels and message kinds, following SS13's conventions.

export const RADIO = {
  common: { name: 'Common', key: '', color: '#1ecc43' },
  science: { name: 'Science', key: 'n', color: '#c68cfa' },
  command: { name: 'Command', key: 'c', color: '#fcdf03' },
  security: { name: 'Security', key: 's', color: '#dd3535' },
  medical: { name: 'Medical', key: 'm', color: '#57b8f0' },
  engineering: { name: 'Engineering', key: 'e', color: '#f37746' },
  supply: { name: 'Supply', key: 'u', color: '#b88646' },
  service: { name: 'Service', key: 'v', color: '#6ca729' },
};
export const RADIO_BY_KEY = Object.fromEntries(Object.entries(RADIO).filter(([, v]) => v.key).map(([k, v]) => [v.key, k]));

export const HEARING_RANGE = 14;      // metres (7 tiles)
export const WHISPER_RANGE = 2.2;     // about one tile

/** Which channels a headset (by item path) can use. Always includes common. */
export function headsetChannels(path) {
  const ch = new Set(['common']);
  const has = (s) => path.includes(s);
  if (has('heads/captain')) ['command', 'security', 'engineering', 'medical', 'science', 'supply', 'service'].forEach((c) => ch.add(c));
  if (has('heads/rd')) { ch.add('science'); ch.add('command'); }
  if (has('heads/hos')) { ch.add('security'); ch.add('command'); }
  if (has('heads/ce')) { ch.add('engineering'); ch.add('command'); }
  if (has('heads/cmo')) { ch.add('medical'); ch.add('command'); }
  if (has('heads/hop')) { ch.add('service'); ch.add('supply'); ch.add('command'); }
  if (has('heads/qm')) { ch.add('supply'); ch.add('command'); }
  if (has('headset_eng')) ch.add('engineering');
  if (has('headset_med')) ch.add('medical');
  if (has('headset_sci')) ch.add('science');
  if (has('headset_sec') || has('headset_srvsec')) ch.add('security');
  if (has('headset_cargo') || has('headset_mining')) ch.add('supply');
  if (has('headset_srv')) ch.add('service');
  if (has('headset_srvmed') || has('headset_medsci')) { ch.add('medical'); if (has('medsci')) ch.add('science'); }
  if (has('/mining')) ch.add('supply');
  return [...ch];
}

/** "department" channel (:h) = the first non-common channel of the headset. */
export function departmentChannel(channels) { return channels.find((c) => c !== 'common') || 'common'; }

/**
 * Parse what a player typed. Returns {mode: 'say'|'whisper'|'emote'|'radio', channel?, text}.
 * ";" = common radio, ":x" = department/other radio, "*" = emote. A "mode" from the UI (say/whisper/me/ooc) is the default.
 */
export function parseSpeech(raw, uiMode = 'say') {
  let text = raw.trim();
  if (!text) return null;
  if (uiMode === 'ooc') return { mode: 'ooc', text };
  if (uiMode === 'me' || text.startsWith('*')) return { mode: 'emote', text: text.replace(/^\*\s*/, '') };
  if (text.startsWith(';')) return { mode: 'radio', channel: 'common', text: text.slice(1).trim() };
  const m = /^:([a-z])\s*/i.exec(text);
  if (m) {
    const k = m[1].toLowerCase();
    return { mode: 'radio', channel: k === 'h' ? 'dept' : RADIO_BY_KEY[k] || 'common', text: text.slice(m[0].length).trim() };
  }
  return { mode: uiMode === 'whisper' ? 'whisper' : 'say', text };
}
