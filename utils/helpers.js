(function(global){
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function distance(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
  global.helpers = { clamp, distance };
})(window);
