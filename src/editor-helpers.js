/* MARKING shared pure editing helpers — no DOM or editor state. */
(function(root){
  "use strict";
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function deepCloneObjects(arr){
    return arr.map(o=>Object.assign({},o,
      o.rect ? {rect:Object.assign({},o.rect)} : {},
      o.faceRects ? {faceRects:o.faceRects.map(r=>Object.assign({},r))} : {}));
  }
  const helpers=Object.freeze({clamp,deepCloneObjects});
  if(typeof module!=="undefined" && module.exports) module.exports=helpers;
  else root.MarkingHelpers=helpers;
})(typeof globalThis!=="undefined" ? globalThis : this);
