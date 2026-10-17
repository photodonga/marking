/* MARKING shared pure editing helpers — no DOM or editor state. */
(function(root){
  "use strict";
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function deepCloneObjects(arr){
    return arr.map(o=>Object.assign({},o,
      o.rect ? {rect:Object.assign({},o.rect)} : {},
      o.faceRects ? {faceRects:o.faceRects.map(r=>Object.assign({},r))} : {}));
  }
  function effectSliderToValue(position, mode, key, baseline){
    const mid=baseline[mode][key];
    const p=Math.max(0,Math.min(100,Number(position)));
    return p<=50 ? p*mid/50 : mid+(p-50)*(100-mid)/50;
  }
  function effectValueToSlider(value, mode, key, baseline){
    const mid=baseline[mode][key];
    const v=Math.max(0,Math.min(100,Number(value)));
    return v<=mid ? v*50/mid : 50+(v-mid)*50/(100-mid);
  }
  function rotatePoint(p,c,angle){
    const cos=Math.cos(angle||0),sin=Math.sin(angle||0);
    const dx=p.x-c.x,dy=p.y-c.y;
    return {x:c.x+dx*cos-dy*sin,y:c.y+dx*sin+dy*cos};
  }
  function rectCenter(o){return {x:o.x+o.w/2,y:o.y+o.h/2};}
  const helpers=Object.freeze({clamp,deepCloneObjects,effectSliderToValue,effectValueToSlider,rotatePoint,rectCenter});
  if(typeof module!=="undefined" && module.exports) module.exports=helpers;
  else root.MarkingHelpers=helpers;
})(typeof globalThis!=="undefined" ? globalThis : this);
