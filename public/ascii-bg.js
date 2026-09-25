/* ASCII Shader Lab background, adapted to the pattern and settings supplied
   for Morphiq. The original snippet stopped before the engine's startup code. */
(() => {
  const canvas = document.querySelector('.ascii-bg canvas');
  if (!canvas) return;

  const settings = Object.freeze({
    patA: 0, patB: 8, blend: 0, mix: .65, scale: 1.1, scaleB: .9,
    speed: .6, speedB: 1, warp: .55, mouse: .4, cell: 12, aspect: 1.4,
    dpr: 1, charset: " .'\u0060^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
    sortDensity: true, weight: 500, glyph: 1, bright: 0, contrast: 1.15,
    gamma: 1, dither: .35, colorMode: 1, colA: '#0000ff',
    colB: '#ffffff', bg: '#04050c', sat: .85, hue: .055, cycle: .02,
    glow: .35, vig: .45
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let gl, programA, programB, buffer, dataTexture, atlasTexture, frameBuffer;
  let W = 0, H = 0, cw = 12, ch = 17, cols = 1, rows = 1;
  let atlasCols = 1, atlasRows = 1, characterCount = 1;
  let elapsed = 0, previous = 0, lastDraw = 0, frameId = 0, resizeNeeded = true;
  let mouse = [-5000, -5000], target = [-5000, -5000];
  const shaderHeader = 'precision highp float;\n';
  const vertex = 'attribute vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }';
  const common = `
    float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
      return mix(mix(h21(i),h21(i+vec2(1.,0.)),u.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),u.x),u.y); }
    float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
      for(int i=0;i<5;i++){ v+=a*vnoise(p); p=m*p; a*=.5; } return v; }
  `;
  const fieldFragment = shaderHeader + `
    uniform vec2 uRes, uCell, uMouse;
    uniform float uTime, uScale, uScaleB, uWarp, uMix, uMouseAmt;
    ${common}
    void main(){
      vec2 px=gl_FragCoord.xy*uCell;
      vec2 p=(px-.5*uRes)/uRes.y;
      vec2 q=p*uScale;
      q+=uWarp*(vec2(fbm(q*1.2+uTime*.15),fbm(q*1.2+vec2(5.2,1.3)-uTime*.15))-.5)*2.;
      float clouds=smoothstep(.2,.8,fbm(q*1.8+vec2(uTime*.25,-uTime*.18)));
      vec2 b=q*uScaleB;
      float energy=0.;
      for(int i=0;i<6;i++){
        float fi=float(i);
        vec2 center=.65*vec2(sin(uTime*(.45+fi*.13)+fi*1.7),cos(uTime*(.38+fi*.17)+fi*2.3));
        vec2 delta=b-center;
        energy+=.035/(dot(delta,delta)+.001);
      }
      float sparks=smoothstep(.5,2.4,energy);
      float value=mix(clouds,sparks,uMix);
      vec2 pointer=(uMouse-.5*uRes)/uRes.y;
      float distanceToMouse=length(p-pointer);
      value=clamp(value+uMouseAmt*exp(-distanceToMouse*distanceToMouse*10.)*
        (.7+.3*sin(distanceToMouse*40.-uTime*6.)),0.,1.);
      gl_FragColor=vec4(vec3(value),value);
    }
  `;
  const asciiFragment = shaderHeader + `
    uniform vec2 uRes,uCell,uGrid,uAtlasGrid;
    uniform sampler2D uData,uAtlas;
    uniform float uN,uContrast,uGamma,uBright,uDither,uGlow,uGlyph,uVig,uTime,uCycle;
    uniform vec3 uColA,uColB,uBg;
    float bayer(vec2 c){
      c=mod(floor(c),4.);
      return (mod(c.x,2.)*2.+mod(c.y,2.)*3.+
        floor(c.x/2.)*4.+floor(c.y/2.)*8.)/16.;
    }
    void main(){
      vec2 fc=gl_FragCoord.xy;
      vec2 cell=floor(fc/uCell);
      vec2 local=fract(fc/uCell);
      float l=texture2D(uData,(cell+.5)/uGrid).a;
      l=pow(clamp((l-.5)*uContrast+.5+uBright,0.,1.),uGamma);
      float d=clamp(l+(bayer(cell)-.5)*uDither/max(uN-1.,1.),0.,1.);
      float index=floor(d*(uN-1.)+.5);
      vec2 glyphCoord=(local-.5)/uGlyph+.5;
      float glyph=0.;
      if(glyphCoord.x>0.&&glyphCoord.y>0.&&glyphCoord.x<1.&&glyphCoord.y<1.){
        vec2 atlasCell=vec2(mod(index,uAtlasGrid.x),floor(index/uAtlasGrid.x));
        glyph=texture2D(uAtlas,(atlasCell+vec2(glyphCoord.x,1.-glyphCoord.y))/uAtlasGrid).a;
      }
      vec3 ink=mix(uColB,uColA,l);
      vec3 background=uBg+ink*l*uGlow*exp(-dot(local-.5,local-.5)*7.)*.55;
      vec3 color=mix(background,ink,glyph);
      vec2 vignette=fc/uRes-.5;
      color*=1.-uVig*dot(vignette,vignette)*2.2;
      gl_FragColor=vec4(clamp(color,0.,1.),1.);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function makeProgram(fragment) {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.bindAttribLocation(program, 0, 'p'); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    program.uniforms = {};
    return program;
  }
  function uniform(program, name) {
    if (!(name in program.uniforms)) program.uniforms[name] = gl.getUniformLocation(program, name);
    return program.uniforms[name];
  }
  const f1 = (p,n,v) => gl.uniform1f(uniform(p,n),v);
  const f2 = (p,n,a,b) => gl.uniform2f(uniform(p,n),a,b);
  const f3 = (p,n,c) => gl.uniform3f(uniform(p,n),c[0],c[1],c[2]);
  const i1 = (p,n,v) => gl.uniform1i(uniform(p,n),v);
  function rgb(hex) {
    const v=parseInt(hex.slice(1),16);
    return [(v>>16&255)/255,(v>>8&255)/255,(v&255)/255];
  }
  function makeTexture(filter) {
    const texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
    return texture;
  }
  function makeAtlas() {
    let chars=[...new Set(Array.from(settings.charset))];
    const glyphWidth=48,glyphHeight=Math.round(48*settings.aspect),fontSize=52;
    const atlasCanvas=document.createElement('canvas'),ctx=atlasCanvas.getContext('2d',{willReadFrequently:true});
    const draw=list=>{
      atlasCols=Math.min(16,list.length);atlasRows=Math.ceil(list.length/atlasCols);
      atlasCanvas.width=atlasCols*glyphWidth;atlasCanvas.height=atlasRows*glyphHeight;
      ctx.clearRect(0,0,atlasCanvas.width,atlasCanvas.height);
      ctx.font=`${settings.weight} ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';
      list.forEach((char,index)=>ctx.fillText(char,(index%atlasCols+.5)*glyphWidth,
        (Math.floor(index/atlasCols)+.5)*glyphHeight+2));
    };
    draw(chars);
    if(settings.sortDensity){
      const pixels=ctx.getImageData(0,0,atlasCanvas.width,atlasCanvas.height).data;
      chars=chars.map((char,index)=>{
        let sum=0;
        const ox=index%atlasCols*glyphWidth,oy=Math.floor(index/atlasCols)*glyphHeight;
        for(let y=oy;y<oy+glyphHeight;y+=2)
          for(let x=ox;x<ox+glyphWidth;x+=2)
            sum+=pixels[(y*atlasCanvas.width+x)*4+3];
        return {char,sum,index};
      }).sort((a,b)=>a.sum-b.sum||a.index-b.index).map(item=>item.char);
    }
    characterCount=chars.length;
    draw(chars);
    gl.bindTexture(gl.TEXTURE_2D,atlasTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlasCanvas);
  }
  function resize() {
    resizeNeeded=false;
    const dpr=Math.min(settings.dpr,Math.max(1,window.devicePixelRatio||1));
    W=Math.max(1,Math.round(canvas.clientWidth*dpr));
    H=Math.max(1,Math.round(canvas.clientHeight*dpr));
    canvas.width=W;canvas.height=H;
    cw=Math.max(2,Math.round(settings.cell*dpr));
    ch=Math.max(2,Math.round(settings.cell*settings.aspect*dpr));
    cols=Math.ceil(W/cw);rows=Math.ceil(H/ch);
    gl.bindTexture(gl.TEXTURE_2D,dataTexture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,cols,rows,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.bindFramebuffer(gl.FRAMEBUFFER,frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,dataTexture,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  function render() {
    if(resizeNeeded)resize();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,frameBuffer);
    gl.viewport(0,0,cols,rows);
    gl.useProgram(programA);
    f2(programA,'uRes',W,H);f2(programA,'uCell',cw,ch);
    f2(programA,'uMouse',mouse[0],mouse[1]);
    f1(programA,'uTime',elapsed);f1(programA,'uScale',settings.scale);
    f1(programA,'uScaleB',settings.scaleB);f1(programA,'uWarp',settings.warp);
    f1(programA,'uMix',settings.mix);f1(programA,'uMouseAmt',settings.mouse);
    gl.drawArrays(gl.TRIANGLES,0,3);

    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.viewport(0,0,W,H);gl.useProgram(programB);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,dataTexture);i1(programB,'uData',0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,atlasTexture);i1(programB,'uAtlas',1);
    f2(programB,'uRes',W,H);f2(programB,'uCell',cw,ch);
    f2(programB,'uGrid',cols,rows);f2(programB,'uAtlasGrid',atlasCols,atlasRows);
    f1(programB,'uN',characterCount);f1(programB,'uContrast',settings.contrast);
    f1(programB,'uGamma',settings.gamma);f1(programB,'uBright',settings.bright);
    f1(programB,'uDither',settings.dither);f1(programB,'uGlow',settings.glow);
    f1(programB,'uGlyph',settings.glyph);f1(programB,'uVig',settings.vig);
    f1(programB,'uTime',elapsed);f1(programB,'uCycle',settings.cycle);
    f3(programB,'uColA',rgb(settings.colA));f3(programB,'uColB',rgb(settings.colB));
    f3(programB,'uBg',rgb(settings.bg));
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  function tick(now) {
    frameId=requestAnimationFrame(tick);
    if(now-lastDraw<33)return;
    const dt=previous?Math.min(.1,(now-previous)/1000):0;
    previous=now;lastDraw=now;elapsed+=dt*settings.speed;
    const smoothing=Math.min(1,dt*9);
    mouse[0]+=(target[0]-mouse[0])*smoothing;
    mouse[1]+=(target[1]-mouse[1])*smoothing;
    render();
  }
  function schedule() {
    cancelAnimationFrame(frameId);frameId=0;previous=0;
    if(document.hidden)return;
    if(reduced.matches)render();
    else frameId=requestAnimationFrame(tick);
  }
  function move(event) {
    const rect=canvas.getBoundingClientRect();
    if(rect.width)target=[(event.clientX-rect.left)*W/rect.width,(rect.bottom-event.clientY)*H/rect.height];
  }
  try {
    gl=canvas.getContext('webgl',{antialias:false,alpha:false,powerPreference:'low-power'}) ||
      canvas.getContext('experimental-webgl');
    if(!gl)return;
    programA=makeProgram(fieldFragment);programB=makeProgram(asciiFragment);
    buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    atlasTexture=makeTexture(gl.LINEAR);dataTexture=makeTexture(gl.NEAREST);
    frameBuffer=gl.createFramebuffer();makeAtlas();
    window.addEventListener('resize',()=>{resizeNeeded=true;if(reduced.matches)render();},{passive:true});
    window.addEventListener('pointermove',move,{passive:true});
    window.addEventListener('blur',()=>{target=[-5000,-5000];},{passive:true});
    document.addEventListener('visibilitychange',schedule);
    reduced.addEventListener('change',schedule);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(frameId);canvas.style.opacity='0';});
    schedule();
  } catch(error) {
    // The solid dark background remains when WebGL is unavailable.
    console.warn('Fondo ASCII no disponible:',error);
    canvas.style.display='none';
  }
})();
