import { db, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDocs, writeBatch, onSnapshot, serverTimestamp } from './firebase.js';
import { initialChantiers } from './initialData.js';

const $ = (id) => document.getElementById(id);
const chantiersCol = collection(db, 'chantiers');
const agentsCol = collection(db, 'agents');
let chantiers = [];
let agents = [];
let readyChantiers = false;
let readyAgents = false;
const SERVICE_WORDS = new Set(['poubelle','poubelles','menage','ménage','gardiennage','gardien','agent','']);

function norm(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim()}
function clean(v){return String(v||'').trim()}
function html(v){return String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function phoneHref(p){return String(p||'').replace(/[^0-9+]/g,'')}
function agentByName(name){const n=norm(name);return agents.find(a=>norm(a.nom)===n)}
function isRealAgentName(name){const n=norm(name); return n && !SERVICE_WORDS.has(n) && n.length > 1}
function chantierKey(c){return norm((c.client||'')+'|'+(c.adresse||c.chantier||''))}
function setStatus(){
  const total = chantiers.length;
  $('status').textContent = (readyChantiers && readyAgents) ? `${total} chantier(s) - ${agents.length} agent(s) synchronisés Firebase` : 'Chargement Firebase...';
}

onSnapshot(agentsCol, (snap)=>{agents=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.nom||'').localeCompare(String(b.nom||''),'fr'));readyAgents=true;fillAgentSelects();renderAgents();render();setStatus();}, err=>{$('status').textContent='Erreur Firebase agents : '+err.message});
onSnapshot(chantiersCol, (snap)=>{chantiers=snap.docs.map(d=>({id:d.id,...d.data()}));readyChantiers=true;render();setStatus();}, err=>{$('status').textContent='Erreur Firebase chantiers : '+err.message});

function agentOptions(selected=''){
  const opts = ['<option value="">-- Aucun --</option>'];
  for(const a of agents){
    const nom = a.nom || '';
    opts.push(`<option value="${html(nom)}" ${norm(nom)===norm(selected)?'selected':''}>${html(nom)}</option>`);
  }
  return opts.join('');
}
function fillAgentSelects(){
  for(const id of ['poubelle','menage','gardiennage']){
    const current=$(id).value;
    $(id).innerHTML=agentOptions(current);
  }
}
function prestationHtml(label, agentName){
  if(!agentName) return `<div class="presta"><h3>${label}</h3><span class="no-phone">Aucun agent</span></div>`;
  const a = agentByName(agentName);
  const phone = a?.telephone || '';
  return `<div class="presta"><h3>${label}</h3><div class="agent-name">${html(agentName)}</div>${phone?`<a class="call" href="tel:${phoneHref(phone)}">📞 ${html(phone)}</a>`:'<div class="no-phone">Numéro non renseigné</div>'}</div>`;
}
function render(){
  const q = norm($('searchInput').value);
  const help=$('emptyHelp'), results=$('results');
  if(q.length < 2){help.classList.remove('hidden');results.innerHTML='';return;}
  help.classList.add('hidden');
  const rows = chantiers.filter(c=>norm([c.adresse,c.cp,c.client,c.poubelle,c.menage,c.gardiennage].join(' ')).includes(q)).slice(0,80);
  if(!rows.length){results.innerHTML='<div class="help-card"><h2>Aucun résultat</h2><p>Essayez avec une partie de l’adresse ou le nom de l’agent.</p></div>';return;}
  results.innerHTML = rows.map(c=>`<article class="chantier-card">
    <div class="chantier-head"><div><p class="chantier-title">${html(c.adresse || 'Adresse non renseignée')}</p><div class="muted">${html(c.cp||'')}</div></div><span class="badge">${html(c.client||'Sans client')}</span></div>
    <div class="prestations">${prestationHtml('🗑️ Poubelle',c.poubelle)}${prestationHtml('🧹 Ménage',c.menage)}${prestationHtml('👷 Gardiennage',c.gardiennage)}</div>
    <div class="card-actions"><button class="btn secondary" data-edit="${c.id}">Modifier</button><button class="btn danger" data-delete="${c.id}">Supprimer</button></div>
  </article>`).join('');
}

$('searchInput').addEventListener('input', render);
$('results').addEventListener('click', async (e)=>{
  const edit=e.target.closest('[data-edit]');
  const del=e.target.closest('[data-delete]');
  if(edit) openChantier(chantiers.find(c=>c.id===edit.dataset.edit));
  if(del && confirm('Supprimer ce chantier ?')) await deleteDoc(doc(db,'chantiers',del.dataset.delete));
});

function openChantier(c=null){
  $('chantierDialogTitle').textContent = c?'Modifier le chantier':'Ajouter un chantier';
  $('chantierId').value=c?.id||'';
  $('adresse').value=c?.adresse||'';
  $('cp').value=c?.cp||'';
  $('client').value=c?.client||'';
  fillAgentSelects();
  $('poubelle').value=c?.poubelle||'';
  $('menage').value=c?.menage||'';
  $('gardiennage').value=c?.gardiennage||'';
  $('chantierDialog').showModal();
}
$('addChantierBtn').onclick=()=>openChantier();
$('cancelChantierBtn').onclick=()=>$('chantierDialog').close();
$('chantierForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id=$('chantierId').value;
  const payload={adresse:clean($('adresse').value),cp:clean($('cp').value),client:clean($('client').value),poubelle:clean($('poubelle').value),menage:clean($('menage').value),gardiennage:clean($('gardiennage').value),updatedAt:serverTimestamp()};
  if(!payload.adresse) return alert('Adresse obligatoire');
  if(id) await updateDoc(doc(db,'chantiers',id), payload); else await addDoc(chantiersCol,{...payload,createdAt:serverTimestamp()});
  $('chantierDialog').close();
});

$('manageAgentsBtn').onclick=()=>{$('agentsDialog').showModal();renderAgents();};
$('closeAgentsBtn').onclick=()=>$('agentsDialog').close();
function renderAgents(){
  $('agentsList').innerHTML = agents.map(a=>`<div class="agent-pill"><strong>${html(a.nom)}</strong><div class="muted">${html(a.telephone||'Numéro non renseigné')}</div><div class="card-actions"><button class="btn secondary" data-agent-edit="${a.id}">Modifier</button><button class="btn danger" data-agent-delete="${a.id}">Supprimer</button></div></div>`).join('') || '<p class="muted">Aucun agent.</p>';
}
$('agentsList').addEventListener('click', async (e)=>{
  const edit=e.target.closest('[data-agent-edit]');
  const del=e.target.closest('[data-agent-delete]');
  if(edit){const a=agents.find(x=>x.id===edit.dataset.agentEdit);$('agentId').value=a.id;$('agentName').value=a.nom||'';$('agentPhone').value=a.telephone||'';$('agentName').focus();}
  if(del){
    const a=agents.find(x=>x.id===del.dataset.agentDelete); if(!a) return;
    const used=chantiers.filter(c=>[c.poubelle,c.menage,c.gardiennage].some(v=>norm(v)===norm(a.nom))).length;
    if(!confirm(`Supprimer l'agent ${a.nom} ?${used?`\nIl est affecté à ${used} chantier(s). Les affectations seront vidées.`:''}`)) return;
    const batch=writeBatch(db);
    for(const c of chantiers){
      const upd={};
      if(norm(c.poubelle)===norm(a.nom)) upd.poubelle='';
      if(norm(c.menage)===norm(a.nom)) upd.menage='';
      if(norm(c.gardiennage)===norm(a.nom)) upd.gardiennage='';
      if(Object.keys(upd).length) batch.update(doc(db,'chantiers',c.id), upd);
    }
    batch.delete(doc(db,'agents',a.id));
    await batch.commit();
  }
});
$('agentForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id=$('agentId').value;
  const nom=clean($('agentName').value).toUpperCase();
  const telephone=clean($('agentPhone').value);
  if(!nom) return;
  if(id) await updateDoc(doc(db,'agents',id),{nom,telephone,updatedAt:serverTimestamp()});
  else await addDoc(agentsCol,{nom,telephone,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  $('agentId').value='';$('agentName').value='';$('agentPhone').value='';
});

async function ensureAgent(name){
  if(!isRealAgentName(name)) return;
  if(agentByName(name)) return;
  await addDoc(agentsCol,{nom:clean(name).toUpperCase(),telephone:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
}
async function upsertChantier(row){
  const key=chantierKey(row);
  const existing=chantiers.find(c=>chantierKey(c)===key);
  const payload={...row, adresse:clean(row.adresse||row.chantier), cp:clean(row.cp), client:clean(row.client), poubelle:clean(row.poubelle), menage:clean(row.menage), gardiennage:clean(row.gardiennage), updatedAt:serverTimestamp()};
  delete payload.id; delete payload.chantier;
  for(const n of [payload.poubelle,payload.menage,payload.gardiennage]) await ensureAgent(n);
  if(existing) await updateDoc(doc(db,'chantiers',existing.id), payload); else await addDoc(chantiersCol,{...payload,createdAt:serverTimestamp()});
}

$('seedBtn').onclick=async()=>{
  if(!confirm('Réimporter les adresses de départ dans Firebase ? Les chantiers existants seront mis à jour, pas doublonnés.')) return;
  $('status').textContent='Import des adresses en cours...';
  for(const r of initialChantiers) await upsertChantier(r);
  $('status').textContent='Adresses réimportées.';
};

$('importBtn').onclick=()=>$('importFile').click();
$('importFile').addEventListener('change', async (e)=>{
  const file=e.target.files[0]; if(!file) return;
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:'array'});
  let count=0;
  for(const sheetName of wb.SheetNames){
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{defval:''});
    for(const raw of rows){
      const mapped=mapExcelRow(raw, sheetName);
      if(mapped.adresse){await upsertChantier(mapped); count++;}
    }
  }
  alert(`${count} ligne(s) importée(s) / mise(s) à jour.`);
  e.target.value='';
});
function findVal(raw, names){
  const entries=Object.entries(raw);
  for(const n of names){
    const hit=entries.find(([k])=>norm(k)===norm(n) || norm(k).includes(norm(n)));
    if(hit) return hit[1];
  }
  return '';
}
function mapExcelRow(raw, sheetName){
  return {
    adresse: findVal(raw,['adresse','chantier','chantiers','site','immeuble']) || Object.values(raw)[0] || '',
    cp: findVal(raw,['cp','code postal','ville','cp / ville']),
    client: findVal(raw,['client']) || sheetName,
    poubelle: findVal(raw,['poubelle','poubelles']),
    menage: findVal(raw,['menage','ménage']),
    gardiennage: findVal(raw,['gardiennage','gardien'])
  };
}
$('exportBtn').onclick=()=>{
  const lines=[['Client','Adresse','CP / Ville','Poubelle','Menage','Gardiennage'],...chantiers.map(c=>[c.client,c.adresse,c.cp,c.poubelle,c.menage,c.gardiennage])];
  const csv=lines.map(l=>l.map(v=>`"${String(v||'').replaceAll('"','""')}"`).join(';')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='kalnet_chantiers.csv'; a.click(); URL.revokeObjectURL(url);
};
