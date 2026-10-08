(() => {
  "use strict";
  const cfg = window.BH_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR_PROJECT") &&
    cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
  const db = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const $ = (id) => document.getElementById(id);
  const state = { user: null, profile: null, mode: "login", category: "", term: "", location: "", businesses: [], accountTab: "listings" };
  const categories = ["Home Services","Restaurants","Health & Medical","Automotive","Legal & Financial","Beauty & Personal Care","Education","Retail","Professional Services","Other"];
  const safe = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm = (v) => String(v || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  const toast = (msg) => { const el=$("toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),3200); };
  const fmtAddress = (b) => [b.address,b.city,b.state,b.zip_code].filter(Boolean).join(", ");
  const isAdmin = () => state.profile?.role === "admin";
  const phoneHref = (phone) => "tel:" + String(phone || "").replace(/[^\d+]/g,"");
  function categoryOptions(selected="") { return `<option value="">Choose a category</option>` + categories.map(c=>`<option ${c===selected?"selected":""} value="${safe(c)}">${safe(c)}</option>`).join(""); }
  function setStatus(msg) { $("results-status").textContent=msg; }
  function openDialog(id) { const d=$(id); if(d && !d.open) d.showModal(); }
  function closeDialog(id) { const d=$(id); if(d?.open) d.close(); }
  function showEmpty(show) { $("empty-state").classList.toggle("visible",show); }

  async function loadBusinesses() {
    if(!db) { setStatus("Demo preview — connect Supabase in config.js to load live listings."); state.businesses=[]; renderBusinesses(); return; }
    setStatus("Loading businesses…");
    let q = db.from("businesses").select("id,name,slug,description,category,phone,website,email,address,city,state,zip_code,logo_url,created_at").eq("status","published").order("created_at",{ascending:false}).limit(100);
    if(state.category) q=q.eq("category",state.category);
    if(state.term) q=q.or(`name.ilike.%${state.term.replace(/[,%()]/g," ").trim()}%,description.ilike.%${state.term.replace(/[,%()]/g," ").trim()}%,category.ilike.%${state.term.replace(/[,%()]/g," ").trim()}%`);
    if(state.location) q=q.or(`city.ilike.%${state.location.replace(/[,%()]/g," ").trim()}%,state.ilike.%${state.location.replace(/[,%()]/g," ").trim()}%,zip_code.ilike.%${state.location.replace(/[,%()]/g," ").trim()}%,address.ilike.%${state.location.replace(/[,%()]/g," ").trim()}%`);
    const {data,error}=await q;
    if(error) { setStatus("Could not load listings. Check your Supabase setup and database policies."); showEmpty(true); console.error(error); return; }
    state.businesses=data||[]; setStatus(`${state.businesses.length} published ${state.businesses.length===1?"business":"businesses"} shown`); renderBusinesses();
  }
  function renderBusinesses() {
    const grid=$("business-grid");
    grid.innerHTML=state.businesses.map(b=>`<article class="business-card">
      <span class="biz-category">${safe(b.category||"Local Business")}</span><h3>${safe(b.name)}</h3>
      ${b.description?`<p>${safe(b.description.slice(0,180))}${b.description.length>180?"…":""}</p>`:""}
      ${fmtAddress(b)?`<div class="business-meta"><span>⌖</span><p>${safe(fmtAddress(b))}</p></div>`:""}
      ${b.phone?`<div class="business-meta"><span>☎</span><p>${safe(b.phone)}</p></div>`:""}
      <div class="business-actions">${b.phone?`<a href="${safe(phoneHref(b.phone))}">Call business</a>`:""}${b.website?`<a href="${safe(validWebsite(b.website))}" target="_blank" rel="noopener noreferrer">Visit website ↗</a>`:""}${fmtAddress(b)?`<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fmtAddress(b))}" target="_blank" rel="noopener noreferrer">Directions ↗</a>`:""}</div>
    </article>`).join("");
    showEmpty(state.businesses.length===0);
  }
  function validWebsite(value) { let v=String(value||"").trim(); if(!/^https?:\/\//i.test(v)) v="https://"+v; try { const u=new URL(v); return ["http:","https:"].includes(u.protocol)?u.href:"#"; } catch { return "#"; } }

  async function refreshUser() {
    if(!db) return;
    const {data}=await db.auth.getSession();
    state.user=data?.session?.user||null;
    state.profile=null;
    if(state.user) {
      const {data:p,error}=await db.from("profiles").select("id,full_name,role").eq("id",state.user.id).maybeSingle();
      if(!error) state.profile=p;
    }
    const btn=$("open-auth");
    btn.textContent=state.user ? (isAdmin()?"Admin panel":"My dashboard") : "Log in / Join";
    if(state.user && !state.profile) toast("Account profile is not ready. Check the database setup.");
  }

  async function authSubmit(e) {
    e.preventDefault();
    if(!db) return $("auth-message").textContent="First add your Supabase URL and anon/publishable key in config.js.";
    const email=$("auth-email").value.trim(), password=$("auth-password").value;
    const message=$("auth-message"); message.textContent="Working…";
    let result;
    if(state.mode==="signup") {
      const full_name=$("auth-name").value.trim();
      result=await db.auth.signUp({email,password,options:{data:{full_name}}});
      if(!result.error && !result.data.session) { message.textContent="Account created. Check your email to confirm your address, then log in."; return; }
    } else result=await db.auth.signInWithPassword({email,password});
    if(result.error) { message.textContent=result.error.message; return; }
    await refreshUser(); closeDialog("auth-dialog"); toast("You’re signed in."); showAccount();
  }
  function setAuthMode(mode) {
    state.mode=mode; $("auth-title").textContent=mode==="login"?"Log in to Business Hosting":"Create your account";
    $("auth-submit").textContent=mode==="login"?"Log in":"Create account";
    $("auth-name-wrap").classList.toggle("hidden",mode!=="signup");
    $("auth-password").autocomplete=mode==="login"?"current-password":"new-password";
    $("auth-message").textContent="";
    document.querySelectorAll(".auth-tab").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
  }
  function authOpen() { if(!db) { openDialog("auth-dialog"); $("auth-message").textContent="Setup needed: configure Supabase in config.js first."; return; } if(state.user) showAccount(); else { setAuthMode("login"); openDialog("auth-dialog"); } }

  function businessForm(b={}) {
    return `<form id="business-form" class="stack-form">
      <label>Business name *<input name="name" required maxlength="160" value="${safe(b.name||"")}" placeholder="Example: Oak Street Plumbing"></label>
      <label>Category *<select name="category" required>${categoryOptions(b.category||"")}</select></label>
      <label>Phone<input name="phone" maxlength="40" value="${safe(b.phone||"")}" placeholder="+1 555 555 0100"></label>
      <label>Website<input name="website" maxlength="300" value="${safe(b.website||"")}" placeholder="https://example.com"></label>
      <label>Email<input name="email" type="email" maxlength="254" value="${safe(b.email||"")}" placeholder="contact@example.com"></label>
      <label>Street address<input name="address" maxlength="200" value="${safe(b.address||"")}" placeholder="123 Main Street"></label>
      <label>City *<input name="city" required maxlength="100" value="${safe(b.city||"")}" placeholder="Austin"></label>
      <label>State *<input name="state" required maxlength="2" value="${safe(b.state||"")}" placeholder="TX" pattern="[A-Za-z]{2}" title="Use the two-letter US state abbreviation"></label>
      <label>ZIP code<input name="zip_code" maxlength="10" value="${safe(b.zip_code||"")}" placeholder="78701"></label>
      <label class="span-all">Short description<textarea name="description" rows="3" maxlength="2000" placeholder="What makes this business useful to customers?">${safe(b.description||"")}</textarea></label>
      <div class="span-all"><button class="button button-primary" type="submit">${b.id?"Save changes":"Submit business for review"}</button> <span class="form-message" id="business-form-message"></span></div>
    </form>`;
  }
  async function myListings() {
    const {data,error}=await db.from("businesses").select("id,name,city,state,status,created_at").eq("owner_id",state.user.id).order("created_at",{ascending:false}).limit(200);
    if(error) return `<p class="form-message">${safe(error.message)}</p>`;
    return `<div class="dashboard-list">${(data||[]).map(b=>`<div class="dashboard-row"><div><strong>${safe(b.name)}</strong><small>${safe([b.city,b.state].filter(Boolean).join(", "))} · ${safe(b.status)}</small></div><div><button data-edit="${b.id}">Edit</button></div></div>`).join("")||"<p class='muted'>No listings yet. Add your business to get started.</p>"}</div>`;
  }
  async function adminListings() {
    const {data,error}=await db.from("businesses").select("id,name,city,state,status,owner_id,created_at").order("created_at",{ascending:false}).limit(200);
    if(error) return `<p class="form-message">${safe(error.message)}</p>`;
    return `<div class="dashboard-list">${(data||[]).map(b=>`<div class="dashboard-row"><div><strong>${safe(b.name)}</strong><small>${safe([b.city,b.state].filter(Boolean).join(", "))} · ${safe(b.status)} · ${b.owner_id===state.user.id?"your listing":"owner listing"}</small></div><div>${b.status!=="published"?`<button data-publish="${b.id}">Publish</button>`:""}<button class="danger" data-delete="${b.id}">Delete</button></div></div>`).join("")||"<p class='muted'>No businesses found.</p>"}</div>`;
  }
  function dashboardTabs() {
    return `<div class="dashboard-nav"><button data-tab="listings" class="${state.accountTab==="listings"?"active":""}">My listings</button><button data-tab="add" class="${state.accountTab==="add"?"active":""}">Add business</button>${isAdmin()?`<button data-tab="admin" class="${state.accountTab==="admin"?"active":""}">All listings</button><button data-tab="import" class="${state.accountTab==="import"?"active":""}">CSV import</button>`:""}<button id="logout-button">Log out</button></div>`;
  }
  async function showAccount(tab) {
    if(!db || !state.user) { authOpen(); return; }
    if(tab) state.accountTab=tab;
    $("account-title").textContent=isAdmin()?"Admin dashboard":"Business owner dashboard";
    $("account-subtitle").textContent=state.user.email||"";
    const content=$("account-content");
    content.innerHTML=dashboardTabs()+"<div class='dashboard-panel'>Loading…</div>";
    openDialog("account-dialog");
    await renderAccountPanel();
  }
  async function renderAccountPanel() {
    const content=$("account-content");
    let panel="";
    if(state.accountTab==="add") panel=`<div class="dashboard-panel"><h3>Submit a business</h3><p class="muted">New listings are saved as pending until an admin approves them.</p>${businessForm()}</div>`;
    else if(state.accountTab==="import" && isAdmin()) panel=`<div class="dashboard-panel"><h3>Import a CSV file</h3><p class="muted">CSV headers: name, category, phone, website, email, address, city, state, zip_code, description. Rows are added as pending. Existing matches are skipped using normalized name + city + state, and phone where available.</p><div class="stack-form"><label class="span-all">Choose CSV file<input class="file-input" type="file" id="csv-file" accept=".csv,text/csv"></label><label class="span-all"><input type="checkbox" id="publish-import"> Publish imported rows immediately (only if you have verified the source and details)</label><div class="span-all"><button class="button button-primary" id="run-import">Import CSV</button><span class="form-message" id="import-message"></span></div></div></div>`;
    else if(state.accountTab==="admin" && isAdmin()) panel=`<div class="dashboard-panel"><h3>Manage all business listings</h3><p class="muted">Review pending submissions and remove spam or duplicates.</p>${await adminListings()}</div>`;
    else panel=`<div class="dashboard-panel"><h3>Your business listings</h3><p class="muted">Manage your listings. Edits may return a published listing to pending review.</p>${await myListings()}</div>`;
    content.innerHTML=dashboardTabs()+panel;
    wireDashboard();
  }
  function wireDashboard() {
    document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>showAccount(b.dataset.tab)));
    $("logout-button")?.addEventListener("click",async()=>{await db.auth.signOut();state.user=null;state.profile=null;closeDialog("account-dialog");await refreshUser();toast("You’ve logged out.");});
    $("business-form")?.addEventListener("submit",saveBusiness);
    document.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editBusiness(b.dataset.edit)));
    document.querySelectorAll("[data-publish]").forEach(b=>b.addEventListener("click",()=>changeStatus(b.dataset.publish,"published")));
    document.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteBusiness(b.dataset.delete)));
    $("run-import")?.addEventListener("click",importCsv);
  }
  async function saveBusiness(e) {
    e.preventDefault(); const form=e.currentTarget, fd=new FormData(form), msg=$("business-form-message");
    const payload={name:String(fd.get("name")||"").trim(),category:String(fd.get("category")||""),phone:String(fd.get("phone")||"").trim()||null,website:String(fd.get("website")||"").trim()||null,email:String(fd.get("email")||"").trim()||null,address:String(fd.get("address")||"").trim()||null,city:String(fd.get("city")||"").trim(),state:String(fd.get("state")||"").trim().toUpperCase(),zip_code:String(fd.get("zip_code")||"").trim()||null,description:String(fd.get("description")||"").trim()||null,owner_id:state.user.id,status:"pending"};
    const editId=form.dataset.editId;
    msg.textContent="Saving…";
    const res=editId?await db.from("businesses").update(payload).eq("id",editId).select("id").single():await db.from("businesses").insert(payload).select("id").single();
    if(res.error){msg.textContent=res.error.message;return;}
    toast(editId?"Changes submitted for review.":"Business submitted for review.");state.accountTab="listings";await renderAccountPanel();await loadBusinesses();
  }
  async function editBusiness(id) {
    const {data,error}=await db.from("businesses").select("*").eq("id",id).maybeSingle();
    if(error||!data){toast("Could not load this listing.");return;}
    state.accountTab="add";await renderAccountPanel();
    const form=$("business-form");if(!form)return;
    form.dataset.editId=id;
    Object.entries(data).forEach(([k,v])=>{const input=form.elements.namedItem(k);if(input && typeof v==="string")input.value=v;});
    const h=form.closest(".dashboard-panel").querySelector("h3");if(h)h.textContent="Edit business listing";
    const btn=form.querySelector('button[type="submit"]');if(btn)btn.textContent="Save changes for review";
  }
  async function changeStatus(id,status) {
    const {error}=await db.from("businesses").update({status}).eq("id",id);
    if(error){toast("Could not update listing: "+error.message);return;}toast("Listing status updated.");await renderAccountPanel();await loadBusinesses();
  }
  async function deleteBusiness(id) {
    if(!confirm("Delete this business listing permanently?"))return;
    const {error}=await db.from("businesses").delete().eq("id",id);
    if(error){toast("Could not delete listing: "+error.message);return;}toast("Listing deleted.");await renderAccountPanel();await loadBusinesses();
  }
  function parseCSV(text) {
    const rows=[];let row=[],field="",quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];
      if(quoted){if(c==='"'&&n==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}
      else if(c==='"')quoted=true;else if(c===","){row.push(field);field="";}else if(c==="\n"){row.push(field.replace(/\r$/,""));if(row.some(x=>x.trim()))rows.push(row);row=[];field="";}else field+=c;
    }
    row.push(field.replace(/\r$/,""));if(row.some(x=>x.trim()))rows.push(row);
    if(!rows.length)return [];
    const headers=rows.shift().map(h=>norm(h).replace(/ /g,"_"));
    return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]||"").trim()])));
  }
  async function importCsv() {
    const file=$("csv-file")?.files?.[0], msg=$("import-message");
    if(!file){msg.textContent="Choose a CSV file first.";return;}
    if(file.size>10*1024*1024){msg.textContent="For reliability, split CSV files into chunks under 10 MB.";return;}
    msg.textContent="Reading CSV…";
    try {
      const rows=parseCSV(await file.text());
      if(!rows.length){msg.textContent="No rows found.";return;}
      if(!rows[0].name || !rows[0].city || !rows[0].state){msg.textContent="CSV must include name, city, and state columns.";return;}
      const {data:existing,error}=await db.from("businesses").select("name,city,state,phone").limit(10000);
      if(error){msg.textContent="Could not check existing listings: "+error.message;return;}
      const seen=new Set((existing||[]).map(b=>dedupeKey(b)));
      const publish=$("publish-import").checked, toInsert=[], skipped=[];
      for(let i=0;i<rows.length;i++){
        const r=rows[i], b={name:r.name,category:r.category||"Other",phone:r.phone||null,website:r.website||null,email:r.email||null,address:r.address||null,city:r.city,state:String(r.state||"").toUpperCase(),zip_code:r.zip_code||null,description:r.description||null,owner_id:state.user.id,status:publish?"published":"pending"};
        if(!b.name||!b.city||!/^[A-Z]{2}$/.test(b.state)){skipped.push(i+2);continue;}
        const key=dedupeKey(b);if(seen.has(key)){skipped.push(i+2);continue;}
        seen.add(key);toInsert.push(b);
      }
      let inserted=0;
      for(let i=0;i<toInsert.length;i+=100){
        const batch=toInsert.slice(i,i+100), {error}=await db.from("businesses").insert(batch);
        if(error){msg.textContent=`Import stopped after ${inserted} rows: ${error.message}. Try smaller CSV batches.`;return;}
        inserted+=batch.length;
      }
      msg.textContent=`Done: ${inserted} added; ${skipped.length} skipped (invalid or possible duplicates).`;
      toast("CSV import completed.");await loadBusinesses();
    } catch(err){msg.textContent="CSV import failed: "+err.message;}
  }
  function dedupeKey(b) {
    const base=[norm(b.name),norm(b.city),norm(b.state)].join("|");
    const phone=String(b.phone||"").replace(/\D/g,"");
    return base+"|"+(phone?phone.slice(-10):"");
  }
  function searchSubmit(e) {
    e?.preventDefault();state.term=$("search-term").value.trim();state.location=$("search-location").value.trim();
    $("results-title").textContent=state.term||state.location?"Search results":"Discover local businesses";
    $("results-description").textContent=[state.term,state.location].filter(Boolean).join(" · ")||"Search the directory or explore recently published listings.";
    loadBusinesses();$("listings").scrollIntoView({behavior:"smooth"});
  }
  document.addEventListener("DOMContentLoaded",async()=>{
    $("year").textContent=new Date().getFullYear();
    $("search-form").addEventListener("submit",searchSubmit);
    $("clear-search").addEventListener("click",()=>{state.term="";state.location="";state.category="";$("search-term").value="";$("search-location").value="";document.querySelectorAll(".category-card").forEach(x=>x.classList.remove("selected"));$("results-title").textContent="Discover local businesses";loadBusinesses();});
    document.querySelectorAll(".category-card").forEach(b=>b.addEventListener("click",()=>{state.category=state.category===b.dataset.category?"":b.dataset.category;document.querySelectorAll(".category-card").forEach(x=>x.classList.toggle("selected",x===b&&state.category));$("results-title").textContent=state.category||"Discover local businesses";loadBusinesses();$("listings").scrollIntoView({behavior:"smooth"});}));
    $("open-auth").addEventListener("click",authOpen);$("owner-join").addEventListener("click",()=>{if(state.user)showAccount("add");else{setAuthMode("signup");openDialog("auth-dialog");}});
    $("close-auth").addEventListener("click",()=>closeDialog("auth-dialog"));$("close-account").addEventListener("click",()=>closeDialog("account-dialog"));
    $("auth-form").addEventListener("submit",authSubmit);
    document.querySelectorAll(".auth-tab").forEach(b=>b.addEventListener("click",()=>setAuthMode(b.dataset.mode)));
    if(db){await refreshUser();db.auth.onAuthStateChange(()=>setTimeout(async()=>{await refreshUser();},0));}
    await loadBusinesses();
  });
})();