import { initialChantiers, initialAgents } from './initialData.js';
import {
  db, collection, doc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, writeBatch, serverTimestamp
} from './firebase.js';

const $ = (id) => document.getElementById(id);
const refs = {
  agents: collection(db, 'agents'),
  chantiers: collection(db, 'chantiers')
};
let agents = [];
let chantiers = [];
let readyAgents = false;
let readyChantiers = false;

const PRESTATION_LABELS = ['poubelle','menage','ménage','gardiennage','gardien','agent','agents','prestation','prestations'];
function norm(v){return (v||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();}
function clean(v){return (v||'').toString().trim();}
function agentKey(v){return norm(v).replace(/\s+/g,' ');}
function escapeHtml(s){return (s||'').toString().replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function toast(msg){const t=$('toast');t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',2500);}
function isHeaderValue(v){return PRESTATION_LABELS.includes(norm(v)) || ['adresse','adresses','chantier','chantiers','cp','ville','client','nom du client'].includes(norm(v));}
function addressOf(c){return clean(c.adresse || c.Adresse || c.ADRESSE || c.chantier || c.Chantier || c.CHANTIER || c['Adresse du chantier'] || c['adresse du chantier'] || c.adress || c.address || c.nom || '');}
function villeOf(c){return clean(c.ville || c.Ville || c.VILLE || c.cp || c.CP || c.codePostal || c.code_postal || '');}
function clientOf(c){return clean(c.client || c.Client || c.CLIENT || c.source || c.Source || '');}
function prestationOf(c,k){return isHeaderValue(c[k]) ? '' : clean(c[k]);}
function agentByName(name){const k=agentKey(name);return agents.find(a=>agentKey(a.nom)===k);}
function chantierAgents(c){return ['poubelle','menage','gardiennage'].map(k=>prestationOf(c,k)).filter(Boolean);}
function unique(arr){return [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'))}
function phoneLink(agentName){
  if(!agentName) return '<span class="empty">Aucun agent</span>';
  const ag = agentByName(agentName);
  const phone = ag?.telephone || '';
  if(!phone) return `<span class="agent">${escapeHtml(agentName)}<br><span class="empty">Téléphone non renseigné</span></span>`;
  const href = phone.replace(/\s+/g,'');
  return `<span class="agent">${escapeHtml(agentName)}<br><a href="tel:${escapeHtml(href)}">📞 ${escapeHtml(phone)}</a></span>`;
}
function selectOptions(selected=''){
  return '<option value="">Aucun</option>' + agents.map(a=>`<option value="${escapeHtml(a.nom)}" ${a.nom===selected?'selected':''}>${escapeHtml(a.nom)}</option>`).join('');
}
function filteredChantiers(){
  const q=norm($('search').value); const fa=$('agentFilter').value; const fc=$('clientFilter').value;
  return chantiers.filter(c=>{
    const phones=chantierAgents(c).map(a=>agentByName(a)?.telephone||'').join(' ');
    const blob=norm([addressOf(c), villeOf(c), clientOf(c), ...chantierAgents(c), phones].join(' '));
    if(q && !blob.includes(q)) return false;
    if(fa && !chantierAgents(c).includes(fa)) return false;
    if(fc && clientOf(c)!==fc) return false;
    return true;
  });
}
function renderFilters(){
  const currentA=$('agentFilter').value, currentC=$('clientFilter').value;
  $('agentFilter').innerHTML='<option value="">Tous</option>'+agents.map(a=>`<option ${a.nom===currentA?'selected':''}>${escapeHtml(a.nom)}</option>`).join('');
  const clients=unique(chantiers.map(clientOf));
  $('clientFilter').innerHTML='<option value="">Tous</option>'+clients.map(c=>`<option ${c===currentC?'selected':''}>${escapeHtml(c)}</option>`).join('');
}
function renderAgentSelects(){['poubelle','menage','gardiennage'].forEach(id=>$(id).innerHTML=selectOptions($(id).value));}
function renderAgents(){
  $('kAgents').textContent=agents.length;
  $('agentList').innerHTML=agents.map(a=>`
    <div class="agent-card">
      <strong>${escapeHtml(a.nom)}</strong>
      <div class="phone">${a.telephone ? '📞 '+escapeHtml(a.telephone) : '<span class="empty">Téléphone non renseigné</span>'}</div>
      <div class="mini-actions"><button class="secondary" data-edit-agent="${a.id}">Modifier</button><button class="danger" data-delete-agent="${a.id}">Supprimer</button></div>
    </div>`).join('') || '<p class="empty">Aucun agent.</p>';
}
function renderChantiers(){
  const rows=filteredChantiers();
  $('kChantiers').textContent=chantiers.length; $('kVisible').textContent=rows.length;
  $('chantierList').innerHTML=rows.map(c=>{
    const adresse=addressOf(c) || 'Adresse non renseignée';
    return `<article class="chantier-card">
      <h3>📍 ${escapeHtml(adresse)}</h3>
      <div class="meta">${escapeHtml(villeOf(c))} ${clientOf(c)?`<span class="client">${escapeHtml(clientOf(c))}</span>`:''}</div>
      <div class="prestations">
        <div class="presta"><b>🗑️ Poubelle</b><br>${phoneLink(prestationOf(c,'poubelle'))}</div>
        <div class="presta"><b>🧹 Ménage</b><br>${phoneLink(prestationOf(c,'menage'))}</div>
        <div class="presta"><b>👷 Gardiennage</b><br>${phoneLink(prestationOf(c,'gardiennage'))}</div>
      </div>
      <div class="mini-actions"><button class="secondary" data-edit-chantier="${c.id}">Modifier</button><button class="danger" data-delete-chantier="${c.id}">Supprimer</button></div>
    </article>`;
  }).join('') || '<p class="empty">Aucun chantier trouvé.</p>';
}
function render(){renderFilters();renderAgentSelects();renderAgents();renderChantiers();}


async function resetChantiersAvecAdressesInitiales(){
  if(!confirm('Cette action va remplacer la liste des chantiers dans Firebase par la liste initiale avec les vraies adresses. Continuer ?')) return;
  const snap = await getDocs(refs.chantiers);
  let batch = writeBatch(db);
  let count = 0;
  snap.docs.forEach(d=>{ batch.delete(doc(refs.chantiers,d.id)); count++; if(count%400===0){ /* limite batch Firebase */ } });
  // Si beaucoup de docs, on fait simple par paquets
  if(count > 0) await batch.commit();
  batch = writeBatch(db);
  initialChantiers.forEach((c,i)=>{
    batch.set(doc(refs.chantiers, String(c.id || i+1)), {
      adresse: addressOf(c),
      ville: villeOf(c),
      client: clientOf(c),
      poubelle: prestationOf(c,'poubelle'),
      menage: prestationOf(c,'menage'),
      gardiennage: prestationOf(c,'gardiennage'),
      createdAt: serverTimestamp()
    });
  });
  await batch.commit();
  toast('Adresses des chantiers réimportées');
}

async function seedIfEmpty(){
  const [agSnap,chSnap]=await Promise.all([getDocs(refs.agents),getDocs(refs.chantiers)]);
  if(!agSnap.empty || !chSnap.empty) return;
  const batch=writeBatch(db);
  initialAgents.forEach(a=>batch.set(doc(refs.agents), {nom:a.nom, telephone:a.telephone||'', createdAt:serverTimestamp()}));
  initialChantiers.forEach((c,i)=>batch.set(doc(refs.chantiers, String(c.id || i+1)), {adresse:addressOf(c), ville:villeOf(c), client:clientOf(c), poubelle:prestationOf(c,'poubelle'), menage:prestationOf(c,'menage'), gardiennage:prestationOf(c,'gardiennage'), createdAt:serverTimestamp()}));
  await batch.commit(); toast('Adresses initiales importées');
}

onSnapshot(refs.agents, snap=>{agents=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.nom||'').localeCompare(b.nom||'','fr')); readyAgents=true; if(readyChantiers)$('syncStatus').textContent='Synchronisé avec Firebase'; render();}, err=>{console.error(err);$('syncStatus').textContent='Erreur Firebase agents';});
onSnapshot(refs.chantiers, snap=>{chantiers=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>addressOf(a).localeCompare(addressOf(b),'fr')); readyChantiers=true; if(readyAgents)$('syncStatus').textContent='Synchronisé avec Firebase'; render();}, err=>{console.error(err);$('syncStatus').textContent='Erreur Firebase chantiers';});
seedIfEmpty().catch(e=>{console.error(e);$('syncStatus').textContent='Erreur import initial';});

$('agentForm').addEventListener('submit', async e=>{
  e.preventDefault(); const id=$('agentId').value; const nom=clean($('agentName').value).toUpperCase(); const telephone=clean($('agentPhone').value);
  if(!nom) return; const existing=agents.find(a=>agentKey(a.nom)===agentKey(nom)&&a.id!==id); if(existing) return alert('Cet agent existe déjà.');
  if(id) await updateDoc(doc(refs.agents,id), {nom, telephone, updatedAt:serverTimestamp()}); else await addDoc(refs.agents,{nom,telephone,createdAt:serverTimestamp()});
  $('agentForm').reset(); $('agentId').value=''; toast('Agent enregistré');
});
$('clearAgentBtn').onclick=()=>{$('agentForm').reset();$('agentId').value='';};
$('agentList').addEventListener('click', async e=>{
  const edit=e.target.dataset.editAgent, del=e.target.dataset.deleteAgent;
  if(edit){const a=agents.find(x=>x.id===edit); if(!a)return; $('agentId').value=a.id; $('agentName').value=a.nom||''; $('agentPhone').value=a.telephone||''; $('agentName').focus();}
  if(del){const a=agents.find(x=>x.id===del); if(!a)return; const used=chantiers.filter(c=>chantierAgents(c).some(n=>agentKey(n)===agentKey(a.nom))).length; if(!confirm(used?`Cet agent est affecté à ${used} chantier(s). Supprimer et retirer ses affectations ?`:'Supprimer cet agent ?'))return; const batch=writeBatch(db); chantiers.forEach(c=>{const patch={}; ['poubelle','menage','gardiennage'].forEach(k=>{if(agentKey(c[k])===agentKey(a.nom))patch[k]='';}); if(Object.keys(patch).length) batch.update(doc(refs.chantiers,c.id),patch);}); batch.delete(doc(refs.agents,del)); await batch.commit(); toast('Agent supprimé');}
});
function openChantier(c=null){$('chantierId').value=c?.id||''; $('dialogTitle').textContent=c?'Modifier le chantier':'Ajouter un chantier'; $('adresse').value=c?addressOf(c):''; $('ville').value=c?villeOf(c):''; $('client').value=c?clientOf(c):''; renderAgentSelects(); $('poubelle').value=c?prestationOf(c,'poubelle'):''; $('menage').value=c?prestationOf(c,'menage'):''; $('gardiennage').value=c?prestationOf(c,'gardiennage'):''; $('chantierDialog').showModal();}
$('newChantierBtn').onclick=()=>openChantier(); $('cancelChantierBtn').onclick=()=>$('chantierDialog').close();
$('chantierForm').addEventListener('submit', async e=>{e.preventDefault(); const id=$('chantierId').value; const row={adresse:clean($('adresse').value), ville:clean($('ville').value), client:clean($('client').value), poubelle:$('poubelle').value, menage:$('menage').value, gardiennage:$('gardiennage').value, updatedAt:serverTimestamp()}; if(!row.adresse)return alert('Adresse obligatoire'); if(id)await updateDoc(doc(refs.chantiers,id),row); else await addDoc(refs.chantiers,{...row,createdAt:serverTimestamp()}); $('chantierDialog').close(); toast('Chantier enregistré');});
$('chantierList').addEventListener('click', async e=>{const edit=e.target.dataset.editChantier, del=e.target.dataset.deleteChantier; if(edit){const c=chantiers.find(x=>x.id===edit); if(c)openChantier(c);} if(del&&confirm('Supprimer ce chantier ?')){await deleteDoc(doc(refs.chantiers,del)); toast('Chantier supprimé');}});
['search','agentFilter','clientFilter'].forEach(id=>$(id).addEventListener('input', render));

$('importBtn').onclick=()=>$('importFile').click();
$('importFile').addEventListener('change', async e=>{
  const file=e.target.files[0]; if(!file)return; const buf=await file.arrayBuffer(); const wb=XLSX.read(buf,{type:'array'}); const imported=[]; const foundAgents=new Set();
  wb.SheetNames.forEach(sheetName=>{const ws=wb.Sheets[sheetName]; const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''}); let headerIndex=rows.findIndex(r=>r.some(v=>['adresse','adresses','chantier','chantiers'].includes(norm(v)))); if(headerIndex<0) headerIndex=0; const headers=rows[headerIndex].map(norm); const find=(names)=>headers.findIndex(h=>names.some(n=>h.includes(n))); let cAdresse=find(['adresse','chantier']); if(cAdresse<0) cAdresse=0; const cVille=find(['cp','ville']); const cPoub=find(['poubelle']); const cMen=find(['menage','ménage']); const cGard=find(['gardien']); const cClient=find(['client']); rows.slice(headerIndex+1).forEach(r=>{const val=i=>i>=0?clean(r[i]):''; const adresse=val(cAdresse); if(!adresse || isHeaderValue(adresse))return; const item={adresse, ville:val(cVille), client:val(cClient)||sheetName, poubelle:val(cPoub), menage:val(cMen), gardiennage:val(cGard)}; ['poubelle','menage','gardiennage'].forEach(k=>{if(item[k] && !isHeaderValue(item[k])) foundAgents.add(item[k].toUpperCase()); else if(isHeaderValue(item[k])) item[k]='';}); imported.push(item);});});
  if(!imported.length) return alert('Aucun chantier trouvé dans ce fichier. Vérifiez la colonne Adresse.');
  if(!confirm(`Importer ${imported.length} chantier(s) ?`)) return;
  const batch=writeBatch(db); const existingKeys=new Map(chantiers.map(c=>[norm(clientOf(c)+'|'+addressOf(c)),c]));
  imported.forEach(item=>{const key=norm(item.client+'|'+item.adresse); const ex=existingKeys.get(key); if(ex) batch.update(doc(refs.chantiers,ex.id), {...item,updatedAt:serverTimestamp()}); else batch.set(doc(refs.chantiers), {...item,createdAt:serverTimestamp()});});
  foundAgents.forEach(n=>{if(!agents.some(a=>agentKey(a.nom)===agentKey(n))) batch.set(doc(refs.agents), {nom:n, telephone:'', createdAt:serverTimestamp()});});
  await batch.commit(); e.target.value=''; toast('Import terminé');
});
$('resetChantiersBtn').onclick=()=>resetChantiersAvecAdressesInitiales().catch(e=>{console.error(e); alert('Erreur réimport adresses : '+e.message);});

$('exportBtn').onclick=()=>{const rows=[['Client','Adresse','Ville','Poubelle','Ménage','Gardiennage'],...chantiers.map(c=>[clientOf(c),addressOf(c),villeOf(c),prestationOf(c,'poubelle'),prestationOf(c,'menage'),prestationOf(c,'gardiennage')])]; const csv=rows.map(r=>r.map(v=>`"${String(v||'').replaceAll('"','""')}"`).join(';')).join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='kalnet_chantiers.csv'; a.click(); URL.revokeObjectURL(url);};


async function resetInitialAdresses(){
  if(!confirm('Cette action va remplacer la liste actuelle des chantiers par les adresses initiales. Les agents et téléphones seront conservés. Continuer ?')) return;
  $('syncStatus').textContent='Réimport des adresses en cours...';
  const current = await getDocs(refs.chantiers);
  let batch = writeBatch(db);
  let count = 0;
  current.docs.forEach(d=>{ batch.delete(doc(refs.chantiers,d.id)); count++; if(count>=450){ /* Firestore max 500 writes, but not reached here normalement */ } });
  await batch.commit();
  const batch2 = writeBatch(db);
  const newAgents = new Set();
  initialChantiers.forEach(c=>{
    const row = {adresse:addressOf(c), ville:villeOf(c), client:clientOf(c), poubelle:prestationOf(c,'poubelle'), menage:prestationOf(c,'menage'), gardiennage:prestationOf(c,'gardiennage'), createdAt:serverTimestamp()};
    ['poubelle','menage','gardiennage'].forEach(k=>{ if(row[k]) newAgents.add(row[k].toUpperCase()); });
    batch2.set(doc(refs.chantiers, 'initial_'+(c.id||Math.random().toString(36).slice(2))), row);
  });
  newAgents.forEach(n=>{ if(!agents.some(a=>agentKey(a.nom)===agentKey(n))) batch2.set(doc(refs.agents), {nom:n, telephone:'', createdAt:serverTimestamp()}); });
  await batch2.commit();
  toast('Adresses réimportées');
}
const resetBtn = $('resetInitialBtn');
if(resetBtn) resetBtn.onclick = resetInitialAdresses;
