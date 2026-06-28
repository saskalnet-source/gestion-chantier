import { db } from './firebase.js';
import { initialData } from './initialData.js';
import { collection, addDoc, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $ = id => document.getElementById(id);
const chantiersRef = collection(db, 'chantiers');
const agentsRef = collection(db, 'agents');
let chantiers = [];
let agents = [];
let editingAgentId = null;

function norm(v){return (v||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ')}
function clean(v){return (v||'').toString().trim()}
function esc(s){return clean(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function toast(msg){$('toast').textContent=msg;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',2500)}
function agentByName(name){const n=norm(name);return agents.find(a=>norm(a.nom)===n)}
function agentPhone(name){return agentByName(name)?.telephone || ''}
function isRealAgentName(v){const n=norm(v);return n && !['poubelle','poubelles','menage','ménage','gardiennage','grdiennage','client','cp','adresse','adresses','chantier','chantiers'].includes(n)}
function chantierKey(c){return norm((c.client||'')+'|'+(c.adresse||c.chantier||''))}
function prestationNames(c){return [c.poubelle,c.menage,c.gardiennage].filter(isRealAgentName)}

onSnapshot(query(agentsRef, orderBy('nom')), snap=>{agents=snap.docs.map(d=>({id:d.id,...d.data()})); render();}, err=>{$('syncStatus').textContent='Erreur agents : '+err.message});
onSnapshot(query(chantiersRef, orderBy('client')), snap=>{chantiers=snap.docs.map(d=>({id:d.id,...d.data()}));$('syncStatus').textContent='Synchronisé avec Firebase';render();}, err=>{$('syncStatus').textContent='Erreur Firebase : '+err.message});

function fillAgentSelect(selectId, selected=''){
  $(selectId).innerHTML = '<option value="">Aucun</option>' + agents.map(a=>`<option value="${esc(a.nom)}" ${a.nom===selected?'selected':''}>${esc(a.nom)}</option>`).join('');
}
function fillFilters(){
  const cf=$('clientFilter').value, af=$('agentFilter').value;
  const clients=[...new Set(chantiers.map(c=>c.client).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  const ags=[...new Set(agents.map(a=>a.nom).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  $('clientFilter').innerHTML='<option value="">Tous</option>'+clients.map(v=>`<option ${v===cf?'selected':''}>${esc(v)}</option>`).join('');
  $('agentFilter').innerHTML='<option value="">Tous</option>'+ags.map(v=>`<option ${v===af?'selected':''}>${esc(v)}</option>`).join('');
  ['fPoubelle','fMenage','fGardiennage'].forEach(id=>fillAgentSelect(id,$(id).value));
  $('kClients').textContent=clients.length;$('kAgents').textContent=ags.length;
}
function phonesHtml(c){
  return prestationNames(c).map(name=>{const p=agentPhone(name);return `<div class="phone-block"><strong>${esc(name)}</strong>${p?`<a href="tel:${p.replace(/\s/g,'')}">📞 ${esc(p)}</a>`:'<span class="small">Numéro non renseigné</span>'}</div>`}).join('') || '<span class="small">Aucun agent</span>';
}
function filtered(){
  const q=norm($('search').value), client=$('clientFilter').value, agent=$('agentFilter').value, svc=$('serviceFilter').value;
  return chantiers.filter(c=>{
    const phoneBlob=prestationNames(c).map(agentPhone).join(' ');
    const blob=norm([c.adresse,c.cp,c.client,c.poubelle,c.menage,c.gardiennage,phoneBlob].join(' '));
    if(q && !blob.includes(q)) return false;
    if(client && c.client!==client) return false;
    if(agent && !prestationNames(c).includes(agent)) return false;
    if(svc && !isRealAgentName(c[svc])) return false;
    return true;
  });
}
function renderAgents(){
  $('agentList').innerHTML = agents.map(a=>`<div class="agent-card"><strong>${esc(a.nom)}</strong><small>${a.telephone?esc(a.telephone):'Téléphone non renseigné'}</small><div class="actions"><button class="secondary" onclick="editAgent('${a.id}')">Modifier</button><button class="danger" onclick="removeAgent('${a.id}')">Supprimer</button></div></div>`).join('') || '<div class="empty">Aucun agent. Importez un Excel ou ajoutez un agent.</div>';
}
function render(){
  fillFilters();renderAgents();
  const rows=filtered();$('kTotal').textContent=chantiers.length;$('kVisible').textContent=rows.length;
  $('tbody').innerHTML = rows.map(c=>`<tr><td><strong>${esc(c.adresse)}</strong><div class="small">Source : ${esc(c.source||'Ajout manuel')}</div></td><td>${esc(c.cp)}</td><td>${esc(c.poubelle)}</td><td>${esc(c.menage)}</td><td>${esc(c.gardiennage)}</td><td>${phonesHtml(c)}</td><td><span class="badge">${esc(c.client)}</span></td><td><div class="actions"><button class="secondary" onclick="editChantier('${c.id}')">Modifier</button><button class="danger" onclick="deleteChantier('${c.id}')">Supprimer</button></div></td></tr>`).join('') || '<tr><td colspan="8">Aucun chantier</td></tr>';
}

window.editAgent = id => {const a=agents.find(x=>x.id===id); if(!a)return; editingAgentId=id; $('agentName').value=a.nom||'';$('agentPhone').value=a.telephone||'';$('agentName').focus();}
window.removeAgent = async id => {
  const a=agents.find(x=>x.id===id); if(!a)return;
  const used=chantiers.filter(c=>prestationNames(c).some(n=>norm(n)===norm(a.nom)));
  if(used.length && !confirm(`L'agent ${a.nom} est affecté à ${used.length} chantier(s). Supprimer et vider ces affectations ?`)) return;
  const batch=writeBatch(db);
  used.forEach(c=>{const upd={}; ['poubelle','menage','gardiennage'].forEach(f=>{if(norm(c[f])===norm(a.nom)) upd[f]=''}); batch.update(doc(db,'chantiers',c.id),upd);});
  batch.delete(doc(db,'agents',id));
  await batch.commit(); toast('Agent supprimé');
}
$('saveAgentBtn').onclick = async () => {
  const nom=clean($('agentName').value).toUpperCase(), telephone=clean($('agentPhone').value);
  if(!nom) return alert('Saisissez le nom de l’agent');
  const duplicate=agents.find(a=>norm(a.nom)===norm(nom) && a.id!==editingAgentId);
  if(duplicate) return alert('Cet agent existe déjà');
  if(editingAgentId) await updateDoc(doc(db,'agents',editingAgentId),{nom,telephone,updatedAt:serverTimestamp()});
  else await addDoc(agentsRef,{nom,telephone,createdAt:serverTimestamp()});
  editingAgentId=null;$('agentName').value='';$('agentPhone').value='';toast('Agent enregistré');
}

function openModal(c=null){
  $('modalTitle').textContent=c?'Modifier le chantier':'Ajouter un chantier';$('editId').value=c?.id||'';$('fAdresse').value=c?.adresse||'';$('fCp').value=c?.cp||'';$('fClient').value=c?.client||'HNET';
  fillAgentSelect('fPoubelle',c?.poubelle||'');fillAgentSelect('fMenage',c?.menage||'');fillAgentSelect('fGardiennage',c?.gardiennage||'');$('modal').classList.add('open');$('fAdresse').focus();
}
function closeModal(){$('modal').classList.remove('open')}
window.editChantier = id => openModal(chantiers.find(c=>c.id===id));
window.deleteChantier = async id => {if(confirm('Supprimer ce chantier ?')){await deleteDoc(doc(db,'chantiers',id));toast('Chantier supprimé')}}
$('addBtn').onclick=()=>openModal();$('cancelBtn').onclick=closeModal;
$('saveBtn').onclick=async()=>{
  const item={adresse:clean($('fAdresse').value),cp:clean($('fCp').value),client:clean($('fClient').value)||'HNET',poubelle:$('fPoubelle').value,menage:$('fMenage').value,gardiennage:$('fGardiennage').value,source:'Ajout manuel',updatedAt:serverTimestamp()};
  if(!item.adresse) return alert('Saisissez une adresse');
  const id=$('editId').value;
  if(id) await updateDoc(doc(db,'chantiers',id),item); else await addDoc(chantiersRef,{...item,createdAt:serverTimestamp()});
  closeModal();toast('Chantier enregistré');
}

['search','clientFilter','agentFilter','serviceFilter'].forEach(id=>$(id).addEventListener('input',render));
$('importBtn').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{const f=e.target.files[0]; if(!f)return; await importFile(f); e.target.value='';};
$('exportBtn').onclick=exportCSV;$('seedBtn').onclick=seedInitialData;

async function ensureAgent(name,batch,existingKeys){
  if(!isRealAgentName(name)) return;
  const key=norm(name); if(existingKeys.has(key)) return;
  const ref=doc(agentsRef); batch.set(ref,{nom:clean(name).toUpperCase(),telephone:'',createdAt:serverTimestamp()}); existingKeys.add(key);
}
async function upsertChantiers(rows){
  const existing=new Map(chantiers.map(c=>[chantierKey(c),c.id]));
  const agentKeys=new Set(agents.map(a=>norm(a.nom)));
  let added=0, updated=0, newAgents=0;
  const batch=writeBatch(db);
  for(const r of rows){
    if(!r.adresse) continue;
    ['poubelle','menage','gardiennage'].forEach(f=>{ if(!isRealAgentName(r[f])) r[f]=''; });
    for(const name of prestationNames(r)){ const before=agentKeys.size; await ensureAgent(name,batch,agentKeys); if(agentKeys.size>before) newAgents++; }
    const key=chantierKey(r); const payload={...r,updatedAt:serverTimestamp()};
    if(existing.has(key)){batch.update(doc(db,'chantiers',existing.get(key)),payload); updated++;}
    else {batch.set(doc(chantiersRef),{...payload,createdAt:serverTimestamp()}); added++;}
  }
  await batch.commit(); toast(`${added} ajoutés, ${updated} mis à jour, ${newAgents} agents créés`);
}
async function seedInitialData(){ if(!confirm('Charger la liste de départ dans Firebase ? Les doublons seront mis à jour.')) return; await upsertChantiers(initialData); }

async function importFile(file){
  const buf=await file.arrayBuffer(); const wb=XLSX.read(buf,{type:'array'}); const rows=[];
  for(const sheetName of wb.SheetNames){
    const ws=wb.Sheets[sheetName]; const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
    let headerIndex=matrix.findIndex(row=>row.some(v=>['adresse','adresses','chantier','chantiers'].includes(norm(v))));
    if(headerIndex<0) continue;
    const headers=matrix[headerIndex].map(norm);
    const findCol=(names)=>headers.findIndex(h=>names.includes(h));
    const cAdresse=findCol(['adresse','adresses','chantier','chantiers']); const cCp=findCol(['cp','ville','cp / ville']); const cP=findCol(['poubelle','poubelles']); const cM=findCol(['menage','ménage']); const cG=findCol(['gardiennage','grdiennage']); const cClient=findCol(['client','clients']);
    const sheetClient=(matrix[0]?.[0]||sheetName).toString().replace(/^client:\s*/i,'').trim() || sheetName;
    for(let i=headerIndex+1;i<matrix.length;i++){
      const row=matrix[i]; const adresse=clean(row[cAdresse]); if(!adresse || ['adresse','adresses','chantier','chantiers'].includes(norm(adresse))) continue;
      rows.push({adresse,cp:cCp>=0?clean(row[cCp]):'',poubelle:cP>=0?clean(row[cP]):'',menage:cM>=0?clean(row[cM]):'',gardiennage:cG>=0?clean(row[cG]):'',client:cClient>=0?clean(row[cClient])||sheetClient:sheetClient,source:sheetName});
    }
  }
  if(!rows.length) return alert('Aucune ligne reconnue dans ce fichier');
  if(confirm(`${rows.length} lignes détectées. Importer dans Firebase ?`)) await upsertChantiers(rows);
}
function exportCSV(){
  const lines=[['Client','Adresse','CP / Ville','Poubelle','Ménage','Gardiennage'],...chantiers.map(c=>[c.client,c.adresse,c.cp,c.poubelle,c.menage,c.gardiennage])];
  const csv=lines.map(l=>l.map(v=>`"${clean(v).replaceAll('"','""')}"`).join(';')).join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); a.download='kalnet_chantiers.csv'; a.click();
}
