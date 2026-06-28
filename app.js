import { initialData } from './initialData.js';
import { db, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, getDocs, writeBatch } from './firebase.js';

let chantiers = [];
let agents = [];
let readyChantiers = false;
let readyAgents = false;
const $ = id => document.getElementById(id);
const norm = v => (v || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const keyOf = v => norm(v).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sans-nom';
const unique = arr => [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
const escapeHtml = s => (s || '').toString().replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const agentsOf = row => [row.poubelle, row.menage, row.gardiennage].filter(Boolean);
const agentByName = name => agents.find(a => norm(a.nom) === norm(name));
const getPhone = name => agentByName(name)?.telephone || '';
const refs = { chantiers: collection(db, 'chantiers'), agents: collection(db, 'agents') };

function chantierDocId(row){ return keyOf((row.client || '') + '-' + (row.chantier || '') + '-' + (row.cp || '')); }
function toast(msg){ const t=$('toast'); t.textContent=msg; t.style.display='block'; setTimeout(()=>t.style.display='none',2600); }
function status(){ $('syncStatus').textContent = (readyChantiers && readyAgents) ? 'Synchronisé avec Firebase' : 'Chargement Firebase...'; }

async function seedIfEmpty(){
  const snap = await getDocs(refs.chantiers);
  if (!snap.empty) return;
  const batch = writeBatch(db);
  const agentNames = new Set();
  initialData.forEach(row => {
    const clean = {...row, createdAt: Date.now(), updatedAt: Date.now()};
    batch.set(doc(db,'chantiers',chantierDocId(clean)), clean, {merge:true});
    agentsOf(clean).forEach(a => agentNames.add(a));
  });
  agentNames.forEach(n => batch.set(doc(db,'agents',keyOf(n)), {nom:n, telephone:'', updatedAt:Date.now()}, {merge:true}));
  await batch.commit();
  toast('Données initiales importées dans Firebase');
}

onSnapshot(refs.agents, snap => {
  agents = snap.docs.map(d => ({id:d.id, ...d.data()})).sort((a,b)=>(a.nom||'').localeCompare(b.nom||'','fr'));
  readyAgents = true; status(); render();
});

onSnapshot(refs.chantiers, snap => {
  chantiers = snap.docs.map(d => ({id:d.id, ...d.data()})).sort((a,b)=>(a.chantier||'').localeCompare(b.chantier||'','fr'));
  readyChantiers = true; status(); render();
});

seedIfEmpty().catch(err => alert('Erreur Firebase : ' + err.message));

function agentOptions(selected=''){
  return '<option value="">Aucun</option>' + agents.map(a => `<option value="${escapeHtml(a.nom)}" ${norm(a.nom)===norm(selected)?'selected':''}>${escapeHtml(a.nom)}</option>`).join('');
}
function refreshModalSelects(row={}){
  $('fPoubelle').innerHTML = agentOptions(row.poubelle || '');
  $('fMenage').innerHTML = agentOptions(row.menage || '');
  $('fGardiennage').innerHTML = agentOptions(row.gardiennage || '');
}
function phoneHtml(agent){
  if (!agent) return '<span class="muted">—</span>';
  const p = getPhone(agent);
  if (!p) return `<div class="phone"><strong>${escapeHtml(agent)}</strong><br><span class="small">Numéro non renseigné</span></div>`;
  return `<div class="phone"><strong>${escapeHtml(agent)}</strong><br><a class="call" href="tel:${p.replace(/\s/g,'')}">📞 ${escapeHtml(p)}</a></div>`;
}
function phonesForRow(row){ return agentsOf(row).map(phoneHtml).join('<hr style="border:0;border-top:1px solid #eee">'); }
function filtered(){
  const q=norm($('search').value), c=$('clientFilter').value, a=$('agentFilter').value, svc=$('serviceFilter').value;
  return chantiers.filter(r => {
    const phones = agentsOf(r).map(getPhone).join(' ');
    const blob = norm([r.chantier,r.cp,r.poubelle,r.menage,r.gardiennage,r.client,phones].join(' '));
    if(q && !blob.includes(q)) return false;
    if(c && r.client !== c) return false;
    if(a && !agentsOf(r).some(x => norm(x) === norm(a))) return false;
    if(svc && !r[svc]) return false;
    return true;
  });
}
function fillFilters(){
  const currentC=$('clientFilter').value, currentA=$('agentFilter').value;
  const clients=unique(chantiers.map(r=>r.client));
  $('clientFilter').innerHTML='<option value="">Tous</option>'+clients.map(v=>`<option ${v===currentC?'selected':''}>${escapeHtml(v)}</option>`).join('');
  $('agentFilter').innerHTML='<option value="">Tous</option>'+agents.map(a=>`<option ${a.nom===currentA?'selected':''}>${escapeHtml(a.nom)}</option>`).join('');
  $('kClients').textContent=clients.length; $('kAgents').textContent=agents.length;
}
function renderAgents(){
  $('agentList').innerHTML = agents.map(a => `<div class="agent-pill"><strong>${escapeHtml(a.nom)}</strong><div class="small">${a.telephone ? escapeHtml(a.telephone) : 'Numéro non renseigné'}</div><div class="actions" style="margin-top:6px"><button class="secondary" data-edit-agent="${a.id}">Modifier</button><button class="danger" data-del-agent="${a.id}">Supprimer</button></div></div>`).join('') || '<div class="small">Aucun agent.</div>';
}
function render(){
  fillFilters(); renderAgents();
  const rows=filtered(); $('kTotal').textContent=chantiers.length; $('kVisible').textContent=rows.length;
  $('tbody').innerHTML = rows.map(r => `<tr><td><strong>${escapeHtml(r.chantier)}</strong><div class="small">Source: ${escapeHtml(r.source||'Ajout manuel')}</div></td><td>${escapeHtml(r.cp)}</td><td>${escapeHtml(r.poubelle)}</td><td>${escapeHtml(r.menage)}</td><td>${escapeHtml(r.gardiennage)}</td><td>${phonesForRow(r)}</td><td><span class="badge">${escapeHtml(r.client)}</span></td><td><button class="secondary" data-edit-row="${r.id}">Modifier</button> <button class="danger" data-del-row="${r.id}">Supprimer</button></td></tr>`).join('') || '<tr><td colspan="8">Aucun résultat</td></tr>';
}
function openModal(row=null){
  $('modalTitle').textContent = row ? 'Modifier le chantier' : 'Ajouter un chantier';
  $('editId').value = row?.id || '';
  $('fChantier').value = row?.chantier || ''; $('fCp').value = row?.cp || ''; $('fClient').value = row?.client || '';
  refreshModalSelects(row || {}); $('modal').classList.add('open'); $('fChantier').focus();
}
function closeModal(){ $('modal').classList.remove('open'); }
async function ensureAgent(name){
  name = (name || '').trim(); if(!name) return;
  const id = keyOf(name);
  const existing = agents.find(a => a.id === id || norm(a.nom) === norm(name));
  if(!existing) await setDoc(doc(db,'agents',id), {nom:name, telephone:'', updatedAt:Date.now()}, {merge:true});
}

$('saveAgentBtn').onclick = async () => {
  const nom=$('agentName').value.trim(), telephone=$('agentPhone').value.trim();
  if(!nom) return alert('Saisissez le nom de l’agent.');
  await setDoc(doc(db,'agents',keyOf(nom)), {nom, telephone, updatedAt:Date.now()}, {merge:true});
  $('agentName').value=''; $('agentPhone').value=''; toast('Agent enregistré');
};
$('saveBtn').onclick = async () => {
  const id = $('editId').value;
  const row={chantier:$('fChantier').value.trim(), cp:$('fCp').value.trim(), poubelle:$('fPoubelle').value, menage:$('fMenage').value, gardiennage:$('fGardiennage').value, client:$('fClient').value.trim()||'NOUVEAU', source:id?(chantiers.find(r=>r.id===id)?.source||'Modification'):'Ajout manuel', updatedAt:Date.now()};
  if(!row.chantier) return alert('Veuillez saisir une adresse / un chantier.');
  if(id) await updateDoc(doc(db,'chantiers',id), row); else await addDoc(refs.chantiers, {...row, createdAt:Date.now()});
  closeModal(); toast('Chantier enregistré');
};
$('addBtn').onclick=()=>openModal(); $('cancelBtn').onclick=closeModal; $('modal').onclick=e=>{ if(e.target.id==='modal') closeModal(); };
['search','clientFilter','agentFilter','serviceFilter'].forEach(id => $(id).addEventListener('input', render));

document.addEventListener('click', async e => {
  const editRow=e.target.dataset.editRow, delRow=e.target.dataset.delRow, editAgent=e.target.dataset.editAgent, delAgent=e.target.dataset.delAgent;
  if(editRow) openModal(chantiers.find(r=>r.id===editRow));
  if(delRow && confirm('Supprimer ce chantier ?')) { await deleteDoc(doc(db,'chantiers',delRow)); toast('Chantier supprimé'); }
  if(editAgent){ const a=agents.find(x=>x.id===editAgent); if(a){ $('agentName').value=a.nom||''; $('agentPhone').value=a.telephone||''; $('agentName').focus(); } }
  if(delAgent){ const a=agents.find(x=>x.id===delAgent); const count=chantiers.filter(r=>agentsOf(r).some(n=>norm(n)===norm(a?.nom))).length; if(confirm(`Supprimer l'agent ${a?.nom||''} ?\nIl est affecté à ${count} chantier(s). Les affectations resteront dans les chantiers, mais le téléphone disparaîtra.`)){ await deleteDoc(doc(db,'agents',delAgent)); toast('Agent supprimé'); } }
});

$('exportBtn').onclick=()=>{
  const cols=['chantier','cp','poubelle','menage','gardiennage','client'];
  const csv=[cols.concat(['telephones_agents']).join(';'), ...filtered().map(r => cols.map(c => '"'+(r[c]||'').toString().replaceAll('"','""')+'"').concat('"'+agentsOf(r).map(a=>`${a}: ${getPhone(a)}`).join(' / ').replaceAll('"','""')+'"').join(';'))].join('\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='listing_chantiers.csv'; a.click();
};

function splitCsvLine(line,sep){ const out=[]; let cur='',q=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"'){ if(q&&line[i+1]==='"'){cur+='"';i++;} else q=!q;} else if(ch===sep&&!q){out.push(cur);cur='';} else cur+=ch;} out.push(cur); return out; }
function parseCsv(txt){ txt=txt.replace(/^\ufeff/,'').replace(/\r/g,''); const lines=txt.split('\n').filter(l=>l.trim()); if(!lines.length) return []; const sep=(lines[0].split(';').length>=lines[0].split(',').length)?';':','; const heads=splitCsvLine(lines[0],sep).map(h=>h.trim()); return lines.slice(1).map(l=>{const vals=splitCsvLine(l,sep); let o={}; heads.forEach((h,i)=>o[h]=vals[i]||''); return o;}); }
function pick(obj,keys){ const entries=Object.entries(obj); for(const k of keys){ const nk=norm(k); const f=entries.find(([h])=>norm(h).includes(nk)); if(f) return (f[1]||'').toString().trim(); } return ''; }
function rowFromObj(o,source){ return {chantier:pick(o,['chantier','adresse','site','immeuble','residence','résidence','nom'])||Object.values(o)[0]||'', cp:pick(o,['cp','code postal','ville','secteur']), poubelle:pick(o,['poubelle','ordures','om','sortie']), menage:pick(o,['menage','ménage','nettoyage','agent ménage','agent']), gardiennage:pick(o,['gardiennage','gardien','remplacement']), client:pick(o,['client','syndic','gestionnaire'])||'IMPORT', source}; }
async function importRows(rows, filename){
  let imported=rows.map(r=>rowFromObj(r,filename)).filter(r=>String(r.chantier||'').trim());
  if(!imported.length) return alert('Aucun chantier trouvé. Vérifiez que le fichier contient une colonne Chantier ou Adresse.');
  if(!confirm(imported.length+' chantier(s) trouvés. Importer dans Firebase ?')) return;
  const batch=writeBatch(db); let agentNames=new Set(); let count=0;
  imported.forEach(r => { r.updatedAt=Date.now(); r.createdAt=Date.now(); const id=chantierDocId(r); batch.set(doc(db,'chantiers',id), r, {merge:true}); agentsOf(r).forEach(a=>agentNames.add(a)); count++; });
  agentNames.forEach(n => batch.set(doc(db,'agents',keyOf(n)), {nom:n, telephone:'', updatedAt:Date.now()}, {merge:true}));
  await batch.commit(); toast(count+' chantier(s) importé(s) / mis à jour');
}
$('importBtn').onclick=()=>$('importFile').click();
$('importFile').addEventListener('change', async e => {
  const file=e.target.files[0]; if(!file) return;
  try{
    const name=file.name.toLowerCase();
    if(name.endsWith('.csv')||name.endsWith('.txt')) await importRows(parseCsv(await file.text()), file.name);
    else { if(typeof XLSX==='undefined') return alert('Pour importer Excel, ouvrez avec internet.'); const buf=await file.arrayBuffer(); const wb=XLSX.read(buf,{type:'array'}); const sh=wb.Sheets[wb.SheetNames[0]]; await importRows(XLSX.utils.sheet_to_json(sh,{defval:''}), file.name); }
  } catch(err){ alert('Import impossible : '+err.message); } finally { e.target.value=''; }
});
