
const appPanel=document.getElementById('panel');
const toastEl=document.getElementById('toast');
const statuses=['Submitted','Under Review','In Progress','Resolved'];
let currentView='';

function toast(msg){
  toastEl.textContent=msg;
  toastEl.classList.add('show');
  setTimeout(()=>toastEl.classList.remove('show'),3200)
}

async function api(url,options={}){
  const res=await fetch(url,{
    ...options,
    headers:{
      ...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),
      ...(options.headers||{})
    }
  });
  let data={};
  try{data=await res.json()}catch{}
  if(!res.ok)throw new Error(data.error||'Something went wrong.');
  return data
}

async function view(name){
  currentView=name;

  if(name==='submit'){
    try{
      const session=await api('/api/session');

      if(session.role!=='citizen'){
        try{sessionStorage.setItem('dsb-after-auth','submit')}catch{}
        loginView();
        return
      }
    }catch{
      try{sessionStorage.setItem('dsb-after-auth','submit')}catch{}
      loginView();
      return
    }
  }

  const views={
    'submit':submitView,
    'login':loginView,
    'register':registerView,
    'admin-login':adminLoginView,
    'track':trackView,
    'admin':adminView
  };

  (views[name]||homeView)()
}

document.addEventListener('click',e=>{
  const toggle=e.target.closest('[data-toggle-password]');
  if(toggle){
    const input=document.getElementById(toggle.dataset.togglePassword);
    if(input){
      const showing=input.type==='password';
      input.type=showing?'text':'password';
      toggle.textContent='👁';
      toggle.setAttribute('aria-label',showing?'Hide password':'Show password');
      toggle.title=showing?'Hide password':'Show password';
    }
    return;
  }
});

document.addEventListener('click',e=>{
  const b=e.target.closest('[data-view]');
  if(b){
    e.preventDefault();
    view(b.dataset.view)
  }
});

function shell(title,lead,body,wide=false){
  appPanel.innerHTML=`
    <div class="panel ${wide?'wide':''}">
      <button class="back" data-view="home">← Back to home</button>
      <h2>${title}</h2>
      <p class="lead">${lead}</p>
      ${body}
    </div>`;
  appPanel.scrollIntoView({behavior:'smooth',block:'start'})
}

function homeView(){
  appPanel.innerHTML=''
}

function submitView(){
  shell(
    'Share a suggestion',
    'Help improve your neighbourhood. Your name is optional; a supporting photo is required.',
    `<form id="suggestionForm">
      <div class="formgrid">

        <div class="field">
          <label>Full name <span class="optional-label">(optional)</span></label>
          <input name="name" maxlength="90" placeholder="You may leave this blank">
        </div>

        <div class="field">
          <label>Category *</label>
          <select name="category" required>
            <option value="">Choose category</option>
            <option>Roads</option>
            <option>Water supply</option>
            <option>Waste management</option>
            <option>Street lights</option>
            <option>Public safety</option>
            <option>Public transport</option>
            <option>Other</option>
          </select>
        </div>

        <div class="field full">
          <label>Area / locality *</label>
          <input name="area" required maxlength="180" placeholder="Neighbourhood or ward">

          <button
            type="button"
            class="btn light"
            id="getLocation"
            style="margin-top:8px">
            Use my current location
          </button>

          <span id="locationStatus" class="hint" aria-live="polite">
            Allow location access to fetch your address.
          </span>

          <div id="locationDetails" class="location-details" hidden>
            <p><strong>Full address:</strong> <span id="locFullAddress"></span></p>
            <p><strong>Area:</strong> <span id="locArea"></span></p>
            <p><strong>City:</strong> <span id="locCity"></span></p>
            <p><strong>District:</strong> <span id="locDistrict"></span></p>
            <p><strong>State:</strong> <span id="locState"></span></p>
            <p><strong>PIN code:</strong> <span id="locPin"></span></p>
            <p><strong>GPS accuracy:</strong> <span id="locAccuracy"></span></p>

            <h4>🗺️ Map preview</h4>
            <iframe
              id="locationMap"
              title="Current location map"
              width="100%"
              height="250"
              style="border:0;border-radius:12px"
              loading="lazy">
            </iframe>

            <a id="locationMapLink"
               href="#"
               target="_blank"
               rel="noopener noreferrer">
              Open in Google Maps
            </a>
          </div>

          <input type="hidden" name="latitude">
          <input type="hidden" name="longitude">
        </div>

        <div class="field full">
          <label>Describe the issue or suggestion *</label>
          <textarea
            name="description"
            required
            maxlength="2500"
            placeholder="Tell us what happened and what could improve..."></textarea>
        </div>

        <div class="field full">
          <label>Upload photo (mandatory) *</label>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required>

          <span class="hint">PNG, JPG, JPEG or WEBP · Maximum 5 MB</span>
          <img id="preview" class="photo-preview" alt="Selected photo preview">
        </div>

      </div>

      <div class="formfoot">
        <button class="btn" type="submit">Submit suggestion →</button>
        <span class="hint">Sign in first to submit a request.</span>
      </div>
    </form>

    <div id="submissionResult"></div>`
  );

  document.getElementById('photo').addEventListener('change',previewPhoto);
  document.getElementById('suggestionForm').addEventListener('submit',submitSuggestion);

  setupAreaAutocomplete();
  setupCurrentLocation()
}

const bengaluruAreas=[
  "Bagalagunte, Bengaluru",
  "Chikkabanavara, Bengaluru",
  "T. Dasarahalli, Bengaluru",
  "8th Mile, Bengaluru",
  "Jalahalli, Bengaluru",
  "Peenya, Bengaluru",
  "Nagasandra, Bengaluru",
  "Madanayakanahalli, Bengaluru",
  "Anchepalya, Bengaluru",
  "Lakshmipura, Bengaluru",
  "Rajeshwari Nagar, Bengaluru",
  "Yeshwanthpur, Bengaluru",
  "Mathikere, Bengaluru",
  "Vijayanagar, Bengaluru",
  "Malleswaram, Bengaluru",
  "Hebbal, Bengaluru",
  "Majestic, Bengaluru",
  "Yelahanka, Bengaluru",
  "Hesaraghatta, Bengaluru",
  "Nandini Layout, Bengaluru",
  "Basaveshwaranagar, Bengaluru",
  "Kengeri, Bengaluru",
  "RR Nagar, Bengaluru",
  "Jayanagar, Bengaluru",
  "Banashankari, Bengaluru",
  "Indiranagar, Bengaluru",
  "Whitefield, Bengaluru",
  "Electronic City, Bengaluru",
  "Koramangala, Bengaluru",
  "BTM Layout, Bengaluru",
  "Marathahalli, Bengaluru",
  "Bellandur, Bengaluru",
  "Bommanahalli, Bengaluru",
  "Hoodi, Bengaluru",
  "Kalyan Nagar, Bengaluru",
  "Sahakara Nagar, Bengaluru"
];

function setupAreaAutocomplete(){
  const input=document.querySelector('input[name="area"]');
  if(!input)return;

  input.setAttribute('autocomplete','off');
  input.setAttribute('aria-autocomplete','list');
  input.placeholder='Start typing an area (e.g. Chikkabanavara)';

  const wrapper=document.createElement('div');
  wrapper.className='autocomplete-wrap';

  input.parentNode.insertBefore(wrapper,input);
  wrapper.appendChild(input);

  const list=document.createElement('div');
  list.className='autocomplete-list';
  list.hidden=true;
  list.setAttribute('role','listbox');
  wrapper.appendChild(list);

  function close(){
    list.hidden=true;
    list.innerHTML=''
  }

  function show(){
    const q=input.value.trim().toLowerCase();
    list.innerHTML='';

    if(q.length<2){
      close();
      return
    }

    const matches=bengaluruAreas
      .filter(a=>a.toLowerCase().includes(q))
      .slice(0,7);

    if(!matches.length){
      close();
      return
    }

    matches.forEach(area=>{
      const option=document.createElement('button');
      option.type='button';
      option.className='autocomplete-option';
      option.setAttribute('role','option');
      option.textContent=area;

      option.addEventListener('click',()=>{
        input.value=area;
        close();
        input.focus()
      });

      list.appendChild(option)
    });

    list.hidden=false
  }

  input.addEventListener('input',show);
  input.addEventListener('focus',show);

  input.addEventListener('keydown',e=>{
    if(e.key==='Escape')close()
  });

  document.addEventListener('click',e=>{
    if(!wrapper.contains(e.target))close()
  })
}

function setupCurrentLocation(){
  const button=document.getElementById('getLocation');
  if(!button)return;
  button.addEventListener('click',()=>{
    const status=document.getElementById('locationStatus');
    const details=document.getElementById('locationDetails');
    if(!navigator.geolocation){
      status.textContent='Your browser does not support location access.';
      return;
    }
    button.disabled=true;
    status.textContent='Finding your current location…';
    details.hidden=true;
    navigator.geolocation.getCurrentPosition(async position=>{
      const lat=position.coords.latitude;
      const lon=position.coords.longitude;
      const accuracy=Math.round(position.coords.accuracy);
      document.querySelector('input[name="latitude"]').value=lat;
      document.querySelector('input[name="longitude"]').value=lon;
      document.getElementById('locAccuracy').textContent=`Approximately ${accuracy} metres`;
      document.getElementById('locationMap').src=
        `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.01}%2C${lat-0.01}%2C${lon+0.01}%2C${lat+0.01}&layer=mapnik&marker=${lat}%2C${lon}`;
      document.getElementById('locationMapLink').href=`https://www.google.com/maps?q=${lat},${lon}`;
      status.textContent='Coordinates received. Looking up address…';
      try{
        const response=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`);
        if(!response.ok)throw new Error('Address lookup failed');
        const place=await response.json();
        const a=place.address||{};
        const city=a.city||a.town||a.village||a.municipality||a.city_district||'';
        const area=a.neighbourhood||a.suburb||a.residential||a.quarter||a.hamlet||'';
        const district=a.state_district||a.county||'';
        const state=a.state||'';
        const pin=a.postcode||'';
        document.getElementById('locFullAddress').textContent=place.display_name||'Not available';
        document.getElementById('locArea').textContent=area||'Not available';
        document.getElementById('locCity').textContent=city||'Not available';
        document.getElementById('locDistrict').textContent=district||'Not available';
        document.getElementById('locState').textContent=state||'Not available';
        document.getElementById('locPin').textContent=pin||'Not available';
        const areaInput=document.querySelector('input[name="area"]');
        if(areaInput&&area)areaInput.value=[area,city].filter(Boolean).join(', ');
        details.hidden=false;
        status.textContent='Location fetched. Check the address and map below.';
      }catch(error){
        details.hidden=false;
        status.textContent='Coordinates fetched, but address lookup failed. You can still view the map.';
      }
      button.disabled=false;
    },error=>{
      status.textContent=error.code===1?'Location permission denied. Allow location access in browser settings.':error.code===2?'Location unavailable. Turn on device location and try again.':'Location timed out. Try again outdoors or near a window.';
      button.disabled=false;
    },{enableHighAccuracy:true,timeout:30000,maximumAge:0});
  });
}

const themeNames=['light','dark','ocean','sunset','forest'];

function applyTheme(theme){
  if(!themeNames.includes(theme))theme='light';

  document.documentElement.dataset.theme=theme;

  const picker=document.getElementById('themeSelect');
  if(picker)picker.value=theme
}

function initializeTheme(){
  let theme='light';

  try{
    theme=localStorage.getItem('dsb-theme')||'light'
  }catch{}

  applyTheme(theme);

  const picker=document.getElementById('themeSelect');

  if(picker){
    picker.addEventListener('change',()=>{
      applyTheme(picker.value);

      try{
        localStorage.setItem('dsb-theme',picker.value)
      }catch{}
    })
  }
}

initializeTheme();

function previewPhoto(e){
  const file=e.target.files[0];
  const img=document.getElementById('preview');

  if(!file){
    img.style.display='none';
    return
  }

  if(
    !['image/png','image/jpeg','image/webp'].includes(file.type)||
    file.size>5*1024*1024
  ){
    e.target.value='';
    img.style.display='none';
    toast('Choose a supported image up to 5 MB.');
    return
  }

  img.src=URL.createObjectURL(file);
  img.style.display='block'
}

async function submitSuggestion(e){
  e.preventDefault();

  const form=e.currentTarget;
  const fd=new FormData(form);
  const photo=fd.get('photo');

  if(!photo||!photo.size){
    toast('Photo upload is mandatory.');
    return
  }

  try{
    const data=await api('/api/suggestions',{
      method:'POST',
      body:fd
    });

    document.getElementById('submissionResult').innerHTML=`
      <div class="trackresult">
        <span class="status-pill">Submitted successfully</span>
        <p>Your tracking ID is:</p>
        <h2>${data.trackingId}</h2>
        <p class="hint">Save this ID to check the progress later.</p>
        <button class="btn light" data-view="track">Track this suggestion</button>
      </div>`;

    form.reset();
    document.getElementById('preview').style.display='none';
    toast('Suggestion submitted.')
  }catch(err){
    toast(err.message);

    if(err.message.includes('log in'))view('login')
  }
}

function loginView(){
  shell(
    'Citizen login',
    'Sign in to submit a suggestion with a photo and manage your submissions.',
    `<form id="loginForm">
      <div class="field">
        <label>Email address</label>
        <input name="email" type="email" required placeholder="you@example.com">
      </div>

      <div class="field">
        <label>Password</label>
        <div class="password-wrap">
          <input id="citizenLoginPassword" name="password" type="password" required minlength="8" autocomplete="current-password">
          <button class="password-toggle" type="button" data-toggle-password="citizenLoginPassword" aria-label="Show password" title="Show password">👁</button>
        </div>
      </div>

      <div class="formfoot">
        <button class="btn">Sign in</button>
        <button class="textlink" type="button" data-view="register">Create account</button>
      </div>
    </form>`
  );

  document.getElementById('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();

    const f=new FormData(e.currentTarget);

    try{
      await api('/api/login',{
        method:'POST',
        body:JSON.stringify(Object.fromEntries(f))
      });

      toast('Welcome back!');

      let next='submit';

      try{
        next=sessionStorage.getItem('dsb-after-auth')||'submit';
        sessionStorage.removeItem('dsb-after-auth')
      }catch{}

      view(next)
    }catch(err){
      toast(err.message)
    }
  })
}

function registerView(){
  shell(
    'Create citizen account',
    'Create an account to submit and follow community suggestions.',
    `<form id="registerForm">
      <div class="field">
        <label>Full name <span class="optional-label">(optional)</span></label>
        <input name="name" maxlength="90" placeholder="You may leave this blank">
      </div>

      <div class="field">
        <label>Email address</label>
        <input name="email" type="email" required>
      </div>

      <div class="field">
        <label>Password (at least 8 characters)</label>
        <div class="password-wrap">
          <input id="registerPassword" name="password" type="password" required minlength="8" autocomplete="new-password">
          <button class="password-toggle" type="button" data-toggle-password="registerPassword" aria-label="Show password" title="Show password">👁</button>
        </div>
      </div>

      <div class="formfoot">
        <button class="btn">Create account</button>
        <button class="textlink" type="button" data-view="login">I already have an account</button>
      </div>
    </form>`
  );

  document.getElementById('registerForm').addEventListener('submit',async e=>{
    e.preventDefault();

    try{
      await api('/api/register',{
        method:'POST',
        body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))
      });

      toast('Account created.');

      let next='submit';

      try{
        next=sessionStorage.getItem('dsb-after-auth')||'submit';
        sessionStorage.removeItem('dsb-after-auth')
      }catch{}

      view(next)
    }catch(err){
      toast(err.message)
    }
  })
}

function adminLoginView(){
  shell(
    'Administrator access',
    'Sign in to review, update, and manage citizen suggestions.',
    `<form id="adminForm">
      <div class="field">
        <label>Admin username</label>
        <input name="username" required autocomplete="username">
      </div>

      <div class="field">
        <label>Password</label>
        <div class="password-wrap">
          <input id="adminLoginPassword" name="password" type="password" required autocomplete="current-password">
          <button class="password-toggle" type="button" data-toggle-password="adminLoginPassword" aria-label="Show password" title="Show password">👁</button>
        </div>
      </div>

      <button class="btn">Open dashboard</button>
    </form>`
  );

  document.getElementById('adminForm').addEventListener('submit',async e=>{
    e.preventDefault();

    try{
      await api('/api/admin-login',{
        method:'POST',
        body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))
      });

      toast('Admin signed in.');
      view('admin')
    }catch(err){
      toast(err.message)
    }
  })
}

function trackView(){
  shell(
    'Track your suggestion',
    'Enter the unique tracking ID you received after submitting your suggestion.',
    `<form id="trackForm">
      <div class="formfoot">
        <input
          name="tracking"
          required
          placeholder="Example: DSB-1234ABCD"
          style="flex:1;min-width:190px;border:1px solid var(--line);border-radius:11px;padding:13px">

        <button class="btn">Check status</button>
      </div>
    </form>

    <div id="trackResult"></div>`
  );

  document.getElementById('trackForm').addEventListener('submit',async e=>{
    e.preventDefault();

    const id=new FormData(e.currentTarget).get('tracking');

    try{
      const item=await api('/api/track/'+encodeURIComponent(id));
      renderTracking(item,document.getElementById('trackResult'))
    }catch(err){
      document.getElementById('trackResult').innerHTML=
        `<p class="hint">${escapeHtml(err.message)}</p>`
    }
  })
}

function renderTracking(item,target){
  const idx=statuses.indexOf(item.status);

  target.innerHTML=`
    <div class="trackresult">
      <div class="suggestion-head">
        <div>
          <span class="hint">TRACKING ID</span>
          <h3>${escapeHtml(item.tracking_id)}</h3>
        </div>
        <span class="status-pill">${escapeHtml(item.status)}</span>
      </div>

      <div class="timeline">
        ${statuses.map((s,i)=>`
          <div class="stage ${i<idx?'done':i===idx?'current':''}">
            <div class="dot">${i<idx?'✓':i+1}</div>
            ${s}
          </div>
        `).join('')}
      </div>

      <div class="detailgrid">
        <div class="detail">
          <small>Category</small>
          <strong>${escapeHtml(item.category)}</strong>
        </div>

        <div class="detail">
          <small>Area</small>
          <strong>${escapeHtml(item.area)}</strong>
        </div>

        <div class="detail">
          <small>Submitted</small>
          <strong>${escapeHtml(item.created_at)}</strong>
        </div>

        <div class="detail">
          <small>Last updated</small>
          <strong>${escapeHtml(item.updated_at)}</strong>
        </div>
      </div>

      <div class="detail" style="margin-top:12px">
        <small>Suggestion details</small>
        <strong>${escapeHtml(item.description)}</strong>
      </div>

      <div class="detail" style="margin-top:12px">
        <small>Administrator response</small>
        <strong>${escapeHtml(item.admin_response||'No response has been added yet.')}</strong>
      </div>

      <img class="result-photo" src="${item.photoUrl}" alt="Uploaded supporting photo">
    </div>`
}

async function adminView(){
  appPanel.innerHTML=`
    <div class="panel wide">
      <h2>Admin dashboard</h2>
      <p class="lead">Review citizen requests, update progress, and respond transparently.</p>
      <div id="adminContent">Loading…</div>
      <div class="formfoot">
        <button class="btn light" id="logout">Log out</button>
      </div>
    </div>`;

  document.getElementById('logout').onclick=async()=>{
    await api('/api/logout',{method:'POST'});
    view('home');
    toast('Signed out.')
  };

  try{
    await loadAdmin()
  }catch(err){
    toast(err.message);
    view('admin-login')
  }
}

async function loadAdmin(){
  const q=document.getElementById('adminSearch')?.value||'';
  const s=document.getElementById('adminFilter')?.value||'';

  const data=await api(
    '/api/admin/suggestions?q='+encodeURIComponent(q)+'&status='+encodeURIComponent(s)
  );

  const target=document.getElementById('adminContent');

  target.innerHTML=`
    <div class="stats">
      ${['Total',...statuses].map(k=>`
        <div class="stat">
          <small>${k}</small>
          <b>${data.stats[k]||0}</b>
        </div>
      `).join('')}
    </div>

    <div class="toolbar">
      <input id="adminSearch" placeholder="Search ID, name, area..." value="${escapeHtml(q)}">

      <select id="adminFilter">
        <option value="">All statuses</option>
        ${statuses.map(st=>`
          <option ${s===st?'selected':''}>${st}</option>
        `).join('')}
      </select>

      <button class="btn" id="refresh">Refresh</button>
    </div>

    <div id="adminItems">
      ${data.items.length
        ?data.items.map(adminCard).join('')
        :'<div class="empty">No suggestions match your search.</div>'}
    </div>`;

  document.getElementById('adminSearch').addEventListener('input',debounce(loadAdmin,300));
  document.getElementById('adminFilter').addEventListener('change',loadAdmin);
  document.getElementById('refresh').addEventListener('click',loadAdmin);

  target.querySelectorAll('[data-save]').forEach(b=>b.addEventListener('click',saveAdmin));
  target.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',deleteAdmin))
}

function adminCard(x){
  return `
    <article class="suggestion">
      <div class="suggestion-head">
        <div>
          <span class="hint">${escapeHtml(x.tracking_id)} · ${escapeHtml(x.created_at)}</span>
          <h3>${escapeHtml(x.name||"Anonymous citizen")} — ${escapeHtml(x.category)}</h3>
          <span class="hint">${escapeHtml(x.area)}</span>
        </div>

        <span class="status-pill">${escapeHtml(x.status)}</span>
      </div>

      <p>${escapeHtml(x.description)}</p>

      <img
        src="${x.photoUrl}"
        alt="Citizen uploaded photo"
        style="max-width:150px;max-height:100px;border-radius:9px">

      <div class="formgrid">
        <div class="field">
          <label>Update status</label>
          <select data-status="${escapeHtml(x.tracking_id)}">
            ${statuses.map(s=>`
              <option ${x.status===s?'selected':''}>${s}</option>
            `).join('')}
          </select>
        </div>

        <div class="field">
          <label>Admin response</label>
          <input
            data-response="${escapeHtml(x.tracking_id)}"
            value="${escapeHtml(x.admin_response||'')}"
            placeholder="Write a short update">
        </div>
      </div>

      <div class="suggestion-actions">
        <button class="btn" data-save="${escapeHtml(x.tracking_id)}">Save update</button>
        <button class="btn danger" data-delete="${escapeHtml(x.tracking_id)}">Delete</button>
      </div>
    </article>`
}

async function saveAdmin(e){
  const id=e.currentTarget.dataset.save;
  const status=document.querySelector(`[data-status="${id}"]`).value;
  const admin_response=document.querySelector(`[data-response="${id}"]`).value;

  try{
    await api('/api/admin/suggestions/'+encodeURIComponent(id),{
      method:'PATCH',
      body:JSON.stringify({status,admin_response})
    });

    toast('Suggestion updated.');
    await loadAdmin()
  }catch(err){
    toast(err.message)
  }
}

async function deleteAdmin(e){
  const id=e.currentTarget.dataset.delete;

  if(!confirm('Delete this suggestion and its uploaded photo?'))return;

  try{
    await api('/api/admin/suggestions/'+encodeURIComponent(id),{
      method:'DELETE'
    });

    toast('Suggestion deleted.');
    await loadAdmin()
  }catch(err){
    toast(err.message)
  }
}

function debounce(fn,wait){
  let timer;
  return()=>{
    clearTimeout(timer);
    timer=setTimeout(fn,wait)
  }
}

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c]))
}

(async()=>{
  try{
    const s=await api('/api/session');

    if(s.role==='admin'){
      const n=document.createElement('button');
      n.className='navlink';
      n.dataset.view='admin';
      n.textContent='Dashboard';
      document.getElementById('nav').prepend(n)
    }else if(s.role==='citizen'){
      const n=document.createElement('button');
      n.className='navlink';
      n.dataset.view='submit';
      n.textContent='Submit suggestion';
      document.getElementById('nav').prepend(n)
    }
  }catch{}
})();

if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('/sw.js').catch(()=>{})
  })
}
