(function(){
'use strict';

/* =========================================================
   1. DATA (read-only; everything below is presentation)
   ========================================================= */
const DATA = JSON.parse(document.getElementById('tracker-data').textContent);
const STATUS = {
  'Done':        {group:'completed',  label:'Completed',   glyph:'st-done'},
  'In Progress': {group:'inProgress', label:'In progress', glyph:'st-prog'},
  'In Review':   {group:'inProgress', label:'In review',   glyph:'st-review'},
  'Backlog':     {group:'backlog',    label:'Backlog',     glyph:'st-back'}
};
function countItems(items){
  const c = {completed:0,inProgress:0,backlog:0}, seen = new Set();
  for (const it of items){ if (seen.has(it.id)) continue; seen.add(it.id); const s = STATUS[it.status]; if (s) c[s.group]++; }
  c.total = c.completed + c.inProgress + c.backlog;
  return c;
}
const DEST = {}; DATA.destinations.forEach(d => { DEST[d.id] = d; d.counts = countItems(d.items); });
const ORDER = DATA.destinations.map(d => d.id);
const asOf = new Date(DATA.meta.asOf);
const asOfText = (() => { try { return asOf.toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'}); } catch(e){ return DATA.meta.asOf; } })();
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDue(s){ const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s||''); if(!m) return s||''; const y=+m[1], mo=+m[2]-1, d=+m[3]; return MONTHS[mo]+' '+d+(y!==asOf.getFullYear()?', '+y:''); }

/* =========================================================
   2. VISUAL IDENTITY (positions are fixed world coordinates)
   ========================================================= */
const IDENTITY = {
  'ai-initiatives':     {rgb:[184,166,255], pos:[-14.6, 3.6, 2.0],  shape:'branching',   form:'Branching',
                         desk:{theta:44, rp:9.4, phi:-52}, mob:{theta:30, rp:12.5, phi:58}},
  'data-mart':          {rgb:[200,222,255], pos:[-10.8,-6.4,-4.2],  shape:'network',     form:'Interconnected',
                         desk:{theta:44, rp:9.6, phi:-40}, mob:{theta:30, rp:12.5, phi:122}},
  'dreamcatcher':       {rgb:[206,150,255], pos:[ 4.2, 8.2,-7.0],   shape:'woven',       form:'Woven',
                         desk:{theta:46, rp:9.4, phi:-62}, mob:{theta:30, rp:12.5, phi:60}},
  'helias':             {rgb:[255,190,118], pos:[15.0, 1.6, 1.2],   shape:'radial',      form:'Radial',
                         desk:{theta:44, rp:9.4, phi:-48}, mob:{theta:30, rp:12.5, phi:118}},
  'data-certification': {rgb:[132,226,210], pos:[ 8.6,-7.0, 4.2],   shape:'ordered',     form:'Ordered',
                         desk:{theta:45, rp:9.6, phi:-58}, mob:{theta:30, rp:12.5, phi:62}}
};
const LAYOUT = {
  desk:{sx:0.36, sy:0.04, fov:40},
  mob: {sx:0.0,  sy:0.40, fov:52}
};
const CONST_SCALE = 2.25, EARTH_R = 4, ATM_R = 4 * 1.10;
const SUN = [-0.72, 0.46, 0.52], FILL = [0.72, -0.18, -0.66];
const SYMBOL_HALF = 0.70, SYMBOL_SPREAD = 0.07;   // symbol texture half-extent on the planet (normal units) and its SDF range

/* =========================================================
   3. SHAPES (local plane coordinates, ~unit radius)
   ========================================================= */
function shape(kind){
  if (kind==='branching'){
    return {p:[[0.06,-1.05],[0.0,-0.42],[-0.5,0.05],[0.46,-0.06],[-0.92,0.4],[-0.34,0.62],[0.9,0.3],[0.3,0.5],[0.58,0.98],[-0.6,1.04]],
            e:[[0,1],[1,2],[1,3],[2,4],[2,5],[3,6],[3,7],[7,8],[5,9]],
            m:[1.35,1.0,0.95,1.0,0.8,0.85,0.95,0.75,1.15,0.85]};
  }
  if (kind==='network'){
    return {p:[[-0.98,0.06],[-0.5,0.84],[0.42,0.9],[1.0,0.12],[0.52,-0.8],[-0.46,-0.86],[-0.16,0.16],[0.32,-0.06]],
            e:[[6,7],[6,0],[6,1],[6,5],[7,2],[7,3],[7,4],[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[1,7],[6,4]],
            m:[0.9,1.0,0.9,1.1,0.85,0.9,1.3,1.2]};
  }
  if (kind==='woven'){
    const n=7, p=[], e=[], m=[];
    for (let i=0;i<n;i++){ const a=-Math.PI/2+i*2*Math.PI/n; p.push([Math.cos(a)*1.0, Math.sin(a)*1.0]); m.push(i===0?1.25:0.9); }
    for (let i=0;i<n;i++){ const a=-Math.PI/2+(i+0.5)*2*Math.PI/n; p.push([Math.cos(a)*0.5, Math.sin(a)*0.5]); m.push(0.7); }
    p.push([0,0]); m.push(1.15);
    p.push([-0.16,-1.42]); m.push(0.75); p.push([0.14,-1.62]); m.push(0.8);
    for (let i=0;i<n;i++) e.push([i,(i+1)%n]);
    for (let i=0;i<n;i++){ e.push([i, n+i]); e.push([i, n+((i-1+n)%n)]); }
    for (let i=0;i<n;i++) e.push([n+i, 2*n]);
    e.push([0,2*n+1]); e.push([2*n+1,2*n+2]);
    return {p,e,m};
  }
  if (kind==='radial'){
    const p=[[0,0]], e=[], m=[1.9];
    const k=8;
    for (let i=0;i<k;i++){ const a=i*2*Math.PI/k+0.2; const r=i%2?0.62:1.0; p.push([Math.cos(a)*r, Math.sin(a)*r]); m.push(i%2?0.75:1.0); e.push([0,i+1]); }
    return {p,e,m};
  }
  // ordered lattice
  const p=[], e=[], m=[];
  for (let j=0;j<3;j++) for (let i=0;i<3;i++){ p.push([(i-1)*0.82,(1-j)*0.82]); m.push(i===1&&j===1?1.35:0.95); }
  for (let j=0;j<3;j++) for (let i=0;i<2;i++) e.push([j*3+i, j*3+i+1]);
  for (let i=0;i<3;i++) for (let j=0;j<2;j++) e.push([j*3+i, (j+1)*3+i]);
  e.sort((a,b)=>(a[0]+a[1])-(b[0]+b[1]));
  return {p,e,m};
}

/* =========================================================
   4. HELPERS
   ========================================================= */
const TAU=Math.PI*2, DEG=Math.PI/180;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const wrapPi=a=>{a=(a+Math.PI)%TAU; if(a<0)a+=TAU; return a-Math.PI;};
const $=id=>document.getElementById(id);
const app=$('app');
let seed=20261003; const rand=()=>{seed=(seed*1664525+1013904223)>>>0; return seed/4294967296;};
function raDec(v){
  const ra=((Math.atan2(v[0],v[2])/TAU)*24+24)%24, h=Math.floor(ra), mi=Math.floor((ra-h)*60);
  const L=Math.hypot(v[0],v[1],v[2]), dec=Math.round(Math.asin(v[1]/L)/DEG);
  return 'RA '+String(h).padStart(2,'0')+'h '+String(mi).padStart(2,'0')+'m · Dec '+(dec>=0?'+':'−')+Math.abs(dec)+'°';
}

if (!window.THREE){
  const p=document.createElement('p'); p.className='boot-error';
  p.textContent='The 3D engine could not load. Use the destination menu to view progress.'; app.appendChild(p);
}
const T = window.THREE;
const V3 = T.Vector3, UP = new V3(0,1,0);
const sunDir = new V3(...SUN).normalize(), fillDir = new V3(...FILL).normalize();

/* =========================================================
   5. RENDERER + SCENE
   ========================================================= */
const glCanvas=$('gl'), chart=$('chart'), ctx=chart.getContext('2d');
let DPR=Math.min(window.devicePixelRatio||1,2);
let W=innerWidth, H=innerHeight;
let renderer=null, hasGL=false;
try { renderer=new T.WebGLRenderer({canvas:glCanvas,antialias:true,powerPreference:'high-performance'}); hasGL=!!renderer.getContext(); }
catch(e){ hasGL=false; }
if (!hasGL) app.classList.add('no-gl');

const scene=new T.Scene();
const camera=new T.PerspectiveCamera(40,W/H,0.1,4000);

const NOISE=`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){ float s=0.0, a=0.5; for(int i=0;i<6;i++){ s+=a*snoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
`;

/* --- one-time bake of the nebula sky and the cloud layer into equirectangular textures --- */
function bake(mode){
  const rt=new T.WebGLRenderTarget(2048,1024,{minFilter:T.LinearMipmapLinearFilter,magFilter:T.LinearFilter,generateMipmaps:true,depthBuffer:false,stencilBuffer:false});
  const mat=new T.ShaderMaterial({
    uniforms:{uMode:{value:mode}},
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
    fragmentShader:NOISE+`
      uniform float uMode; varying vec2 vUv;
      vec3 dirFromUv(vec2 uv){ float th=(1.0-uv.y)*3.14159265; float ph=uv.x*6.28318531; return vec3(-cos(ph)*sin(th), cos(th), sin(ph)*sin(th)); }
      void main(){
        vec3 d=dirFromUv(vUv);
        if (uMode<0.5){
          vec3 bandN=normalize(vec3(0.38,0.84,-0.40));
          float b=dot(d,bandN);
          float band=exp(-b*b/0.028), wide=exp(-b*b/0.16);
          float n1=fbm(d*1.35+2.3)*0.5+0.5;
          float n2=fbm(d*2.8+vec3(n1*1.6))*0.5+0.5;
          float n3=fbm(d*7.5+11.0)*0.5+0.5;
          vec3 col=vec3(0.010,0.013,0.034);
          float neb=smoothstep(0.50,0.88,n2);
          col+=vec3(0.120,0.072,0.225)*neb*(0.28+0.72*wide);
          col+=vec3(0.035,0.070,0.150)*smoothstep(0.56,0.92,n1)*0.6;
          col+=vec3(0.070,0.068,0.100)*band*(0.30+0.70*n3);
          col+=vec3(0.20,0.11,0.05)*pow(neb,3.0)*band*0.45;
          col*=1.0-0.62*band*smoothstep(0.52,0.72,n3);
          gl_FragColor=vec4(col,1.0);
        } else {
          float w=fbm(d*1.8+5.0);
          float c=fbm(d*vec3(1.9,6.8,1.9)+w*1.5+1.3)*0.5+0.5;
          float c2=fbm(d*8.5+w*0.8+7.0)*0.5+0.5;
          float lat=d.y;
          float belt=0.55+0.30*exp(-pow((abs(lat)-0.78)/0.16,2.0))+0.20*exp(-pow(lat/0.10,2.0))-0.30*exp(-pow((abs(lat)-0.42)/0.11,2.0));
          float cover=smoothstep(0.60-0.16*belt,1.02,c*0.78+c2*0.30); cover*=cover*(3.0-2.0*cover);
          gl_FragColor=vec4(vec3(cover),1.0);
        }
      }`,
    depthTest:false, depthWrite:false
  });
  const q=new T.Mesh(new T.PlaneGeometry(2,2),mat), s=new T.Scene(); s.add(q);
  renderer.setRenderTarget(rt); renderer.render(s,new T.Camera()); renderer.setRenderTarget(null);
  mat.dispose(); q.geometry.dispose();
  return rt;
}

let skyMat, earthMat, atmMat, starLayers=[];
const earthGroup=new T.Group(), earth=new T.Object3D();
const accent={dir:new V3(0,0,1), col:new T.Color(0,0,0), amt:0, target:0, pending:null};

if (hasGL){
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x04050d,1);
  const skyRT=bake(0);

  skyMat=new T.ShaderMaterial({
    uniforms:{uTex:{value:skyRT.texture},uAccentDir:{value:accent.dir},uAccentCol:{value:accent.col},uAccentAmt:{value:0}},
    vertexShader:`varying vec2 vUv; varying vec3 vDir; void main(){ vUv=uv; vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform sampler2D uTex; uniform vec3 uAccentDir; uniform vec3 uAccentCol; uniform float uAccentAmt; varying vec2 vUv; varying vec3 vDir;
      void main(){ vec3 c=texture2D(uTex,vUv).rgb; float a=pow(max(dot(normalize(vDir),uAccentDir),0.0),7.0); c+=uAccentCol*a*uAccentAmt*0.085; gl_FragColor=vec4(c,1.0); }`,
    side:T.BackSide, depthWrite:false
  });
  const sky=new T.Mesh(new T.SphereGeometry(1800,64,32),skyMat); sky.renderOrder=-10; scene.add(sky);

  /* stars: far (fixed size), mid and near (perspective size → parallax) */
  const bandN=new V3(0.38,0.84,-0.40).normalize();
  function starLayer(count, rMin, rMax, sizeFn, atten, bright, bandBias){
    const pos=new Float32Array(count*3), col=new Float32Array(count*3), size=new Float32Array(count), ph=new Float32Array(count);
    for (let i=0;i<count;i++){
      let d;
      for (let k=0;k<12;k++){
        d=new V3(rand()*2-1,rand()*2-1,rand()*2-1); const l=d.length(); if (l>1||l<0.05) {k--; continue;} d.divideScalar(l);
        const b=d.dot(bandN); if (rand() < (1-bandBias) + bandBias*Math.exp(-b*b/0.03)) break;
      }
      const r=rMin+(rMax-rMin)*Math.cbrt(rand());
      pos[i*3]=d.x*r; pos[i*3+1]=d.y*r; pos[i*3+2]=d.z*r;
      const t=rand(); let c;
      if (t<0.07) c=[1.0,0.86,0.70]; else if (t<0.30) c=[0.72,0.80,1.0]; else c=[0.90,0.93,1.0];
      col.set(c,i*3); size[i]=sizeFn(); ph[i]=rand();
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.BufferAttribute(pos,3)); g.setAttribute('aColor',new T.BufferAttribute(col,3));
    g.setAttribute('aSize',new T.BufferAttribute(size,1)); g.setAttribute('aPhase',new T.BufferAttribute(ph,1));
    const m=new T.ShaderMaterial({
      uniforms:{uTime:{value:0},uPR:{value:DPR},uAtten:{value:atten},uBright:{value:bright}},
      vertexShader:`attribute float aSize; attribute vec3 aColor; attribute float aPhase;
        uniform float uTime,uPR,uAtten,uBright; varying vec3 vColor; varying float vAlpha;
        void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv;
          float s=aSize; if(uAtten>0.0) s=min(aSize*uAtten/max(-mv.z,0.5),2.6);
          float tw=0.80+0.20*sin(uTime*(0.35+aPhase*1.3)+aPhase*40.0);
          float px=s*uPR; vAlpha=uBright*tw*clamp(px/(1.4*uPR),0.18,1.0);
          gl_PointSize=clamp(px*3.2,2.0,26.0*uPR); vColor=aColor; }`,
      fragmentShader:`varying vec3 vColor; varying float vAlpha;
        void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c)*2.0; float a=(exp(-d*d*16.0)+exp(-d*d*3.5)*0.14)*vAlpha; if(a<0.003) discard; gl_FragColor=vec4(vColor*a,1.0); }`,
      transparent:true, depthWrite:false, blending:T.AdditiveBlending
    });
    const pts=new T.Points(g,m); pts.frustumCulled=false; scene.add(pts); starLayers.push(m); return pts;
  }
  starLayer(7200, 1400, 1500, ()=>0.5+Math.pow(rand(),6)*2.6, 0, 1.0, 0.5).renderOrder=-9;
  starLayer(1700, 70, 280, ()=>0.5+Math.pow(rand(),4)*1.8, 160, 0.9, 0.2).renderOrder=-8;
  starLayer(520, 12, 46, ()=>0.25+rand()*0.55, 11, 0.55, 0.0).renderOrder=-7;

  /* Pearl planet: white marble with nacre lustre, the Relativity Space symbol inlaid in black pearl */
  const loader=new T.TextureLoader();
  const symTex=loader.load(window.__TEX.symbol);
  symTex.minFilter=T.LinearFilter; symTex.magFilter=T.LinearFilter; symTex.generateMipmaps=false;
  earthMat=new T.ShaderMaterial({
    extensions:{derivatives:true},
    uniforms:{uSym:{value:symTex},uSymS:{value:SYMBOL_HALF},uSpread:{value:SYMBOL_SPREAD},uSun:{value:sunDir},uFill:{value:fillDir},uExposure:{value:1.12}},
    vertexShader:`varying vec3 vObjN; varying vec3 vN; varying vec3 vPos; varying vec3 vT; varying vec3 vB;
      void main(){ vObjN=normal; mat3 m=mat3(modelMatrix); vN=normalize(m*normal); vT=normalize(m*vec3(1.0,0.0,0.0)); vB=normalize(m*vec3(0.0,1.0,0.0));
        vec4 wp=modelMatrix*vec4(position,1.0); vPos=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader:NOISE+`
      uniform sampler2D uSym; uniform float uSymS,uSpread,uExposure; uniform vec3 uSun,uFill;
      varying vec3 vObjN; varying vec3 vN; varying vec3 vPos; varying vec3 vT; varying vec3 vB;
      vec3 film(float x){ return 0.5+0.5*cos(6.28318*(vec3(0.0,0.33,0.67)+x)); }
      float symDist(vec2 uv){ if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0)))) return uSpread; return (0.5-texture2D(uSym,uv).r)*2.0*uSpread; }
      float groove(vec2 uv){ return smoothstep(-0.010,0.0035,symDist(uv)); }   // 1 on the pearl surface, 0 on the inlay floor
      void main(){
        vec3 on=normalize(vObjN), n0=normalize(vN);
        vec3 V=normalize(cameraPosition-vPos), L=normalize(uSun), F=normalize(uFill);

        /* marble body */
        vec3 p=on*1.65;
        float w=fbm(p*1.05+3.1);
        float w2=fbm(p*2.2+w*0.9+7.7);
        float cloud=fbm(p*0.8+11.0)*0.5+0.5;
        float vf=sin((p.x*1.6+p.y*2.9-p.z*0.9)*2.2+w*4.4+w2*1.7);
        float veins=1.0-smoothstep(0.0,0.11,abs(vf));
        float hair=1.0-smoothstep(0.0,0.045,abs(sin(dot(p,vec3(3.7,-2.1,3.1))+w2*6.0+w*2.2)));
        vec3 base=mix(vec3(0.90,0.885,0.90),vec3(0.965,0.955,0.935),cloud);
        base=mix(base,vec3(0.83,0.82,0.88),smoothstep(0.5,0.92,w2*0.5+0.5)*0.55);
        base=mix(base,vec3(0.60,0.58,0.69),veins*(0.42+0.25*cloud));
        base=mix(base,vec3(0.70,0.68,0.77),hair*0.22);
        base*=mix(vec3(1.035,0.985,0.995),vec3(0.975,0.99,1.03),smoothstep(-0.4,0.4,w+on.y*0.3));   // rose-silver overtone

        /* symbol: planar projection along the planet's local +Z */
        float inlay=0.0; vec3 n=n0;
        if (on.z>0.0){
          vec2 suv=on.xy/(2.0*uSymS)+0.5;
          float d=symDist(suv);
          float aa=max(fwidth(d),1e-4)*0.75;
          inlay=(1.0-smoothstep(-aa,aa,d))*smoothstep(0.0,0.18,on.z);
          float e=0.0022;
          float gx=groove(suv+vec2(e,0.0))-groove(suv-vec2(e,0.0));
          float gy=groove(suv+vec2(0.0,e))-groove(suv-vec2(0.0,e));
          n=normalize(n0-0.055*(gx*vT+gy*vB)/(2.0*e)*smoothstep(0.0,0.18,on.z));
        }

        float ndl0=dot(n0,L), ndl=dot(n,L), ndf=dot(n,F);
        float ndv=max(dot(n,V),0.0), fres=pow(1.0-ndv,3.0);
        vec3 Hs=normalize(L+V), Hf=normalize(F+V);
        float nh=max(dot(n,Hs),0.0), nhf=max(dot(n,Hf),0.0);
        float lit=smoothstep(-0.30,0.22,ndl0);
        vec3 iri=film(ndv*1.15+w*0.35+cloud*0.25+0.12);

        /* pearl */
        float wrap=0.24;
        vec3 pearl=base*max((ndl+wrap)/(1.0+wrap),0.0)*(0.80+0.20*ndv)*1.05;
        pearl+=base*vec3(0.42,0.38,0.62)*max(ndf,0.0)*0.16;                  // cool violet fill from behind
        pearl+=base*vec3(0.50,0.47,0.66)*0.035;                               // sky ambient
        pearl+=vec3(1.0,0.80,0.72)*0.09*exp(-pow((ndl0-0.02)/0.22,2.0));      // subsurface glow at the terminator
        vec3 specCol=mix(vec3(1.0,0.96,0.92),iri,0.45);
        pearl+=specCol*(pow(nh,8.0)*0.22+pow(nh,70.0)*0.55+pow(nh,600.0)*1.4)*lit;   // broad lustre + soft and tight highlights
        pearl+=vec3(0.70,0.66,1.0)*pow(nhf,30.0)*0.10;
        pearl+=iri*fres*0.46*smoothstep(-0.25,0.6,ndl0);                      // orient: nacre overtone at grazing angles

        /* black-pearl inlay */
        vec3 ink=vec3(0.026,0.030,0.058)*max((ndl+0.15)/1.15,0.0);
        ink+=mix(vec3(0.85),iri,0.75)*(pow(nh,46.0)*0.55+pow(nh,320.0)*1.2)*lit;
        ink+=iri*vec3(0.55,0.75,1.0)*0.075*(0.35+0.65*ndv)*smoothstep(-0.1,0.6,ndl0);
        ink+=vec3(0.30,0.28,0.55)*pow(nhf,24.0)*0.06;

        vec3 col=mix(pearl,ink,inlay);
        col+=vec3(0.78,0.74,1.0)*pow(1.0-max(dot(n0,V),0.0),4.0)*0.22*smoothstep(-0.6,0.4,ndl0);
        col+=vec3(0.002,0.002,0.006);
        col=1.0-exp(-col*uExposure);
        gl_FragColor=vec4(pow(col,vec3(1.0/2.2)),1.0);
      }`
  });
  const earthMesh=new T.Mesh(new T.SphereGeometry(EARTH_R,180,120),earthMat);
  earth.add(earthMesh);
  earthGroup.add(earth);
  scene.add(earthGroup);

  atmMat=new T.ShaderMaterial({
    uniforms:{uSun:{value:sunDir},uR:{value:EARTH_R*0.995},uRa:{value:ATM_R}},
    vertexShader:`varying vec3 vPos; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vPos=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader:`uniform vec3 uSun; uniform float uR,uRa; varying vec3 vPos;
      void main(){
        vec3 ro=cameraPosition; vec3 rd=normalize(vPos-ro);
        float t=-dot(ro,rd); vec3 pc=ro+rd*t; float b=length(pc);
        float x=clamp((b-uR)/(uRa-uR),0.0,1.0);
        float dens=pow(1.0-x,4.2)*(b<uR?0.0:1.0);
        vec3 nrm=normalize(pc); float s=dot(nrm,normalize(uSun));
        float lit=smoothstep(-0.45,0.55,s);
        vec3 col=mix(vec3(0.34,0.26,0.62)*0.22,vec3(0.80,0.78,1.0)*0.62,lit)*dens;
        col+=vec3(1.0,0.72,0.62)*exp(-pow(s/0.18,2.0))*dens*0.22;
        gl_FragColor=vec4(col,1.0);
      }`,
    side:T.BackSide, transparent:true, depthWrite:false, blending:T.AdditiveBlending
  });
  const atm=new T.Mesh(new T.SphereGeometry(ATM_R,128,64),atmMat); atm.renderOrder=2; scene.add(atm);
}
/* the planet turns its symbol toward the overview camera and sways gently around that pose */
const planetBase=new T.Quaternion(), planetTarget=new T.Quaternion(), planetSway=new T.Quaternion(), swayEuler=new T.Euler();
let planetPoseSet=false;
function aimPlanet(state){
  const z=new V3(Math.cos(state[1])*Math.sin(state[0]),Math.sin(state[1]),Math.cos(state[1])*Math.cos(state[0])).normalize();
  const x=new V3().crossVectors(UP,z).normalize(), y=new V3().crossVectors(z,x);
  planetTarget.setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
  if (!planetPoseSet){ planetBase.copy(planetTarget); planetPoseSet=true; }
}

/* =========================================================
   6. CAMERA MATH
   ========================================================= */
// state vector: [azimuth, elevation, radius, targetX, targetY, targetZ, lensShiftX, lensShiftY, fov, roll]
function applyState(cam, s, ox, oy){
  const a=s[0]+(ox||0), e=clamp(s[1]+(oy||0),-1.45,1.45), r=s[2];
  cam.position.set(r*Math.cos(e)*Math.sin(a), r*Math.sin(e), r*Math.cos(e)*Math.cos(a));
  cam.up.copy(UP); cam.lookAt(s[3],s[4],s[5]);
  if (s[9]) cam.rotateZ(s[9]);
  cam.fov=s[8]; cam.updateProjectionMatrix();
  const m=cam.projectionMatrix.elements; m[8]=-s[6]; m[9]=-s[7];
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  cam.updateMatrixWorld(true);
}
function solveCam(C, cfg){
  const L=C.length(), c=C.clone().normalize(), th=cfg.theta*DEG, rp=cfg.rp;
  const angC=Math.asin(clamp(rp*Math.sin(th)/L,-1,1)), beta=Math.PI-th-angC;
  let e1=new V3().crossVectors(c,UP); if (e1.lengthSq()<1e-6) e1.set(1,0,0); e1.normalize();
  const e2=new V3().crossVectors(e1,c).normalize(), phi=cfg.phi*DEG;
  let best=null, bestErr=1e9;
  for (let i=0;i<720;i++){
    const psi=i/720*TAU;
    const w=e1.clone().multiplyScalar(Math.cos(psi)).addScaledVector(e2,Math.sin(psi));
    const P=c.clone().multiplyScalar(rp*Math.cos(beta)).addScaledVector(w,rp*Math.sin(beta));
    const v=C.clone().sub(P).normalize();
    const right=new V3().crossVectors(v,UP).normalize(), up=new V3().crossVectors(right,v);
    const dO=P.clone().negate().normalize();
    let err=Math.abs(wrapPi(Math.atan2(dO.dot(up),dO.dot(right))-phi));
    err+=Math.max(0,Math.abs(Math.asin(P.y/rp))-1.0)*3;
    if (err<bestErr){ bestErr=err; best=P; }
  }
  return best;
}
const isPhone=()=> W<761 || W/H<0.75;

/* =========================================================
   7. CONSTELLATIONS (fixed world positions, oriented once)
   ========================================================= */
const CONS = ORDER.map(id=>{
  const idn=IDENTITY[id], C=new V3(...idn.pos), sh=shape(idn.shape);
  // orient the star plane between the overview line of sight and the destination line of sight
  const Pd=solveCam(C,idn.desk);
  const ovPos=new V3(Math.sin(-0.14)*34,Math.sin(0.11)*34,Math.cos(-0.14)*34);
  const nD=Pd.clone().sub(C).normalize(); let nO=ovPos.clone().sub(C).normalize(); if (nO.dot(nD)<0) nO.negate();
  const n=nD.clone().multiplyScalar(0.62).addScaledVector(nO,0.38).normalize();
  const v=C.clone().sub(Pd).normalize(), right=new V3().crossVectors(v,UP).normalize();
  const u=right.clone().addScaledVector(n,-right.dot(n)).normalize(), w=new V3().crossVectors(n,u);
  const stars=sh.p.map((p,i)=>{
    const z=(rand()-0.5)*0.35;
    const P=C.clone().addScaledVector(u,p[0]*CONST_SCALE).addScaledVector(w,p[1]*CONST_SCALE).addScaledVector(n,z*CONST_SCALE);
    return {P, size:0.075*sh.m[i], ph:rand()*TAU, tw:0.6+rand()*0.9, sx:0, sy:0, d:1, vis:1, ok:false};
  });
  return {id, idn, C, stars, edges:sh.e, rgb:idn.rgb.join(','), h:0, a:0, dim:1, traceT0:-1e9, glow:null,
          cx:0, cy:0, cr:0, cOk:false, coord:raDec(idn.pos)};
});
const CON = Object.fromEntries(CONS.map(k=>[k.id,k]));
function makeGlow(rgb){
  const c=document.createElement('canvas'); c.width=c.height=96; const g=c.getContext('2d');
  const gr=g.createRadialGradient(48,48,0,48,48,48);
  gr.addColorStop(0,'rgba(255,255,255,0.95)'); gr.addColorStop(0.09,`rgba(${rgb},0.75)`); gr.addColorStop(0.28,`rgba(${rgb},0.16)`); gr.addColorStop(1,`rgba(${rgb},0)`);
  g.fillStyle=gr; g.fillRect(0,0,96,96); return c;
}
CONS.forEach(k=>k.glow=makeGlow(k.rgb));

/* camera states per layout */
const STATES={};
function overviewState(){
  const phone=isPhone(), fov=phone?50:40, az=phone?-51*DEG:-0.14, el=phone?9*DEG:0.11, sy=phone?-0.07:-0.04;
  const tmp=new T.PerspectiveCamera(fov,W/H,0.1,4000), v=new V3(), A=W/H, tf=Math.tan(fov*DEG/2);
  const st=r=>[az,el,r,0,0.3,0,0,sy,fov,0];
  if (phone){
    // portrait: smallest distance where every constellation, its label and Earth stay clear of each other
    const fitsPhone=r=>{
      applyState(tmp,st(r));
      const pts=[];
      for (const k of CONS){
        v.copy(k.C).applyMatrix4(tmp.matrixWorldInverse); const z=-v.z; if (z<1) return false;
        v.copy(k.C).project(tmp); pts.push([v.x*A,v.y,2.5/z/tf]);
      }
      v.set(0,0,0).project(tmp); const eX=v.x*A, eY=v.y, eR=EARTH_R/Math.sqrt(Math.max(r*r-16,1))/tf;
      for (const [X,Y,rad] of pts){
        if (Math.abs(X)+rad*0.5>A*0.9 || Y+rad>0.48 || Y-rad-0.06<-0.80) return false;
        if (Math.hypot(X-eX,Y-eY)<eR+rad+0.05) return false;
      }
      for (let i=0;i<pts.length;i++) for (let j=i+1;j<pts.length;j++)
        if (Math.hypot(pts[i][0]-pts[j][0],pts[i][1]-pts[j][1])<pts[i][2]+pts[j][2]+0.10) return false;
      return true;
    };
    for (let r=16;r<130;r+=0.5) if (fitsPhone(r)) return st(r);
  }
  const fits=r=>{
    applyState(tmp,st(r));
    for (const k of CONS) for (const s of k.stars){
      v.copy(s.P).project(tmp);
      const yTop=phone?0.50:0.72, yBot=phone?-0.62:-0.78, xm=phone?0.80:0.86;
      if (v.x<-xm||v.x>xm||v.y>yTop||v.y<yBot) return false;
    }
    return true;
  };
  let lo=20, hi=220; for (let i=0;i<24;i++){ const m=(lo+hi)/2; if (fits(m)) hi=m; else lo=m; }
  return st(Math.max(hi,phone?36:31));
}
function buildStates(){
  const phone=isPhone(), lay=phone?LAYOUT.mob:LAYOUT.desk;
  STATES.overview=overviewState();
  aimPlanet(STATES.overview);
  for (const k of CONS){
    const P=solveCam(k.C, phone?k.idn.mob:k.idn.desk), r=P.length();
    STATES[k.id]=[Math.atan2(P.x,P.z),Math.asin(P.y/r),r,k.C.x,k.C.y,k.C.z,lay.sx,lay.sy,lay.fov,0];
  }
}

/* =========================================================
   8. FLIGHT (quintic Hermite; mid-flight redirects keep velocity)
   ========================================================= */
const cam={cur:null, vel:new Array(10).fill(0), tw:null};
function startTween(to, dur){
  const from=cam.cur.slice(), v0=cam.vel.slice(), t=to.slice();
  t[0]=from[0]+wrapPi(t[0]-from[0]);
  cam.tw={from,to:t,v0,dur,t0:performance.now()/1000};
}
function flightDur(from,to){
  const a=new V3(Math.cos(from[1])*Math.sin(from[0]),Math.sin(from[1]),Math.cos(from[1])*Math.cos(from[0]));
  const b=new V3(Math.cos(to[1])*Math.sin(to[0]),Math.sin(to[1]),Math.cos(to[1])*Math.cos(to[0]));
  const ang=Math.acos(clamp(a.dot(b),-1,1)), zoom=Math.abs(Math.log(to[2]/from[2]));
  return clamp(1.4+0.32*ang/Math.PI+0.12*zoom,1.4,1.8);
}
function stepCam(t){
  const tw=cam.tw; if (!tw) return 1;
  let u=(t-tw.t0)/tw.dur;
  if (u>=1){ cam.cur=tw.to.slice(); cam.vel.fill(0); cam.tw=null; return 1; }
  u=Math.max(0,u);
  const u2=u*u,u3=u2*u,u4=u3*u,u5=u4*u;
  const H0=1-10*u3+15*u4-6*u5, H1=u-6*u3+8*u4-3*u5, H5=10*u3-15*u4+6*u5;
  const d0=-30*u2+60*u3-30*u4, d1=1-18*u2+32*u3-15*u4, d5=30*u2-60*u3+30*u4;
  for (let i=0;i<10;i++){
    cam.cur[i]=H0*tw.from[i]+H1*tw.v0[i]*tw.dur+H5*tw.to[i];
    cam.vel[i]=(d0*tw.from[i]+d1*tw.v0[i]*tw.dur+d5*tw.to[i])/tw.dur;
  }
  return u;
}

/* =========================================================
   9. DOM: nav, hit areas, destination copy, tracker
   ========================================================= */
const prefersReduced=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false,addEventListener(){}} ;
let userReduced=null;
const reduced=()=> userReduced===null ? prefersReduced.matches : userReduced;
function syncMotionUI(){ app.classList.toggle('reduced',reduced()); $('motionBtn').setAttribute('aria-pressed',String(reduced())); }
$('motionBtn').addEventListener('click',()=>{ userReduced=!reduced(); syncMotionUI(); });
try{ prefersReduced.addEventListener('change',syncMotionUI); }catch(e){}
syncMotionUI();

const totalItems=DATA.destinations.reduce((s,d)=>s+d.counts.total,0);
$('ovEyebrow').textContent='Q4 2026 · 5 programs · '+totalItems+' work items';
$('footUpdated').textContent='Updated '+asOfText;

// nav
const navList=$('navList'), navBtns={};
function navItem(key,label,rgb){
  const li=document.createElement('li'), b=document.createElement('button');
  b.type='button'; b.className='nav-btn'; b.innerHTML='<span class="dot" aria-hidden="true"></span><span></span>';
  b.lastChild.textContent=label; if (rgb) b.style.setProperty('--c',rgb);
  b.addEventListener('click',()=>go(key==='overview'?{view:'overview'}:{view:'dest',id:key}));
  li.appendChild(b); navList.appendChild(li); navBtns[key]=b;
  return li;
}
navItem('overview','Overview');
const sep=document.createElement('li'); sep.className='nav-sep'; sep.setAttribute('aria-hidden','true'); navList.appendChild(sep);
ORDER.forEach(id=>navItem(id,DEST[id].name,CON[id].rgb));

// hit areas
const hitsEl=$('hits');
CONS.forEach((k,i)=>{
  const d=DEST[k.id], b=document.createElement('button');
  b.type='button'; b.className='hit'; b.style.setProperty('--hc',k.rgb);
  b.setAttribute('aria-label',d.name+'. '+d.tagline+' Explore progress.');
  b.innerHTML='<span class="hit-label"><span class="hit-name"></span><span class="hit-coord"></span><span class="hit-desc"></span></span>';
  b.querySelector('.hit-name').textContent=d.name;
  b.querySelector('.hit-coord').textContent=k.coord;
  b.querySelector('.hit-desc').textContent=d.tagline;
  b.addEventListener('pointerenter',()=>setHover(k.id));
  b.addEventListener('pointerleave',()=>setHover(null));
  b.addEventListener('focus',()=>setHover(k.id));
  b.addEventListener('blur',()=>setHover(null));
  b.addEventListener('click',()=>go({view:'dest',id:k.id}));
  hitsEl.appendChild(b); k.btn=b; k.label=b.querySelector('.hit-label');
});
let hoverId=null;
function setHover(id){
  if (id===hoverId) return; hoverId=id;
  if (id){ const k=CON[id]; if (performance.now()-k.traceT0>1400) k.traceT0=performance.now(); }
}

// destination panel
const destEl=$('dest'), metricEls=[...destEl.querySelectorAll('.metric')];
const ovEl=$('overview');
let revealTimers=[], countRAFs=[];
function clearReveal(){ revealTimers.forEach(clearTimeout); revealTimers=[]; countRAFs.forEach(cancelAnimationFrame); countRAFs=[]; }
function hideDest(){
  clearReveal();
  metricEls.forEach(m=>m.classList.remove('is-in'));
  destEl.classList.remove('is-foot');
  revealTimers.push(setTimeout(()=>destEl.classList.remove('is-head'),90));
  destEl.setAttribute('inert','');
}
function fillDest(id){
  const d=DEST[id], k=CON[id], c=d.counts;
  app.style.setProperty('--acc',k.rgb);
  $('destKicker').textContent=k.idn.form+' constellation · '+k.coord;
  $('destTitle').textContent=d.name;
  $('destSummary').textContent=d.summary;
  metricEls.forEach(m=>{ m.querySelector('.num').textContent='0'; m.dataset.target=c[m.dataset.k]; });
  const link=$('ctaTrackerLink'), btn=$('ctaTracker');
  if (d.trackerUrl){ link.href=d.trackerUrl; link.hidden=false; btn.hidden=true; } else { link.hidden=true; btn.hidden=false; }
  const pct=c.total?Math.round(c.completed/c.total*100):0;
  $('destCaption').innerHTML='';
  const cap=$('destCaption');
  const b1=document.createElement('b'); b1.textContent=d.scope; cap.appendChild(b1);
  cap.appendChild(document.createTextNode(' · '+c.total+' '+d.workItemLevel+(c.total===1?'':'s')+', each counted once · '+pct+'% complete · In review counts as in progress · Updated '+asOfText+' · '));
  const b2=document.createElement('b'); b2.textContent='Demo data'; cap.appendChild(b2);
}
function countUp(el,target,instant){
  if (instant||target===0){ el.textContent=String(target); return; }
  const t0=performance.now(), dur=650;
  const step=now=>{ const u=clamp((now-t0)/dur,0,1), e=1-Math.pow(1-u,3); el.textContent=String(Math.round(target*e)); if (u<1) countRAFs.push(requestAnimationFrame(step)); };
  countRAFs.push(requestAnimationFrame(step));
}
function revealMetrics(instant){
  metricEls.forEach((m,i)=>{
    const run=()=>{ m.classList.add('is-in'); countUp(m.querySelector('.num'),+m.dataset.target,instant); };
    if (instant) run(); else revealTimers.push(setTimeout(run,i*150));
  });
}
function announce(id){
  const d=DEST[id], c=d.counts;
  $('live').textContent=d.name+': '+c.completed+' completed, '+c.inProgress+' in progress, '+c.backlog+' in backlog.';
}

// tracker preview
const trEl=$('tracker'); let trackerOpen=false, trFilter='all', trFor=null, trCloseTimer=0;
function renderTracker(id){
  const d=DEST[id], c=d.counts; trFor=id;
  $('trBackName').textContent=d.name;
  $('trKicker').textContent='Tracker preview · '+d.workItemLevel+' level';
  $('trTitle').textContent=d.name;
  $('trSub').textContent=d.scope+' · '+c.total+' '+d.workItemLevel+'s · Updated '+asOfText+' · Demo data';
  const f=$('trFilters'); f.innerHTML='';
  [['all','All',c.total],['completed','Completed',c.completed],['inProgress','In progress',c.inProgress],['backlog','Backlog',c.backlog]].forEach(([key,label,n])=>{
    const b=document.createElement('button'); b.type='button'; b.className='chip'; b.dataset.f=key;
    b.setAttribute('aria-pressed',String(trFilter===key));
    b.innerHTML='<span></span><b></b>'; b.firstChild.textContent=label; b.lastChild.textContent=n;
    b.addEventListener('click',()=>{ trFilter=key; renderTracker(id); });
    f.appendChild(b);
  });
  const list=$('trList'); list.innerHTML='';
  const rank={inProgress:0,backlog:1,completed:2};
  const items=d.items.filter(it=>trFilter==='all'||STATUS[it.status].group===trFilter)
    .slice().sort((a,b)=>(rank[STATUS[a.status].group]-rank[STATUS[b.status].group])||(a.due<b.due?-1:1));
  if (!items.length){ const li=document.createElement('li'); li.className='tr-empty'; li.textContent='No work items with this status.'; list.appendChild(li); }
  items.forEach(it=>{
    const s=STATUS[it.status], li=document.createElement('li'); li.className='tr-row';
    li.innerHTML='<span class="tr-status"><i class="st"></i><span></span></span><span class="tr-title"><span class="t"></span><span class="tr-id"></span></span><span class="tr-owner"></span><span class="tr-ms"><span class="m"></span><time></time></span>';
    li.querySelector('.st').classList.add(s.glyph);
    li.querySelector('.tr-status span').textContent=s.label;
    li.querySelector('.t').textContent=it.title;
    li.querySelector('.tr-id').textContent=it.id;
    li.querySelector('.tr-owner').textContent=it.owner;
    li.querySelector('.m').textContent=it.milestone;
    const tm=li.querySelector('time'); tm.dateTime=it.due; tm.textContent=fmtDue(it.due);
    list.appendChild(li);
  });
}
function openTracker(id){
  clearTimeout(trCloseTimer);
  if (trFor!==id) trFilter='all';
  renderTracker(id); trEl.hidden=false; trackerOpen=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>trEl.classList.add('is-open')));
  destEl.setAttribute('inert',''); hitsEl.setAttribute('inert','');
  setTimeout(()=>$('trTitle').focus({preventScroll:true}),60);
}
function closeTracker(restoreFocus){
  if (!trackerOpen) return; trackerOpen=false;
  trEl.classList.remove('is-open');
  trCloseTimer=setTimeout(()=>{ trEl.hidden=true; },420);
  if (route.view==='dest') destEl.removeAttribute('inert');
  if (restoreFocus){ const b=$('ctaTracker'); setTimeout(()=>{ if(!b.hidden) b.focus({preventScroll:true}); },40); }
}
trEl.addEventListener('keydown',e=>{
  if (e.key!=='Tab') return;
  const f=[...trEl.querySelectorAll('button,[href],[tabindex]:not([tabindex="-1"])')].filter(x=>!x.hidden&&x.offsetParent!==null);
  if (!f.length) return; const first=f[0], last=f[f.length-1];
  if (e.shiftKey&&document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if (!e.shiftKey&&document.activeElement===last){ e.preventDefault(); first.focus(); }
});
$('ctaTracker').addEventListener('click',()=>{ if (route.view==='dest') go({view:'dest',id:route.id,tracker:true}); });
$('ctaOverview').addEventListener('click',()=>go({view:'overview'}));
$('trBack').addEventListener('click',()=>go({view:'dest',id:trFor}));
$('trOverview').addEventListener('click',()=>go({view:'overview'}));

/* =========================================================
   10. ROUTING (bare-token hashes: #helias, #helias.tracker)
   ========================================================= */
let route={view:'boot'}, flight=null, activeId=null;
const keyOf=r=>r.view==='dest'?r.id:'overview';
const hashFor=r=>r.view==='dest'?'#'+r.id+(r.tracker?'.tracker':''):'#overview';
function parseHash(){
  let h=''; try{ h=decodeURIComponent(location.hash.slice(1)); }catch(e){}
  const [id,sub]=h.split('.');
  if (DEST[id]) return {view:'dest',id,tracker:sub==='tracker'};
  return {view:'overview'};
}
function writeHash(r){
  const h=hashFor(r); if (location.hash===h) return;
  try{ history.pushState(null,'',h); } catch(e){ try{ location.hash=h; }catch(_){} }
}
function go(r){ writeHash(r); applyRoute(r); }
window.addEventListener('popstate',()=>{ const r=parseHash(); if (hashFor(r)!==hashFor(route)) applyRoute(r); });
window.addEventListener('hashchange',()=>{ const r=parseHash(); if (hashFor(r)!==hashFor(route)) applyRoute(r); });

function updateNav(key){
  for (const k in navBtns){ if (k===key) navBtns[k].setAttribute('aria-current','page'); else navBtns[k].removeAttribute('aria-current'); }
  const b=navBtns[key]; if (b && isPhone()) try{ b.scrollIntoView({inline:'center',block:'nearest',behavior:reduced()?'auto':'smooth'}); }catch(e){}
}
function applyRoute(r){
  const prevKey=route.view==='boot'?null:keyOf(route), nextKey=keyOf(r);
  route=r; updateNav(nextKey);
  if (prevKey!==nextKey){ closeTracker(false); beginFlight(nextKey, !!r.tracker); }
  else if (r.view==='dest'){
    if (r.tracker && !trackerOpen && !flight) openTracker(r.id);
    else if (r.tracker && flight) flight.wantTracker=true;
    else if (!r.tracker && trackerOpen) closeTracker(true);
  }
}
function setOverviewUI(on){
  ovEl.classList.toggle('is-in',on); hitsEl.classList.toggle('is-in',on);
  if (on){ ovEl.removeAttribute('inert'); hitsEl.removeAttribute('inert'); } else { ovEl.setAttribute('inert',''); hitsEl.setAttribute('inert',''); }
}
function beginFlight(key, wantTracker){
  activeId=key==='overview'?null:key;
  hideDest();
  if (key!=='overview') setOverviewUI(false); else { hitsEl.classList.remove('is-in'); }
  setHover(null);
  accent.target=0; accent.pending=activeId;
  const to=STATES[key];
  flight={key,fired:{},wantTracker};
  if (reduced()){
    const veil=$('veil'); veil.classList.add('on');
    revealTimers.push(setTimeout(()=>{
      cam.tw=null; cam.cur=to.slice(); cam.vel.fill(0);
      runStages(1,true);
      requestAnimationFrame(()=>veil.classList.remove('on'));
    },190));
    return;
  }
  startTween(to, flightDur(cam.cur,to));
}
function runStages(u, instant){
  const f=flight; if (!f) return;
  const fire=(name,at,fn)=>{ if (!f.fired[name] && u>=at){ f.fired[name]=1; fn(); } };
  if (f.key==='overview'){
    fire('copy',0.48,()=>setOverviewUI(true));
  } else {
    const id=f.key, k=CON[id];
    fire('head',0.40,()=>{ fillDest(id); destEl.classList.add('is-head'); destEl.removeAttribute('inert'); });
    fire('trace',0.52,()=>{ k.traceT0=performance.now(); });
    fire('metrics',0.66,()=>revealMetrics(instant));
    fire('foot',instant?0:0.97,()=>{
      destEl.classList.add('is-foot'); announce(id);
      if (!f.wantTracker && document.activeElement && (document.activeElement===document.body || document.activeElement.closest('.hit'))) $('destTitle').focus({preventScroll:true});
    });
  }
  if (u>=1){ const want=f.wantTracker, key=f.key; flight=null; if (want && key!=='overview') openTracker(key); }
}

/* keyboard */
window.addEventListener('keydown',e=>{
  if (e.metaKey||e.ctrlKey||e.altKey) return;
  const tag=(e.target&&e.target.tagName)||'';
  if (tag==='INPUT'||tag==='TEXTAREA') return;
  if (e.key==='Escape'){
    if (trackerOpen) { e.preventDefault(); go({view:'dest',id:trFor}); }
    else if (route.view==='dest'){ e.preventDefault(); go({view:'overview'}); }
    return;
  }
  if (trackerOpen) return;
  if (/^[1-5]$/.test(e.key)){ go({view:'dest',id:ORDER[+e.key-1]}); return; }
  if (e.key==='0'){ go({view:'overview'}); return; }
  if ((e.key==='ArrowRight'||e.key==='ArrowLeft') && !(e.target&&e.target.closest&&e.target.closest('#nav'))){
    const i=route.view==='dest'?ORDER.indexOf(route.id):-1, n=ORDER.length;
    const j=e.key==='ArrowRight'?(i+1)%n:(i<=0?n-1:i-1);
    go({view:'dest',id:ORDER[j]});
  }
});

/* pointer parallax */
const ptr={x:0,y:0,sx:0,sy:0};
window.addEventListener('pointermove',e=>{ if (e.pointerType==='mouse'){ ptr.x=(e.clientX/W)*2-1; ptr.y=(e.clientY/H)*2-1; } },{passive:true});

/* =========================================================
   11. RESIZE
   ========================================================= */
function resize(){
  W=innerWidth; H=innerHeight; DPR=Math.min(window.devicePixelRatio||1,2);
  if (hasGL){ renderer.setPixelRatio(DPR); renderer.setSize(W,H,false); starLayers.forEach(m=>m.uniforms.uPR.value=DPR); }
  chart.width=Math.round(W*DPR); chart.height=Math.round(H*DPR);
  camera.aspect=W/H;
  buildStates();
  try{ measureLabels(); }catch(e){}
  if (cam.cur){
    const key=route.view==='boot'?'overview':keyOf(route);
    if (cam.tw){ const t=STATES[key].slice(); t[0]=cam.tw.from[0]+wrapPi(t[0]-cam.tw.from[0]); cam.tw.to=t; }
    else cam.cur=STATES[key].slice();
  }
}
window.addEventListener('resize',resize);

/* =========================================================
   12. CHART LAYER (constellations drawn crisp in 2D, occluded by Earth)
   ========================================================= */
const pv=new V3(), camPos=new V3(), dirTmp=new V3();
function project(P,out){
  pv.copy(P).applyMatrix4(camera.matrixWorldInverse); const depth=-pv.z;
  pv.applyMatrix4(camera.projectionMatrix);
  out.sx=(pv.x*0.5+0.5)*W*DPR; out.sy=(-pv.y*0.5+0.5)*H*DPR; out.d=depth; out.ok=depth>0.4;
  return out;
}
function occlusion(P){
  dirTmp.copy(P).sub(camPos); const len=dirTmp.length(); dirTmp.divideScalar(len);
  const t=-camPos.dot(dirTmp); if (t<=0||t>=len) return 1;
  const dist=Math.sqrt(Math.max(0,camPos.lengthSq()-t*t));
  return smooth(EARTH_R*0.97,EARTH_R*1.08,dist);
}
function drawEarthFallback(){
  const o={}; project(new V3(0,0,0),o); if (!o.ok) return;
  const r=EARTH_R*(H*DPR/2)/Math.tan(camera.fov*DEG/2)/o.d;
  const g=ctx.createRadialGradient(o.sx-r*0.35,o.sy-r*0.3,r*0.1,o.sx,o.sy,r);
  g.addColorStop(0,'#f3f1f4'); g.addColorStop(0.6,'#c9c5d6'); g.addColorStop(1,'#4a4566');
  ctx.globalCompositeOperation='source-over'; ctx.fillStyle=g; ctx.beginPath(); ctx.arc(o.sx,o.sy,r,0,TAU); ctx.fill();
}
const LBL={};
function drawChart(now,dt){
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,chart.width,chart.height);
  if (!hasGL) drawEarthFallback();
  camPos.copy(camera.position);
  const focal=(H*DPR/2)/Math.tan(camera.fov*DEG/2);
  const kH=1-Math.exp(-dt*9), kA=1-Math.exp(-dt*2.6);
  ctx.globalCompositeOperation='lighter'; ctx.lineCap='round';
  for (const k of CONS){
    k.h+=((hoverId===k.id?1:0)-k.h)*kH;
    k.a+=((activeId===k.id?1:0)-k.a)*kA;
    k.dim+=(((activeId&&activeId!==k.id)?0.32:1)-k.dim)*kA;
    const em=Math.max(k.h,k.a);
    // center + extent for hit areas
    project(k.C,LBL); k.cx=LBL.sx; k.cy=LBL.sy; k.cOk=LBL.ok;
    let maxR=0, visSum=0;
    for (const s of k.stars){
      project(s.P,s); s.vis=s.ok?occlusion(s.P):0; visSum+=s.vis;
      if (s.ok){ const dx=s.sx-k.cx, dy=s.sy-k.cy; maxR=Math.max(maxR,Math.hypot(dx,dy)); }
    }
    k.cr=maxR; k.visFrac=visSum/k.stars.length;
    if (!k.cOk || visSum<0.01) continue;
    // atmospheric accent
    const haloR=Math.max(maxR*1.9,40*DPR), haloA=(0.030+0.07*em)*k.dim*k.visFrac;
    const hg=ctx.createRadialGradient(k.cx,k.cy,0,k.cx,k.cy,haloR);
    hg.addColorStop(0,`rgba(${k.rgb},${haloA})`); hg.addColorStop(1,`rgba(${k.rgb},0)`);
    ctx.globalAlpha=1; ctx.fillStyle=hg; ctx.fillRect(k.cx-haloR,k.cy-haloR,haloR*2,haloR*2);
    // fine connecting lines
    const lw=(0.75+0.45*em)*DPR;
    for (const [a,b] of k.edges){
      const A=k.stars[a], B=k.stars[b]; if (!A.ok||!B.ok) continue;
      const al=(0.17+0.33*em)*Math.min(A.vis,B.vis)*k.dim; if (al<0.005) continue;
      ctx.strokeStyle=`rgba(${k.rgb},${al})`; ctx.lineWidth=lw;
      ctx.beginPath(); ctx.moveTo(A.sx,A.sy); ctx.lineTo(B.sx,B.sy); ctx.stroke();
    }
    // tracing pulse along the lines
    const tr=reduced()?1:clamp((now-k.traceT0)/1300,0,1);
    if (tr<1){
      const E=k.edges.length, total=E*0.42+1, fade=1-smooth(0.82,1,tr);
      k.edges.forEach(([a,b],i)=>{
        const A=k.stars[a], B=k.stars[b]; if (!A.ok||!B.ok) return;
        const p=clamp(tr*total-i*0.42,0,1); if (p<=0) return;
        const x=A.sx+(B.sx-A.sx)*p, y=A.sy+(B.sy-A.sy)*p, v=Math.min(A.vis,B.vis)*k.dim*fade;
        ctx.strokeStyle=`rgba(255,255,255,${0.55*v})`; ctx.lineWidth=lw*1.25;
        ctx.beginPath(); ctx.moveTo(A.sx,A.sy); ctx.lineTo(x,y); ctx.stroke();
        if (p<1){ ctx.globalAlpha=v; const g=6*DPR; ctx.drawImage(k.glow,x-g,y-g,g*2,g*2); ctx.globalAlpha=1; }
      });
    }
    // luminous stars
    for (const s of k.stars){
      if (!s.ok||s.vis<0.01) continue;
      const r=clamp(s.size*focal/s.d,0.7*DPR,5.2*DPR)*(1+0.28*em);
      const tw=0.86+0.14*Math.sin(now*0.0011*s.tw+s.ph);
      const al=s.vis*k.dim*(0.62+0.38*em)*tw;
      const g=r*6.5;
      ctx.globalAlpha=al; ctx.drawImage(k.glow,s.sx-g,s.sy-g,g*2,g*2);
      ctx.globalAlpha=Math.min(1,al*1.1); ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(s.sx,s.sy,r*0.42,0,TAU); ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  ctx.globalCompositeOperation='source-over';
}
const EO={};
function measureLabels(){
  for (const k of CONS){
    const n=k.btn.querySelector('.hit-name'), c=k.btn.querySelector('.hit-coord'), cv=c.offsetParent!==null;
    k.lw=Math.max(n.offsetWidth, cv?c.offsetWidth:0)||120;
    k.lh=(n.offsetHeight||18)+(cv?(c.offsetHeight+3):0);
    k.LW=k.label.offsetWidth||240;
  }
}
if (document.fonts&&document.fonts.ready) document.fonts.ready.then(measureLabels);
const rectHit=(a,b,m)=>a.x<b.x+b.w+m && a.x+a.w+m>b.x && a.y<b.y+b.h+m && a.y+a.h+m>b.y;
function rectCircle(r,cx,cy,rad){ const px=clamp(cx,r.x,r.x+r.w), py=clamp(cy,r.y,r.y+r.h); return Math.hypot(px-cx,py-cy)<rad; }
function boxOf(el,pad){ if (!el||el.offsetParent===null) return null; const b=el.getBoundingClientRect(); if (!b.width) return null; return {x:b.x-pad,y:b.y-pad,w:b.width+pad*2,h:b.height+pad*2}; }
function placeHits(){
  if (!hitsEl.classList.contains('is-in') && route.view==='dest') return;
  const pad=12, phone=isPhone();
  project(new V3(0,0,0),EO);
  const ex=EO.sx/DPR, ey=EO.sy/DPR, er=EO.ok?EARTH_R*(H/2)/Math.tan(camera.fov*DEG/2)/EO.d:0;
  const obstacles=[boxOf(ovEl.querySelector('h1'),6),boxOf(ovEl.querySelector('.instr'),6),boxOf($('nav'),4),boxOf(document.querySelector('.foot'),6)].filter(Boolean);
  const placed=[];
  for (const k of CONS){
    const b=k.btn;
    if (!k.cOk||k.visFrac<0.3){ b.style.visibility='hidden'; continue; }
    b.style.visibility='';
    if (!k.lw) measureLabels();
    const cx=k.cx/DPR, cy=k.cy/DPR, cr=k.cr/DPR, R=Math.max(cr+22,46), size=R*2;
    b.style.width=size+'px'; b.style.height=size+'px';
    b.style.transform=`translate3d(${(cx-R).toFixed(1)}px,${(cy-R).toFixed(1)}px,0)`;
    const w=k.lw, h=k.lh, g=cr+8;
    const cands=[['below',cx-w/2,cy+g],['above',cx-w/2,cy-g-h],['right',cx+g+4,cy-h/2],['left',cx-g-4-w,cy-h/2]];
    let best=null;
    cands.forEach(([pos,x,y],i)=>{
      if (pos==='below'||pos==='above') x=clamp(x,pad,W-pad-w);
      const r={x,y,w,h}; let pen=i*2;
      pen+=(Math.max(0,pad-x)+Math.max(0,x+w-(W-pad))+Math.max(0,pad-y)+Math.max(0,y+h-(H-pad)))*20;
      if (!phone && y+h>H-64) pen+=60;
      if (er>0 && rectCircle(r,ex,ey,er+10)) pen+=1000;
      for (const o of CONS) if (o!==k && o.cOk && o.visFrac>0.3 && rectCircle(r,o.cx/DPR,o.cy/DPR,o.cr/DPR*0.85+4)) pen+=500;
      for (const p of placed) if (rectHit(r,p,6)) pen+=800;
      for (const o of obstacles) if (rectHit(r,o,0)) pen+=600;
      if (pos===k.lastPos) pen-=3;
      if (!best||pen<best.pen) best={pos,r,pen};
    });
    k.lastPos=best.pos; placed.push(best.r);
    const L=k.label, LW=k.LW||(phone?176:240);
    let boxLeft=best.r.x+w/2-LW/2;
    if (best.pos==='right') boxLeft=best.r.x; else if (best.pos==='left') boxLeft=best.r.x+w-LW;
    const boxY=best.pos==='above'?best.r.y+h:best.r.y;
    L.classList.toggle('pos-above',best.pos==='above'); L.classList.toggle('pos-right',best.pos==='right'); L.classList.toggle('pos-left',best.pos==='left');
    L.style.setProperty('--lx',(boxLeft-(cx-R)).toFixed(1)+'px'); L.style.setProperty('--ly',(boxY-(cy-R)).toFixed(1)+'px');
  }
}

/* =========================================================
   13. LOOP
   ========================================================= */
let last=performance.now(), visible=true;
document.addEventListener('visibilitychange',()=>{ visible=!document.hidden; if (visible){ last=performance.now(); requestAnimationFrame(frame); } });
function frame(now){
  if (!visible) return;
  const dt=Math.min(0.05,(now-last)/1000); last=now;
  const t=now/1000;
  const u=stepCam(t);
  if (flight) runStages(u,false);
  // gentle idle drift + pointer parallax
  const rm=reduced();
  ptr.sx+=(ptr.x-ptr.sx)*(1-Math.exp(-dt*2.2)); ptr.sy+=(ptr.y-ptr.sy)*(1-Math.exp(-dt*2.2));
  const near=clamp(cam.cur[2]/32,0.35,1);
  const ox=rm?0:(0.026*ptr.sx*near+0.006*Math.sin(t*0.11));
  const oy=rm?0:(-0.016*ptr.sy*near+0.004*Math.sin(t*0.083));
  applyState(camera,cam.cur,ox,oy);
  // accent crossfade
  accent.amt+=(accent.target-accent.amt)*(1-Math.exp(-dt*(accent.target?1.6:5)));
  if (accent.pending!==undefined && accent.amt<0.03){
    const p=accent.pending; accent.pending=undefined;
    if (p){ const k=CON[p]; accent.dir.copy(k.C).normalize(); accent.col.setRGB(k.idn.rgb[0]/255,k.idn.rgb[1]/255,k.idn.rgb[2]/255); accent.target=1; }
  }
  if (hasGL){
    planetBase.slerp(planetTarget,1-Math.exp(-dt*1.2));
    swayEuler.set(rm?0:Math.sin(t*0.047)*0.035, rm?0:Math.sin(t*0.031+1.3)*0.075, 0);
    planetSway.setFromEuler(swayEuler);
    earth.quaternion.copy(planetBase).multiply(planetSway);
    skyMat.uniforms.uAccentAmt.value=accent.amt;
    starLayers.forEach(m=>m.uniforms.uTime.value=t);
    renderer.render(scene,camera);
  }
  drawChart(now,dt);
  placeHits();
  requestAnimationFrame(frame);
}

/* =========================================================
   14. BOOT
   ========================================================= */
resize();
const first=parseHash();
const wide=STATES.overview.slice(); wide[2]*=1.32; wide[1]+=0.08; wide[0]-=0.12;
cam.cur=wide;
if (first.view==='dest'){ route={view:'overview'}; setOverviewUI(false); applyRoute(first); }
else {
  route={view:'overview'}; updateNav('overview'); setOverviewUI(true);
  if (reduced()) cam.cur=STATES.overview.slice(); else startTween(STATES.overview,2.4);
  try{ history.replaceState(null,'','#overview'); }catch(e){}
}
requestAnimationFrame(t=>{ last=t; frame(t); });

// development / review hook (inspect or drive the scene from the console)
window.__observatory={go, states:STATES, cam, CONS, jump(key){ cam.tw=null; cam.cur=STATES[key].slice(); cam.vel.fill(0); }};
})();
