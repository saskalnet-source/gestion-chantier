import { initialChantiers, initialAgents } from './initialData.js';
import {
  db, collection, doc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, writeBatch, serverTimestamp
} from './firebase.js';

const $ = (id) => document.getElementById(id);
const refs = {
  agents: collection(db, 'agents'),
  chantiers: collection(db, 'chantiers'),
  metaSeed: doc(db, 'meta', 'seed')
};

let agents = [];
let chantiers = [];
let readyAgents = false;
let readyChantiers = false;

function norm(v){return (v||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();}
function agentKey(v){return norm(v).replace(/\s+/g,' ');}
function escapeHtml(s){return (s||'').toString().replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function toast(msg){const t=$('toast');t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',2500);}
function agentByName(name){const k=agentKey(name);return agents.find(a=>agentKey(a.nom)===k);}
function phoneLink(agentName){
  if(!agentName) return '<span class="empty">Aucun agent</span>';
  const ag = agentByName(agentName);
  const phone = ag?.telephone || '';
  if(!phone) return `<span class="agent">${escapeHtml(agentName)}<br><span class="empty">Téléphone non renseigné</span></span>`;
  const href = phone.replace(/\s+/g,'');
  return `<span class="agent">${escapeHtml(agentName)}<br><a href="tel:${escapeHtml(href)}">📞 ${escapeHtml(phone)}</a></span>`;
}
function selectOptions(selected=''){
  const opts = ['<option value="">Aucun</option>'];
  agents.forEach(a=>opts.push(`<option value="${escapeHtml(a.nom)}" ${a.nom===selected?'selected':''}>${escapeHtml(a.nom)}</option>`));
  return opts.join('');
}
function chantierAgents(c){return [c.poubelle,c.menage,c.gardiennage].filter(Boolean);}
function unique(arr){return [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));}
function filteredChantiers(){
  const q=norm($('search').value); const fa=$('agentFilter').value; const fc=$('clientFilter').value;
  return chantiers.filter(c=>{
    const phones = chantierAgents(c).map(a=>agentByName(a)?.telephone||'').join(' ');
    const blob=norm([c.adresse,c.ville,c.client,c.poubelle,c.menage,c.gardiennage,phones].join(' '));
    if(q && !blob.includes(q)) return false;
    if(fa && !chantierAgents(c).includes(fa)) return false;
    if(fc && c.client !== fc) return false;
    return true;
  });
}
function renderFilters(){
  const currentA=$('agentFilter').value, currentC=$('clientFilter').value;
  $('agentFilter').innerHTML='<option value="">Tous</option>'+agents.map(a=>`<option ${a.nom===currentA?'selected':''}>${escapeHtml(a.nom)}</option>`).join('');
  const clients=unique(chantiers.map(c=>c.client));
  $('clientFilter').innerHTML='<option value="">Tous</option>'+clients.map(c=>`<option ${c===currentC?'selected':''}>${escapeHtml(c)}</option>`).join('');
}
function renderAgentSelects(){
  ['poubelle','menage','gardiennage'].forEach(id=>$(id).innerHTML=selectOptions($(id).value));
}
function renderAgents(){
  $('kAgents').textContent = agents.length;
  $('agentList').innerHTML = agents.map(a=>`
    <div class="agent-card">
      <strong>${escapeHtml(a.nom)}</strong>
      <div class="phone">${a.telephone ? '📞 '+escapeHtml(a.telephone) : '<span class="empty">Téléphone non renseigné</span>'}</div>
      <div class="mini-actions">
        <button class="secondary" data-edit-agent="${a.id}">Modifier</button>
        <button class="danger" data-delete-agent="${a.id}">Supprimer</button>
      </div>
    </div>
  `).join('') || '<p class="empty">Aucun agent. Ajoutez votre premier agent.</p>';
}
function renderChantiers(){
  const rows=filteredChantiers();
  $('kChantiers').textContent=chantiers.length;
  $('kVisible').textContent=rows.length;
  $('chantierList').innerHTML = rows.map(c=>`
    <article class="chantier-card">
      <h3>${escapeHtml(c.adresse)}</h3>
      <div class="meta">${escapeHtml(c.ville||'')} ${c.client?`<span class="client">${escapeHtml(c.client)}</span>`:''}</div>
      <div class="prestations">
        <div class="presta"><b>🗑️ Poubelle</b><br>${phoneLink(c.poubelle)}</div>
        <div class="presta"><b>🧹 Ménage</b><br>${phoneLink(c.menage)}</div>
        <div class="presta"><b>👷 Gardiennage</b><br>${phoneLink(c.gardiennage)}</div>
      </div>
      <div class="mini-actions">
        <button class="secondary" data-edit-chantier="${c.id}">Modifier</button>
        <button class="danger" data-delete-chantier="${c.id}">Supprimer</button>
      </div>
    </article>
  `).join('') || '<p class="empty">Aucun chantier trouvé.</p>';
}
function render(){renderFilters();renderAgentSelects();renderAgents();renderChantiers();}

async function seedIfEmpty(){
  const [agSnap, chSnap] = await Promise.all([getDocs(refs.agents), getDocs(refs.chantiers)]);
  if(!agSnap.empty || !chSnap.empty) return;
  const batch = writeBatch(db);
  initialAgents.forEach(a=>batch.set(doc(refs.agents), {nom:a.nom, telephone:a.telephone||'', createdAt:serverTimestamp()}));
  initialChantiers.forEach(c=>batch.set(doc(refs.chantiers), {...c, createdAt:serverTimestamp()}));
  await batch.commit();
  toast('Données initiales importées');
}

onSnapshot(refs.agents, snap=>{
  agents = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.nom||'').localeCompare(b.nom||'','fr'));
  readyAgents=true; if(readyChantiers) $('syncStatus').textContent='Synchronisé avec Firebase'; render();
}, err=>{$('syncStatus').textContent='Erreur Firebase agents'; console.error(err);});

onSnapshot(refs.chantiers, snap=>{
  chantiers = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.adresse||'').localeCompare(b.adresse||'','fr'));
  readyChantiers=true; if(readyAgents) $('syncStatus').textContent='Synchronisé avec Firebase'; render();
}, err=>{$('syncStatus').textContent='Erreur Firebase chantiers'; console.error(err);});

seedIfEmpty().catch(e=>{console.error(e); $('syncStatus').textContent='Erreur import initial';});

$('agentForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id=$('agentId').value;
  const nom=$('agentName').value.trim().toUpperCase();
  const telephone=$('agentPhone').value.trim();
  if(!nom) return;
  const existing=agents.find(a=>agentKey(a.nom)===agentKey(nom) && a.id!==id);
  if(existing) return alert('Cet agent existe déjà. Modifiez sa fiche si besoin.');
  if(id) await updateDoc(doc(refs.agents,id), {nom, telephone, updatedAt:serverTimestamp()});
  else await addDoc(refs.agents, {nom, telephone, createdAt:serverTimestamp()});
  $('agentForm').reset(); $('agentId').value=''; toast('Agent enregistré');
});
$('clearAgentBtn').onclick=()=>{$('agentForm').reset();$('agentId').value='';};

$('agentList').addEventListener('click', async (e)=>{
  const edit=e.target.dataset.editAgent, del=e.target.dataset.deleteAgent;
  if(edit){const a=agents.find(x=>x.id===edit); if(!a)return; $('agentId').value=a.id; $('agentName').value=a.nom||''; $('agentPhone').value=a.telephone||''; $('agentName').focus();}
  if(del){
    const a=agents.find(x=>x.id===del); if(!a)return;
    const used=chantiers.filter(c=>chantierAgents(c).some(n=>agentKey(n)===agentKey(a.nom))).length;
    const msg=used?`Cet agent est affecté à ${used} chantier(s). Supprimer l'agent et retirer ses affectations ?`:'Supprimer cet agent ?';
    if(!confirm(msg)) return;
    const batch=writeBatch(db);
    chantiers.forEach(c=>{
      const patch={}; ['poubelle','menage','gardiennage'].forEach(k=>{if(agentKey(c[k])===agentKey(a.nom)) patch[k]='';});
      if(Object.keys(patch).length) batch.update(doc(refs.chantiers,c.id), patch);
    });
    batch.delete(doc(refs.agents,del));
    await batch.commit(); toast('Agent supprimé');
  }
});

function openChantier(c=null){
  $('chantierId').value=c?.id||'';
  $('dialogTitle').textContent=c?'Modifier le chantier':'Ajouter un chantier';
  $('adresse').value=c?.adresse||''; $('ville').value=c?.ville||''; $('client').value=c?.client||'';
  renderAgentSelects(); $('poubelle').value=c?.poubelle||''; $('menage').value=c?.menage||''; $('gardiennage').value=c?.gardiennage||'';
  $('chantierDialog').showModal();
}
$('newChantierBtn').onclick=()=>openChantier();
$('cancelChantierBtn').onclick=()=>$('chantierDialog').close();
$('chantierForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id=$('chantierId').value;
  const row={
    adresse:$('adresse').value.trim(), ville:$('ville').value.trim(), client:$('client').value.trim(),
    poubelle:$('poubelle').value, menage:$('menage').value, gardiennage:$('gardiennage').value,
    updatedAt:serverTimestamp()
  };
  if(!row.adresse) return alert('Adresse obligatoire');
  if(id) await updateDoc(doc(refs.chantiers,id), row);
  else await addDoc(refs.chantiers, {...row, createdAt:serverTimestamp()});
  $('chantierDialog').close(); toast('Chantier enregistré');
});
$('chantierList').addEventListener('click', async (e)=>{
  const edit=e.target.dataset.editChantier, del=e.target.dataset.deleteChantier;
  if(edit){const c=chantiers.find(x=>x.id===edit); if(c) openChantier(c);}
  if(del && confirm('Supprimer ce chantier ?')){ await deleteDoc(doc(refs.chantiers,del)); toast('Chantier supprimé'); }
});

['search','agentFilter','clientFilter'].forEach(id=>$(id).addEventListener('input', render));

$('importBtn').onclick=()=>$('importFile').click();
$('importFile').addEventListener('change', async (e)=>{
  const file=e.target.files[0]; if(!file) return;
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:'array'});
  const imported=[]; const foundAgents=new Set();
  wb.SheetNames.forEach(sheetName=>{
    const ws=wb.Sheets[sheetName];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
    const headerIndex=rows.findIndex(r=>r.some(v=>['adresse','chantiers','chantier'].includes(norm(v))));
    if(headerIndex<0) return;
    const headers=rows[headerIndex].map(norm);
    const find=(names)=>headers.findIndex(h=>names.some(n=>h.includes(n)));
    const cAdresse=find(['adresse','chantier']); const cVille=find(['cp','ville']); const cPoub=find(['poubelle']); const cMen=find(['menage','ménage']); const cGard=find(['gardien']); const cClient=find(['client']);
    rows.slice(headerIndex+1).forEach(r=>{
      const val=i=>i>=0?(r[i]||'').toString().trim():'';
      const adresse=val(cAdresse); if(!adresse || ['adresse','chantiers','chantier'].includes(norm(adresse))) return;
      const item={adresse, ville:val(cVille), client:val(cClient)||sheetName, poubelle:val(cPoub), menage:val(cMen), gardiennage:val(cGard)};
      ['poubelle','menage','gardiennage'].forEach(k=>{ if(item[k] && !['poubelle','menage','ménage','gardiennage'].includes(norm(item[k]))) foundAgents.add(item[k].toUpperCase()); });
      imported.push(item);
    });
  });
  if(!imported.length) return alert('Aucun chantier trouvé dans ce fichier.');
  if(!confirm(`${imported.length} chantier(s) trouvés. Importer / mettre à jour ?`)) return;
  const batch=writeBatch(db);
  foundAgents.forEach(n=>{ if(!agents.some(a=>agentKey(a.nom)===agentKey(n))) batch.set(doc(refs.agents), {nom:n, telephone:'', createdAt:serverTimestamp()}); });
  imported.forEach(item=>{
    const existing=chantiers.find(c=>agentKey(c.adresse)===agentKey(item.adresse) && agentKey(c.client)===agentKey(item.client));
    if(existing) batch.update(doc(refs.chantiers,existing.id), {...item, updatedAt:serverTimestamp()});
    else batch.set(doc(refs.chantiers), {...item, createdAt:serverTimestamp()});
  });
  await batch.commit(); e.target.value=''; toast('Import terminé');
});

$('exportBtn').onclick=()=>{
  const lines=[['Client','Adresse','CP / Ville','Poubelle','Téléphone poubelle','Ménage','Téléphone ménage','Gardiennage','Téléphone gardiennage']];
  chantiers.forEach(c=>lines.push([c.client||'',c.adresse||'',c.ville||'',c.poubelle||'',agentByName(c.poubelle)?.telephone||'',c.menage||'',agentByName(c.menage)?.telephone||'',c.gardiennage||'',agentByName(c.gardiennage)?.telephone||'']));
  const csv=lines.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='kalnet_chantiers.csv'; a.click(); URL.revokeObjectURL(url);
};
