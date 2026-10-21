// Job table (data/jobs.json, extracted from the real SS13 job datums) + helpers.
export class Jobs {
  constructor(json) {
    this.list = json.jobs.filter((j) => j.spawn > 0 || j.total !== 0);
    this.all = json.jobs;
    this.byId = Object.fromEntries(json.jobs.map((j) => [j.id, j]));
    this.accessNames = json.access;
    this.everyAccess = Object.keys(json.access).map(Number);
    this.allAccess = this.everyAccess.filter((n) => n < 100);           // what an all-access ID opens (get_all_accesses): the station's. Central Command's (101 and up), the Syndicate's and the away missions' are on nobody's ID
  }

  get(id) { return this.byId[id] || this.byId.assistant; }

  accessOf(job) {
    if (job.allAccess) return new Set(this.allAccess);
    return new Set(job.access);
  }

  accessName(n) {
    const s = this.accessNames[String(n)] || String(n);
    return s.toLowerCase().replace(/_/g, ' ');
  }

  /** Slots a job offers at roundstart (SS13: spawn_positions; -1 = unlimited). */
  slots(job) { return job.id === 'assistant' ? 99 : job.spawn; }
}

/** The lines SS13 prints when you're assigned a job (code/controllers/subsystem/job.dm). */
export function greeting(job) {
  return [
    ['notice', `You are the ${job.title}.`],
    ['notice', `As the ${job.title} you answer directly to ${job.supervisors}. Special circumstances may change this.`],
    ['notice', 'Prefix your message with :h to speak on your department\'s radio. To see other prefixes, look closely at your headset.'],
  ];
}
