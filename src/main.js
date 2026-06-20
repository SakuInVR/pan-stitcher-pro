const $=s=>document.querySelector(s), video=$('#video'), file=$('#file'), work=$('#work'), out=$('#output');
let objectUrl,editorState;
const FRAME_DURATION=1/30;
const formatTime=value=>{const t=Math.max(0,value||0),m=Math.floor(t/60),s=Math.floor(t%60),ms=Math.floor((t%1)*1000);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`};
function load(f){if(!f?.type.startsWith('video/'))return; if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(f);video.src=objectUrl;$('#filename').textContent=f.name;$('#workspace').hidden=false;$('.drop').hidden=true;video.onloadedmetadata=()=>{$('#end').value=video.duration.toFixed(1);$('#meta').textContent=`${video.videoWidth} × ${video.videoHeight} / ${video.duration.toFixed(1)}秒`}}
file.onchange=e=>load(e.target.files[0]); const drop=$('#drop');['dragenter','dragover'].forEach(x=>drop.addEventListener(x,e=>{e.preventDefault();drop.classList.add('over')}));['dragleave','drop'].forEach(x=>drop.addEventListener(x,e=>{e.preventDefault();drop.classList.remove('over')}));drop.addEventListener('drop',e=>load(e.dataTransfer.files[0]));
video.addEventListener('timeupdate',()=>$('#currentTime').textContent=formatTime(video.currentTime));
video.addEventListener('seeked',()=>$('#currentTime').textContent=formatTime(video.currentTime));
function stepFrame(direction){video.pause();video.currentTime=Math.max(0,Math.min(video.duration||0,video.currentTime+direction*FRAME_DURATION))}
$('#prevFrame').onclick=()=>stepFrame(-1);$('#nextFrame').onclick=()=>stepFrame(1);
$('#markStart').onclick=()=>{$('#start').value=video.currentTime.toFixed(3);$('#status').textContent=`開始位置：${formatTime(video.currentTime)}`};
$('#markEnd').onclick=()=>{$('#end').value=video.currentTime.toFixed(3);$('#status').textContent=`終了位置：${formatTime(video.currentTime)}`};
document.addEventListener('keydown',e=>{if(!video.paused||!['ArrowLeft','ArrowRight'].includes(e.key)||['INPUT','SELECT'].includes(document.activeElement.tagName))return;e.preventDefault();stepFrame(e.key==='ArrowLeft'?-1:1)});
const interval=$('#interval');
function updateInterval(){const value=+interval.value,percent=(value-(+interval.min))/(+interval.max-(+interval.min))*100;$('#intervalValue').textContent=`${value.toFixed(2)}秒（約${(1/value).toFixed(1)}枚/秒）`;interval.style.background=`linear-gradient(90deg,#d7ff52 0 ${percent}%,#45443b ${percent}%)`}
interval.addEventListener('input',updateInterval);updateInterval();
const seek=t=>new Promise(r=>{video.onseeked=()=>r();video.currentTime=Math.min(t,video.duration)});
function gray(data,w,h,scale=8){const sw=Math.floor(w/scale),sh=Math.floor(h/scale),g=new Uint8Array(sw*sh);for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){let i=((y*scale)*w+x*scale)*4;g[y*sw+x]=(data[i]*3+data[i+1]*6+data[i+2])/10}return{g,w:sw,h:sh,scale}}
function shift(a,b,axis){let best={d:0,score:Infinity};const max=Math.floor((axis==='vertical'?a.h:a.w)*.45);for(let d=-max;d<=max;d++){let sum=0,n=0;for(let y=2;y<a.h-2;y+=2)for(let x=2;x<a.w-2;x+=2){let bx=axis==='horizontal'?x-d:x,by=axis==='vertical'?y-d:y;if(bx<0||bx>=b.w||by<0||by>=b.h)continue;sum+=Math.abs(a.g[y*a.w+x]-b.g[by*b.w+bx]);n++}let score=sum/(n||1);if(score<best.score)best={d,score}}return best.d*a.scale}
function renderPanorama(){
  const {spatial:base,axis,w,h,adjustments}=editorState,vertical=axis==='vertical',length=vertical?h:w;
  $('.canvas-wrap').classList.toggle('horizontal',!vertical);
  let cumulative=0;const spatial=base.map((frame,i)=>{if(i)cumulative+=adjustments[i-1]||0;return{...frame,pos:frame.pos+cumulative}});
  const min=spatial[0].pos,max=spatial[spatial.length-1].pos;
  out.width=Math.round(vertical?w:w+max-min);out.height=Math.round(vertical?h+max-min:h);
  const octx=out.getContext('2d');octx.imageSmoothingEnabled=false;
  const draw=(frame,sx,sy,sw,sh,dx,dy)=>{work.getContext('2d').putImageData(frame.img,0,0);octx.drawImage(work,sx,sy,sw,sh,Math.round(dx),Math.round(dy),sw,sh)};
  editorState.boundaries=[];
  for(let i=0;i<spatial.length;i++){
    const frame=spatial[i],p=Math.round(frame.pos);
    const bandStart=i===0?p:Math.round((spatial[i-1].pos+p+length)/2);
    const bandEnd=i===spatial.length-1?p+length:Math.round((p+spatial[i+1].pos+length)/2);
    if(i<spatial.length-1)editorState.boundaries.push(bandEnd-min);
    const sourceStart=Math.max(0,bandStart-p),size=Math.min(length-sourceStart,bandEnd-bandStart);
    if(size<=0)continue;
    if(vertical)draw(frame,0,sourceStart,w,size,0,bandStart-min);
    else draw(frame,sourceStart,0,size,h,bandStart-min,0);
  }
}
function focusSeam(){const index=+$ ('#seamSelect').value,boundary=editorState.boundaries[index],wrap=$('.canvas-wrap'),scale=out.clientWidth/out.width;if(editorState.axis==='vertical')wrap.scrollTop=Math.max(0,boundary*scale-wrap.clientHeight/2);else wrap.scrollLeft=Math.max(0,boundary*scale-wrap.clientWidth/2)}
function updateSeamUI(render=true){const index=+$ ('#seamSelect').value,total=editorState.adjustments.length,value=editorState.adjustments[index]||0;$('#seamNumber').textContent=`${index+1} / ${total}`;$('#seamOffset').value=value;$('#offsetDirection').textContent=`${value>0?'+':''}${value}px`;if(render){renderPanorama();requestAnimationFrame(focusSeam)}}
function setupEditor(){const available=editorState.spatial.length>1,total=Math.max(1,editorState.spatial.length-1),select=$('#seamSelect');select.max=total-1;select.value=0;$('#openSeamEditor').hidden=!available;$('#seamEditor').hidden=true;updateSeamUI(false)}
async function stitch(){const btn=$('#run');btn.disabled=true;$('#result').hidden=true;try{const start=+$ ('#start').value,end=Math.min(+$ ('#end').value,video.duration),step=+$ ('#interval').value,axis=$('#axis').value;if(end<=start)throw Error('終了秒は開始秒より後にしてね');const w=video.videoWidth,h=video.videoHeight,ctx=work.getContext('2d',{willReadFrequently:true});work.width=w;work.height=h;let frames=[],prev,pos=0;const count=Math.floor((end-start)/step)+1;for(let i=0,t=start;t<=end+.001;t+=step,i++){ $('#status').textContent=`フレーム解析中 ${i+1} / ${count}`;await seek(t);ctx.drawImage(video,0,0,w,h);let img=ctx.getImageData(0,0,w,h),g=gray(img.data,w,h);if(prev)pos=Math.round(pos+shift(prev,g,axis));frames.push({img,pos});prev=g;await new Promise(requestAnimationFrame)}const spatial=[...frames].sort((a,b)=>a.pos-b.pos).filter((frame,i,list)=>i===0||frame.pos!==list[i-1].pos);editorState={spatial,axis,w,h,adjustments:new Array(Math.max(0,spatial.length-1)).fill(0),boundaries:[]};renderPanorama();setupEditor();$('#result').hidden=false;$('#result').scrollIntoView({behavior:'smooth'});$('#status').textContent=`完了：${out.width} × ${out.height}px`;}catch(e){$('#status').textContent=e.message}finally{btn.disabled=false}}
$('#seamSelect').addEventListener('input',()=>updateSeamUI(false));$('#seamSelect').addEventListener('change',()=>{updateSeamUI(false);focusSeam()});
function setSeamOffset(value){const index=+$ ('#seamSelect').value;editorState.adjustments[index]=Math.round(value);updateSeamUI()}
$('#seamOffset').addEventListener('change',e=>setSeamOffset(+e.target.value));$('#minusPixel').onclick=()=>setSeamOffset((editorState.adjustments[+$ ('#seamSelect').value]||0)-1);$('#plusPixel').onclick=()=>setSeamOffset((editorState.adjustments[+$ ('#seamSelect').value]||0)+1);$('#resetSeam').onclick=()=>setSeamOffset(0);
$('#openSeamEditor').onclick=()=>{$('#openSeamEditor').hidden=true;$('#seamEditor').hidden=false;$('#seamEditor').scrollIntoView({behavior:'smooth',block:'center'});requestAnimationFrame(focusSeam)};
$('#closeSeamEditor').onclick=()=>{$('#seamEditor').hidden=true;$('#openSeamEditor').hidden=false;$('#openSeamEditor').scrollIntoView({behavior:'smooth',block:'center'})};
$('#run').onclick=stitch;$('#download').onclick=()=>{const a=document.createElement('a');a.download='pan-stitched.png';a.href=out.toDataURL('image/png');a.click()};
