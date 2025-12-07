(function(global){
  const S = global.AppState;

  function createPoint(x,y,name){
    const id = generateID('p');
    S.points[id] = { id, x:+x, y:+y, name:name||'' };
    return id;
  }

  function createSegment(aPid,bPid,opts){
    opts = opts || {};
    const id = generateID('s');
    S.shapes[id] = {
      id,
      type:'segment',
      a:aPid, b:bPid,
      style:{
        stroke: opts.color || S.color,
        dashed: !!opts.dashed
      }
    };
    return id;
  }

  function createLine(aPid,bPid,opts){
    opts = opts || {};
    const id = generateID('s');
    S.shapes[id] = {
      id,
      type:'line',
      a:aPid, b:bPid,
      style:{
        stroke: opts.color || S.color,
        dashed: !!opts.dashed
      }
    };
    return id;
  }

  function createCircle(centerPid, edgePid, opts){
    opts = opts || {};
    const id = generateID('s');
    const c = S.points[centerPid], e = S.points[edgePid];
    const r = Math.hypot(c.x - e.x, c.y - e.y);

    S.shapes[id] = {
      id,
      type:'circle',
      center:centerPid,
      radius:r,
      style:{
        stroke: opts.color || S.color,
        dashed: !!opts.dashed
      }
    };
    return id;
  }

  // ---------------- TEXT SHAPE ----------------
  function createText(x, y, content, opts){
    opts = opts || {};
    const id = generateID('t');

    S.shapes[id] = {
      id,
      type: "text",
      x: +x,
      y: +y,
      content: content || "",
      style: {
        color: opts.color || S.color || "black",
        size: opts.size || 14,
        // đảm bảo text không chặn hành vi select text mặc định
        pointer: "none"
      }
    };

    return id;
  }

  function deleteShape(id){
    delete S.shapes[id];
  }

  function deletePoint(id){
    delete S.points[id];

    for(const sid in {...S.shapes}){
      const sh = S.shapes[sid];
      if(
        (sh.type==='segment' && (sh.a===id||sh.b===id)) ||
        (sh.type==='circle' && sh.center===id) ||
        (sh.type==='line' && (sh.a===id||sh.b===id))
      ){
        delete S.shapes[sid];
      }
    }
  }

  global.Objects = {
    createPoint, createSegment,
    createLine, createCircle,
    createText,
    deleteShape, deletePoint
  };
})(window);

// bootstrap
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.tool').forEach(b=>{
    if(b.dataset.tool==='point') b.classList.add('active');
  });

  AppState.tool = 'point';
  AppState.color = document.getElementById('colorPicker').value;

  Renderer.render();
});
