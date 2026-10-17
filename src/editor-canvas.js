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
  const api=Object.freeze({drawBase,drawEffectLayer});
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.MarkingCanvas=api;
})(typeof globalThis!=="undefined"?globalThis:this);
