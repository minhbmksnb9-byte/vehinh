(function(global){
  // Return distance from point p to segment ab
  function pointToSegmentDistance(p,a,b){
    const A = p.x - a.x, B = p.y - a.y;
    const C = b.x - a.x, D = b.y - a.y;
    const dot = A*C + B*D;
    const len2 = C*C + D*D;
    let t = len2 === 0 ? 0 : dot / len2; t = Math.max(0, Math.min(1, t));
    const proj = { x: a.x + t*C, y: a.y + t*D};
    return Math.hypot(p.x-proj.x, p.y-proj.y);
  }

  function pointToLineDistance(p,a,b){
    const A = p.x - a.x, B = p.y - a.y;
    const C = b.x - a.x, D = b.y - a.y;
    const num = Math.abs(A*D - B*C);
    const den = Math.hypot(C,D);
    return den === 0 ? Math.hypot(A,B) : num/den;
  }

  function lineIntersectionsWithRect(a,b,rect){
    // rect: {minx,maxx,miny,maxy} in svg coords
    const x1 = a.x, y1 = a.y, x2 = b.x, y2 = b.y;
    const dx = x2-x1, dy=y2-y1;
    const pts = [];
    const check = (ix,iy)=>{
      if(ix >= rect.minx-1e-6 && ix <= rect.maxx+1e-6 && iy >= rect.miny-1e-6 && iy <= rect.maxy+1e-6){
        pts.push({x:ix,y:iy});
      }
    };
    if(Math.abs(dx) > 1e-9){
      let t = (rect.minx - x1)/dx; check(x1+t*dx, y1+t*dy);
      t = (rect.maxx - x1)/dx; check(x1+t*dx, y1+t*dy);
    }
    if(Math.abs(dy) > 1e-9){
      let t = (rect.miny - y1)/dy; check(x1+t*dx, y1+t*dy);
      t = (rect.maxy - y1)/dy; check(x1+t*dx, y1+t*dy);
    }
    // unique
    const uniq = [];
    for(const p of pts){
      if(!uniq.some(q=>Math.hypot(q.x-p.x,q.y-p.y) < 1e-6)) uniq.push(p);
    }
    if(uniq.length >= 2) return [uniq[0], uniq[1]];
    // fallback long segment
    const mag = Math.hypot(dx,dy);
    if(mag === 0) return null;
    const ux = dx/mag, uy = dy/mag;
    const far = 1e5;
    return [{x: a.x - ux*far, y: a.y - uy*far}, {x: a.x + ux*far, y: a.y + uy*far}];
  }

  global.geometry = { pointToSegmentDistance, pointToLineDistance, lineIntersectionsWithRect };
})(window);
