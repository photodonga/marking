/* Canvas composition primitives. All editor state remains owned by editor-app.js. */
(function(root){
  "use strict";
  function drawBase(ctx,raster,naturalW,naturalH,displayW,displayH){
    ctx.clearRect(0,0,displayW,displayH);
    ctx.drawImage(raster,0,0,naturalW,naturalH,0,0,displayW,displayH);
  }
  function drawEffectLayer(ctx,rendered,scale){
    if(!rendered||!rendered.canvas)return;
    ctx.drawImage(rendered.canvas,0,0,rendered.canvas.width,rendered.canvas.height,
      rendered.sx*scale,rendered.sy*scale,rendered.canvas.width*scale,rendered.canvas.height*scale);
  }
  function composeEffectObject(eff,computeRegion,width,height,createCanvas){
    const options={intensity:eff.intensity,feather:eff.feather};
    const regions=eff.faceRects&&eff.faceRects.length?eff.faceRects:[eff.rect];
    if(regions.length===1)
      return computeRegion(regions[0],eff.autoFace?'ellipse':eff.shape,eff.mode,eff.rotation||0,options);
    const overlay=createCanvas();
    overlay.width=width;overlay.height=height;
    const ctx=overlay.getContext('2d');
    regions.forEach(rect=>{
      const part=computeRegion(rect,'ellipse',eff.mode,eff.rotation||0,options);
      ctx.drawImage(part.canvas,part.sx,part.sy);
    });
    return {canvas:overlay,sx:0,sy:0};
  }
  const api=Object.freeze({drawBase,drawEffectLayer,composeEffectObject});
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.MarkingCanvas=api;
})(typeof globalThis!=="undefined"?globalThis:this);
