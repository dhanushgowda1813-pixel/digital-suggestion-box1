const appPanel=document.getElementById('panel');
const toastEl=document.getElementById('toast');
const statuses=['Submitted','Under Review','In Progress','Resolved'];
let currentView='';
function toast(msg){toastEl.textContent=msg;toastEl.classList.add('show');setTimeout(()=>toastEl.classList.remove('show'),3200)}
async function api(url,options={}){const res=await fetch(url,{...options,headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(options.headers||{})}});let data={};try{data=await res.json()}catch{}if(!res.ok)throw new Error(data.error||'Something went wrong.');return data}
function view(name){currentView=name;const views={'submit':submitView,'login':loginView,'register':registerView,'admin-login':adminLoginView,'track':trackView,'admin':adminView};(views[name]||homeView)()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b){e.preventDefault();view(b.dataset.view)}});
function shell(title,lead,body,wide=false){appPanel.innerHTML=`<div class="panel ${wide?'wide':''}"><button class="back" data-view="home">← Back to home</button><h2>${title}</h2><p class="lead">${lead}</p>${body}</div>`;appPanel.scrollIntoView({behavior:'smooth',block:'start'})}
function homeView(){appPanel.innerHTML=''}
