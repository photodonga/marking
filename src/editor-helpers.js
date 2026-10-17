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
  function normRect(a,b){
    const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);
    return {x,y,w:Math.abs(b.x-a.x),h:Math.abs(b.y-a.y)};
  }
  function arrowDashPattern(length,sw,headLen){
    const available=Math.max(0,length-headLen*0.62-sw*1.5);
    const preferred=Math.max(2,sw*2.2);
    if(available<preferred*1.5)return null;
    const count=Math.max(1,Math.round(available/(preferred*1.85)));
    const dash=Math.min(preferred,available/count);
    const gap=count>1?(available-count*dash)/(count-1):0;
    return {available,count,dash,gap};
  }
  const helpers=Object.freeze({clamp,deepCloneObjects,effectSliderToValue,effectValueToSlider,rotatePoint,rectCenter,normRect,arrowDashPattern});
  if(typeof module!=="undefined" && module.exports) module.exports=helpers;
  else root.MarkingHelpers=helpers;
})(typeof globalThis!=="undefined" ? globalThis : this);
