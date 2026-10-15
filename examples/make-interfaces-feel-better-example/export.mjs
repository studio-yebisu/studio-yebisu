export function selectedClips(data, ids) {
  const selected = new Set(ids);
  return data.clips.filter(c => selected.has(c.id));
}
export function summarize(data, ids) {
  const clips=selectedClips(data,ids);
  const seconds=clips.reduce((n,c)=>n+c.duration_seconds,0);
  return { count:clips.length, seconds, time: String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0') };
}
export function createExport(data, ids, includeNotes=true) {
  const clips=selectedClips(data,ids);
  if (!clips.length) throw new RangeError('カットを1件以上選んでください');
  return {schema_version:1, project:data.project, clips:clips.map(c=>includeNotes?{...c}:{id:c.id,title:c.title,duration_seconds:c.duration_seconds})};
}
export function serializeExport(data, ids, includeNotes=true) {
  return JSON.stringify(createExport(data,ids,includeNotes),null,2)+'\n';
}
