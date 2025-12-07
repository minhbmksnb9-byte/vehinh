(function(global){
  const S = global.AppState;                 // trạng thái chính của app
  const svg = document.getElementById('board'); // SVG chính
  const colorPicker = document.getElementById('colorPicker'); 
  const prebuilt = document.getElementById('prebuiltShapes'); 
  const contextMenu = document.getElementById('context-menu'); 

  // ---------- Config Snapping ----------
  let _lastHighlightedSid = null;
  let _highlightBackupStroke = null;
  let _snapHold = false;
  let _snapTimer = null;
  
  const SNAP_DEG_TOL = 3.5;
  const SNAP_HOLD_MS = 80;

  // ---------- Helper: angle utils ----------
  function radToDeg(r){ return r * 180 / Math.PI; }
  function normalizeDeg(d){
    d = Math.abs(((d % 180) + 180) % 180);
    if(d >= 180) d -= 180;
    return d;
  }
  function angleBetween(a, b){ return Math.atan2(b.y - a.y, b.x - a.x); }

  function clearHighlight(){
    if(_lastHighlightedSid){
      const sh = S.shapes[_lastHighlightedSid];
      if(sh){
        if(!sh.style) sh.style = {};
        if(_highlightBackupStroke !== null) sh.style.stroke = _highlightBackupStroke;
      }
      _lastHighlightedSid = null;
      _highlightBackupStroke = null;
    }
  }
  function highlightShapeRed(sid){
    if(_lastHighlightedSid === sid) return;
    clearHighlight();
    const sh = S.shapes[sid];
    if(!sh) return;
    if(!sh.style) sh.style = {};
    _highlightBackupStroke = typeof sh.style.stroke !== 'undefined' ? sh.style.stroke : null;
    sh.style.stroke = 'red';
    _lastHighlightedSid = sid;
  }

  function startSnapHold(){
    if(_snapTimer) clearTimeout(_snapTimer);
    _snapHold = true;
    _snapTimer = setTimeout(()=>{ _snapHold = false; _snapTimer = null; }, SNAP_HOLD_MS);
  }

  // ---------------------------- Toolbar --------------------------------
  document.querySelectorAll('.tool').forEach(b=>{
    b.addEventListener('click', ()=>{ global.Tools.setTool(b.dataset.tool); });
  });

  // Xử lý đổi màu từ Input Color Picker
  if(colorPicker) colorPicker.addEventListener('input', ()=>{
    const col = colorPicker.value;
    S.color = col;

    // 1. Nếu đang chọn 1 Shape (Line, Circle, Text...)
    if(S.selectedShape && S.shapes[S.selectedShape]){
      const sh = S.shapes[S.selectedShape];
      if(!sh.style) sh.style = {};
      
      if(sh.type === 'text') {
        sh.style.color = col; // Text dùng color/fill
        sh.style.fill = col;
        sh.style.stroke = col;
      } else {
        sh.style.stroke = col;
      }
    } 
    // 2. Nếu đang chọn nhóm (Points + Text)
    else if(S.selectedPoints && S.selectedPoints.length){
      S.selectedPoints.forEach(id=>{ 
          // Nếu là Point
          if(S.points[id]) S.points[id].color = col; 
          // Nếu là Text (nằm trong nhóm select)
          else if(S.shapes[id] && S.shapes[id].type === 'text') {
             const sh = S.shapes[id];
             if(!sh.style) sh.style = {};
             sh.style.color = col;
             sh.style.fill = col;
          }
      });
      
      // Update màu cho các đoạn thẳng nối giữa các điểm được chọn
      for(const sid in S.shapes){
        const sh = S.shapes[sid];
        if(!sh) continue;
        if(sh.type === 'segment' || sh.type === 'line'){
          if(S.selectedPoints.includes(sh.a) && S.selectedPoints.includes(sh.b)){
            if(!sh.style) sh.style = {};
            sh.style.stroke = col;
          }
        } else if(sh.type === 'circle'){
          if(S.selectedPoints.includes(sh.center)){
            if(!sh.style) sh.style = {};
            sh.style.stroke = col;
          }
        }
      }
    }
    if(global.Renderer) global.Renderer.render();
  });

  if(prebuilt) prebuilt.addEventListener('change', (e)=> {
    const v = e.target.value;
    if(!v) return;
    window['shape_' + v] && window['shape_' + v]();
    S.selectedPoints = []; S.selectedShape = null;
    if(global.Renderer) global.Renderer.render();
    e.target.value = '';
  });

  // -------------------- State Checks --------------------
  if(!S._linePending) S._linePending = [];
  if(typeof S.selectedPoints === 'undefined') S.selectedPoints = [];
  if(typeof S.selectedShape === 'undefined') S.selectedShape = null;

  if(typeof S.groupDragging === 'undefined') S.groupDragging = false;
  if(typeof S.groupDragStart === 'undefined') S.groupDragStart = null;
  if(typeof S.groupPoints === 'undefined') S.groupPoints = [];
  if(typeof S.resizeMode === 'undefined') S.resizeMode = null;
  if(typeof S.resizeStart === 'undefined') S.resizeStart = null;
  if(typeof S.transform === 'undefined') S.transform = { mode: null };

  // -------------------- Helpers --------------------
  function ptFromEvent(ev){
    try {
      if(global.Renderer && typeof global.Renderer.clientToSvgPoint === 'function'){
        const res = global.Renderer.clientToSvgPoint(ev.clientX, ev.clientY);
        if(res && typeof res.x !== 'undefined' && typeof res.y !== 'undefined') return res;
      }
    } catch(e){}

    try {
      const rect = svg.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      return { x, y };
    } catch(e){
      return { x: ev.clientX, y: ev.clientY };
    }
  }

  function hitPoint(x,y, r=8){
    const keys = Object.keys(S.points || {});
    for(let i=keys.length-1;i>=0;i--){
      const pid = keys[i]; const p = S.points[pid];
      if(!p) continue;
      if(Math.hypot(p.x-x,p.y-y) <= r) return pid;
    } return null;
  }

  function hitShape(x,y){
    const G = global.Geometry || global.geometry;
    const keys = Object.keys(S.shapes || {});
    for(let i=keys.length-1;i>=0;i--){
      const sid = keys[i]; const s = S.shapes[sid];
      if(!s) continue;
      if(!G) continue; 

      if(s.type === 'segment'){
        const a = S.points[s.a], b = S.points[s.b];
        if(!a||!b) continue;
        if(typeof G.pointToSegmentDistance === 'function' && G.pointToSegmentDistance({x,y}, a, b) < 6) return sid;
      } else if(s.type === 'circle'){
        const c = S.points[s.center]; if(!c) continue;
        if(Math.abs(Math.hypot(x-c.x,y-c.y) - s.radius) < 6) return sid;
      } else if(s.type === 'line'){
        const a = S.points[s.a], b = S.points[s.b]; if(!a||!b) continue;
        if(typeof G.pointToLineDistance === 'function' && G.pointToLineDistance({x,y}, a, b) < 6) return sid;
      }
    }
    return null;
  }

  function hitText(x, y) {
      for (const id in S.shapes) {
          const sh = S.shapes[id];
          if (sh.type !== "text") continue;
          // Hitbox cho text (khoảng 15px quanh điểm neo)
          if (Math.hypot(x - sh.x, y - sh.y) < 15) return id;
      }
      return null;
  }

  function pointInBox(p, box){
    return p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
  }

  // --- FIX QUAN TRỌNG: Lấy cả Point và Text nằm trong vùng chọn ---
  function getItemsInSelection(){
    const ids = [];
    if(!S.selectionBox) return ids;
    
    // 1. Quét Points
    for(const pid in S.points){
      if(pointInBox(S.points[pid], S.selectionBox)){
        ids.push(pid);
      }
    }
    
    // 2. Quét Texts (Shape type="text")
    for(const sid in S.shapes){
      const sh = S.shapes[sid];
      if(sh.type === 'text'){
         if(pointInBox({x: sh.x, y: sh.y}, S.selectionBox)){
             ids.push(sid);
         }
      }
    }
    
    return ids;
  }

  // ---------------- Selection Logic ----------------
  let selStart = null; 

  function startSelection(p){
    selStart = p;
    S.selectionBox = { x: p.x, y: p.y, w: 0, h: 0 };
    S.selectedPoints = [];
    S.selectedShape = null;
    if(global.Renderer) global.Renderer.render();
  }

  function updateSelection(p){
    if(!selStart) return;
    const x = Math.min(selStart.x, p.x), y = Math.min(selStart.y, p.y);
    const w = Math.abs(p.x - selStart.x), h = Math.abs(p.y - selStart.y);
    S.selectionBox = { x, y, w, h };
    if(global.Renderer) global.Renderer.render();
  }

  function finishSelection(){
    if(!S.selectionBox){ selStart = null; return; }
    
    // Lấy tất cả ID (Point + Text) nằm trong hộp
    S.selectedPoints = getItemsInSelection();
    
    S.transform = { mode: null, origin: null, startAngle: 0 };
    selStart = null;
    S.groupPoints = S.selectedPoints.slice();
    if(global.Renderer) global.Renderer.render();
  }

  function translateSelection(dx, dy){
    S.selectedPoints.forEach(id=>{
      // Nếu là Point
      if(S.points[id]){
          S.points[id].x += dx; S.points[id].y += dy;
      }
      // Nếu là Text
      else if(S.shapes[id] && S.shapes[id].type === 'text'){
          S.shapes[id].x += dx; S.shapes[id].y += dy;
      }
    });
    if(S.selectionBox){
      S.selectionBox.x += dx; S.selectionBox.y += dy;
    }
    if(global.Renderer) global.Renderer.render();
  }

  function rotateSelection(angle){
    const ids = S.selectedPoints;
    if(!ids || ids.length === 0) return;
    
    // Tính tâm xoay (trung bình cộng tọa độ tất cả các phần tử)
    let sx = 0, sy = 0;
    let count = 0;
    ids.forEach(id=>{ 
        if(S.points[id]){ sx += S.points[id].x; sy += S.points[id].y; count++; }
        else if(S.shapes[id] && S.shapes[id].type==='text'){ sx += S.shapes[id].x; sy += S.shapes[id].y; count++; }
    });
    if(count === 0) return;
    const cx = sx / count, cy = sy / count;

    ids.forEach(id=>{
      let obj = S.points[id] || S.shapes[id];
      if(!obj) return;
      
      const vx = obj.x - cx, vy = obj.y - cy;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const nx = vx * cos - vy * sin;
      const ny = vx * sin + vy * cos;
      obj.x = cx + nx; obj.y = cy + ny;
    });
    
    // Recalc selection box
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    ids.forEach(id=>{
        let obj = S.points[id] || S.shapes[id];
        if(obj) {
            if(obj.x < minx) minx = obj.x; if(obj.x > maxx) maxx = obj.x;
            if(obj.y < miny) miny = obj.y; if(obj.y > maxy) maxy = obj.y;
        }
    });
    S.selectionBox = { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
    if(global.Renderer) global.Renderer.render();
  }

  function detectResizeSide(p, box){
    if(!box) return null;
    const H = 8;
    const left = Math.abs(p.x - box.x) <= H;
    const right = Math.abs(p.x - (box.x + box.w)) <= H;
    const top = Math.abs(p.y - box.y) <= H;
    const bottom = Math.abs(p.y - (box.y + box.h)) <= H;

    if(left && top) return 'topleft';
    if(left && bottom) return 'bottomleft';
    if(right && top) return 'topright';
    if(right && bottom) return 'bottomright';
    if(left) return 'left';
    if(right) return 'right';
    if(top) return 'top';
    if(bottom) return 'bottom';
    return null;
  }

  function scaleSelectionAboutCenter(sx, sy){
    const box = S.selectionBox;
    if(!box || !S.selectedPoints.length) return;
    const cx = box.x + box.w/2, cy = box.y + box.h/2;
    S.selectedPoints.forEach(id=>{
      let obj = S.points[id] || S.shapes[id];
      if(obj) {
          obj.x = cx + (obj.x - cx) * sx;
          obj.y = cy + (obj.y - cy) * sy;
      }
    });
    const newW = box.w * sx;
    const newH = box.h * sy;
    S.selectionBox = { x: cx - newW/2, y: cy - newH/2, w: newW, h: newH };
    S.groupPoints = S.selectedPoints.slice();
    if(global.Renderer) global.Renderer.render();
  }

// -------------------- SVG Mouse Events --------------------
  svg.addEventListener('click', e => {
      if (AppState.tool === 'text') {
          const p = ptFromEvent(e);
          if (hitText(p.x, p.y)) return; // Tránh tạo text đè lên text cũ
          const content = prompt("Nhập nội dung văn bản:");
          if (content && content.trim() !== "") {
              global.Objects.createText(p.x, p.y, content);
              if(global.Renderer) global.Renderer.render();
          }
          return;
      }
  });

  // ----------------- Group Drag -----------------
  function startGroupDrag(p){
    S.groupDragging = true;
    S.groupDragStart = p;
    // S.selectedPoints bây giờ chứa cả PointID và TextID
    S.groupPoints = S.selectedPoints && S.selectedPoints.length ? S.selectedPoints.slice() : getItemsInSelection();
  }
  function stopGroupDrag(){
    S.groupDragging = false;
    S.groupDragStart = null;
  }
  function updateGroupDrag(p){
    if(!S.groupDragging || !S.groupDragStart) return;
    const dx = p.x - S.groupDragStart.x, dy = p.y - S.groupDragStart.y;
    S.groupDragStart = p;
    
    // --- FIX: Drag cả Point và Text ---
    S.groupPoints.forEach(id=>{
      if(S.points[id]){
        S.points[id].x += dx; S.points[id].y += dy;
      } else if(S.shapes[id] && S.shapes[id].type === 'text'){
        S.shapes[id].x += dx; S.shapes[id].y += dy;
      }
    });
    
    if(S.selectionBox){
      S.selectionBox.x += dx; S.selectionBox.y += dy;
    }
    if(global.Renderer) global.Renderer.render();
  }

  // -------------------- Mouse Interactions --------------------
  svg.addEventListener('mousedown', (ev)=>{
    ev.preventDefault();
    const p = ptFromEvent(ev);
    const hitP = hitPoint(p.x, p.y);
    const hitS = hitShape(p.x, p.y);
    const hitT = hitText(p.x, p.y); 

    // Rotate handle
    if(S.selectionBox){
      const sb = S.selectionBox;
      const hx = sb.x + sb.w/2, hy = sb.y - 20;
      if(Math.hypot(p.x - hx, p.y - hy) <= 8){
        S.transform = { mode: 'rotate', origin: { x: sb.x + sb.w/2, y: sb.y + sb.h/2 }, start: p, startAngle: 0 };
        return;
      }
    }

    // ----- RIGHT BUTTON: Selection / Context -----
    if(ev.button === 2){
      if (hitT) {
          S.selectedShape = hitT;
          S.selectedPoints = [];
          S.selectionBox = null;
          if (global.Renderer) global.Renderer.render();
          return;
      }
      if(hitP){
        S.selectedPoints = [hitP];
        S.selectedShape = null;
        S.selectionBox = null;
        S.groupPoints = S.selectedPoints.slice();
        if(global.Renderer) global.Renderer.render();
        return;
      }
      if(hitS){
        S.selectedShape = hitS;
        S.selectedPoints = [];
        S.selectionBox = null;
        if(global.Renderer) global.Renderer.render();
        return;
      }
      // Bắt đầu vẽ Selection Box
      startSelection(p);
      return;
    }

    // ----- LEFT BUTTON: Draw / Move -----
    if(ev.button === 0){
      if(S.selectionBox){
        if(pointInBox(p, S.selectionBox)){
          const maybeResize = detectResizeSide(p, S.selectionBox);
          if(maybeResize){
            S.resizeMode = maybeResize;
            S.resizeStart = p;
            S.groupPoints = S.selectedPoints.slice();
            return;
          } else {
            startGroupDrag(p);
            return;
          }
        }
      }

      if(S.tool === 'point'){
        const name = prompt('Tên điểm (ví dụ A):', '');
        const pid = global.Objects.createPoint(p.x, p.y, name || '');
        if(global.Renderer) global.Renderer.render();
        return;
      }

      if(S.tool === 'move'){
        if(hitP){
          S.dragging = { mode:'movePoint', pid: hitP, start: { x: S.points[hitP].x, y: S.points[hitP].y } };
          S.selectedPoints = [hitP]; S.selectedShape = null; S.selectionBox = null;
          if(global.Renderer) global.Renderer.render();
          return;
        }
        if(hitT) {
            S.selectedShape = hitT;
            S.selectedPoints = [];
            S.selectionBox = null;
            const txtObj = S.shapes[hitT];
            S.dragging = { mode: 'moveText', sid: hitT, start: { x: p.x, y: p.y }, original: { x: txtObj.x, y: txtObj.y } };
            if(global.Renderer) global.Renderer.render();
            return;
        }
        if(hitS) {
            S.selectedShape = hitS; S.selectedPoints = []; S.selectionBox = null;
            if(global.Renderer) global.Renderer.render();
        }
        startSelection(p);
        return;
      }

      // Drawing tools...
      if(S.tool === 'segment' || S.tool === 'segment-dashed'){
        const startPid = hitP || global.Objects.createPoint(p.x, p.y);
        S.preview = { type:'segment', x1: S.points[startPid].x, y1: S.points[startPid].y, x2: p.x, y2: p.y, color: S.color };
        S.dragging = { mode:'segment', startPid, dashed: S.tool === 'segment-dashed' };
        return;
      }

      if(S.tool === 'circle' || S.tool === 'circle-dashed'){
        const centerPid = hitP || global.Objects.createPoint(p.x, p.y);
        S.preview = { type:'circle', cx: S.points[centerPid].x, cy: S.points[centerPid].y, r:0, color: S.color };
        S.dragging = { mode:'circle', centerPid, dashed: S.tool === 'circle-dashed' };
        return;
      }

      if(S.tool === 'line' || S.tool === 'line-dashed'){
        if(hitP){
          S._linePending = S._linePending || [];
          if(S._linePending.length === 0){
            S._linePending.push(hitP);
            if(global.Renderer) global.Renderer.render();
            return;
          } else if(S._linePending.length === 1){
            global.Objects.createLine(S._linePending[0], hitP, { color: S.color, dashed: S.tool === 'line-dashed' });
            S._linePending = [];
            if(global.Renderer) global.Renderer.render();
            return;
          }
        } else {
          S._linePending = S._linePending || [];
          if(S._linePending.length === 0){
            const temp = global.Objects.createPoint(p.x, p.y, '');
            S._linePending.push(temp);
            S.preview = { type:'line', p1: S.points[temp], p2: {x: p.x, y: p.y}, color: S.color };
            S.dragging = { mode:'line', startPid: temp, dashed: S.tool === 'line-dashed' };
            return;
          } else if(S._linePending.length === 1){
            const pid = S._linePending[0];
            S.preview = { type:'line', p1: S.points[pid], p2: {x: p.x, y: p.y}, color: S.color };
            S.dragging = { mode:'line-from-point', basePid: pid, dashed: S.tool === 'line-dashed' };
            return;
          }
        }
      }
    }
  });

  // mousemove
  svg.addEventListener('mousemove', (ev)=>{
    const p = ptFromEvent(ev);

    if(S.transform && S.transform.mode === 'rotate' && S.transform.start){
      const origin = S.transform.origin;
      const start = S.transform.start;
      const ang1 = Math.atan2(start.y - origin.y, start.x - origin.x);
      const ang2 = Math.atan2(p.y - origin.y, p.x - origin.x);
      rotateSelection(ang2 - ang1);
      S.transform.start = p;
      return;
    }

    if(S.groupDragging){ updateGroupDrag(p); return; }

    if(S.resizeStart && S.resizeMode){
      const box = S.selectionBox;
      if(!box) return;
      const dx = p.x - S.resizeStart.x;
      const dy = p.y - S.resizeStart.y;
      let sx = 1, sy = 1;
      if(box.w !== 0) sx = 1 + dx / box.w;
      if(box.h !== 0) sy = 1 + dy / box.h;
      if(S.resizeMode === 'left' || S.resizeMode === 'right') sy = 1;
      else if(S.resizeMode === 'top' || S.resizeMode === 'bottom') sx = 1;
      scaleSelectionAboutCenter(sx, sy);
      S.resizeStart = p;
      return;
    }

    if(S.dragging){
      // Snapping Logic...
      function detectAndSnapPreview(startPt, curPointer, previewSetter){
        let found = null, foundType = null, foundAngle = null;
        for(const sid in S.shapes){
          const sh = S.shapes[sid];
          if(!sh) continue;
          if((sh.type === 'segment' || sh.type === 'line') && S.points[sh.a] && S.points[sh.b]){
            const pa = S.points[sh.a], pb = S.points[sh.b];
            const angExisting = angleBetween(pa, pb); 
            const angCur = angleBetween(startPt, curPointer);
            const ddeg = normalizeDeg(Math.abs(radToDeg(angExisting - angCur)));
            if(ddeg <= SNAP_DEG_TOL){ found = sid; foundType = 'parallel'; foundAngle = angExisting; break; }
            if(Math.abs(ddeg - 90) <= SNAP_DEG_TOL){ found = sid; foundType = 'perp'; foundAngle = angExisting + Math.PI/2; break; }
          }
        }
        if(found){
          highlightShapeRed(found);
          const len = Math.hypot(curPointer.x - startPt.x, curPointer.y - startPt.y) || 1;
          const dx = curPointer.x - startPt.x, dy = curPointer.y - startPt.y;
          const sx = Math.cos(foundAngle), sy = Math.sin(foundAngle);
          let finalAngle = foundAngle;
          if(dx * sx + dy * sy < 0) finalAngle += Math.PI;
          const nx = startPt.x + Math.cos(finalAngle) * len;
          const ny = startPt.y + Math.sin(finalAngle) * len;
          previewSetter(nx, ny, found, foundType);
          startSnapHold();
          return true;
        } else {
          clearHighlight();
          return false;
        }
      }

      if(S.dragging.mode === 'segment'){
        if(!_snapHold){
          S.preview.x2 = p.x; S.preview.y2 = p.y;
          const startPt = { x: S.preview.x1, y: S.preview.y1 };
          detectAndSnapPreview(startPt, {x:p.x,y:p.y}, (nx, ny)=>{ S.preview.x2 = nx; S.preview.y2 = ny; });
        }
        if(global.Renderer) global.Renderer.render();
      } else if(S.dragging.mode === 'circle'){
        const center = S.points[S.dragging.centerPid];
        S.preview.r = Math.hypot(p.x-center.x, p.y-center.y);
        if(global.Renderer) global.Renderer.render();
      } else if(S.dragging.mode === 'movePoint'){
        const pid = S.dragging.pid;
        S.points[pid].x = p.x; S.points[pid].y = p.y;
        if(global.Renderer) global.Renderer.render();
      } else if(S.dragging.mode === 'moveText'){
        const sid = S.dragging.sid;
        const sh = S.shapes[sid];
        if (sh && sh.type === 'text') {
             const dx = p.x - S.dragging.start.x;
             const dy = p.y - S.dragging.start.y;
             sh.x = S.dragging.original.x + dx;
             sh.y = S.dragging.original.y + dy;
             if(global.Renderer) global.Renderer.render();
        }
      } else if(S.dragging.mode === 'line-from-point' || S.dragging.mode === 'line'){
        if(!_snapHold){
          S.preview.p2 = {x: p.x, y: p.y};
          const startPt = S.preview.p1 ? { x: S.preview.p1.x, y: S.preview.p1.y } : (S.points[S.dragging.startPid] || {x:0,y:0});
          detectAndSnapPreview(startPt, {x:p.x,y:p.y}, (nx, ny)=>{ S.preview.p2 = {x:nx,y:ny}; });
        }
        if(global.Renderer) global.Renderer.render();
      }
      return;
    }

    if(selStart){ updateSelection(p); }

    try {
      if(S.selectionBox){
        const mode = detectResizeSide(p, S.selectionBox);
        svg.style.cursor = mode ? 'nwse-resize' : 'default';
      } else {
        svg.style.cursor = 'default';
      }
    } catch(e){}
  });

  // mouseup
  svg.addEventListener('mouseup', (ev)=>{
    const p = ptFromEvent(ev);

    if(S.transform && (S.transform.mode === 'rotate' || S.transform.mode === 'translate')){
      S.transform = { mode: null };
      return;
    }

    if(ev.button === 2 && selStart){ finishSelection(); return; }

    if(ev.button === 0){
      if(S.groupDragging){ stopGroupDrag(); return; }
      if(S.resizeStart){ S.resizeStart = null; S.resizeMode = null; return; }

      if(S.dragging){
        if(S.dragging.mode === 'segment'){
          const endPid = hitPoint(p.x,p.y) || global.Objects.createPoint(p.x,p.y,'');
          global.Objects.createSegment(S.dragging.startPid, endPid, { color: S.color, dashed: S.dragging.dashed });
        } else if(S.dragging.mode === 'circle'){
          const endPid = hitPoint(p.x,p.y) || global.Objects.createPoint(p.x,p.y,'');
          global.Objects.createCircle(S.dragging.centerPid, endPid, { color: S.color, dashed: S.dragging.dashed });
        } else if(S.dragging.mode === 'line-from-point'){
          const secondPid = hitPoint(p.x,p.y) || global.Objects.createPoint(p.x,p.y,'');
          global.Objects.createLine(S.dragging.basePid, secondPid, { color: S.color, dashed: S.dragging.dashed });
        } else if(S.dragging.mode === 'line'){
          const startPid = S.dragging.startPid;
          const secondPid = hitPoint(p.x,p.y) || global.Objects.createPoint(p.x,p.y,'');
          global.Objects.createLine(startPid, secondPid, { color: S.color, dashed: S.dragging.dashed });
        }
        
        S.preview = null; S.dragging = null; 
        clearHighlight(); 
        _snapHold = false; 
        if(_snapTimer) clearTimeout(_snapTimer);
        if(global.Renderer) global.Renderer.render();
      }
    }
  });

  // ---------------- Context Menu ----------------
  svg.addEventListener('contextmenu', (ev)=>{
    ev.preventDefault();
    const p = ptFromEvent(ev);
    const hs = hitShape(p.x,p.y), hp = hitPoint(p.x,p.y), ht = hitText(p.x,p.y);

    let insideSelection = false;
    if(S.selectionBox){
      const b = S.selectionBox;
      if(p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) insideSelection = true;
    }

    if(insideSelection && S.selectedPoints && S.selectedPoints.length){
      S.contextTarget = { type:'group', ids: S.selectedPoints.slice(), pos: p };
    } else if(hp){
      S.contextTarget = { type:'point', id: hp, pos: p };
      S.selectedPoints = [hp]; S.selectedShape = null;
    } else if(ht){
      S.contextTarget = { type:'shape', id: ht, pos: p };
      S.selectedShape = ht; S.selectedPoints = [];
    } else if(hs){
      S.contextTarget = { type:'shape', id: hs, pos: p };
      S.selectedShape = hs; S.selectedPoints = [];
    } else {
      S.contextTarget = null;
    }

    const baseItems = [
      {key:'change-color', label:'Change color'},
      {key:'toggle-dash', label:'Toggle dashed'},
      {key:'delete', label:'Delete'},
      {key:'rename-point', label:'Rename point'},
      {key:'edit-text', label:'Edit Text'}
    ];
    if(contextMenu) contextMenu.innerHTML = '';

    if(S.contextTarget && contextMenu){
      const targetShape = S.contextTarget.type === 'shape' ? S.shapes[S.contextTarget.id] : null;
      
      baseItems.forEach(it=>{
        if (it.key === 'rename-point' && S.contextTarget.type !== 'point') return;
        if (it.key === 'edit-text' && (!targetShape || targetShape.type !== 'text')) return;
        if (it.key === 'toggle-dash' && targetShape && targetShape.type === 'text') return;

        const el = document.createElement('div');
        el.className = 'cm-item'; el.dataset.cm = it.key;
        el.textContent = it.label;
        contextMenu.appendChild(el);
      });
      
      if(targetShape && targetShape.type === 'segment'){
          const a = S.points[targetShape.a], b = S.points[targetShape.b];
          const len = Math.hypot(a.x - b.x, a.y - b.y);
          const info = document.createElement('div'); 
          info.className = 'cm-item'; info.style.fontWeight = '600'; info.textContent = 'Length: ' + Number(len.toFixed(2));
          contextMenu.insertBefore(info, contextMenu.firstChild);
      }

      contextMenu.style.left = ev.clientX + 'px';
      contextMenu.style.top = ev.clientY + 'px';
      contextMenu.classList.remove('hidden');
    } else if(contextMenu){
      contextMenu.classList.add('hidden');
    }
    if(global.Renderer) global.Renderer.render();
  });

  document.addEventListener('click', (ev)=>{ if(contextMenu && !contextMenu.contains(ev.target)) contextMenu.classList.add('hidden'); });

  // ---------------- RGB Picker UI ----------------
  let _rgbPickerEl = null;
  function createRGBPicker(){
    if(_rgbPickerEl) return _rgbPickerEl;
    const wrap = document.createElement('div');
    wrap.id = 'rgb-picker';
    wrap.style.cssText = 'position:absolute; z-index:9999; padding:8px; background:#fff; border:1px solid #ccc; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.15); width:220px; font-family:sans-serif; font-size:13px;';
    
    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <div style="font-weight:600;">RGB Picker</div>
        <div id="rgb-close" style="margin-left:auto;cursor:pointer;color:#888">✕</div>
      </div>
      ${['r','g','b'].map(c=>`
      <div style="display:flex;gap:8px;align-items:center;">
        <div style="width:40px;text-align:center;text-transform:uppercase">${c}</div>
        <input id="rgb-${c}" type="range" min="0" max="255" value="0" style="flex:1">
        <div id="rgb-${c}v" style="width:36px;text-align:right">0</div>
      </div>`).join('')}
      <div style="height:10px"></div>
      <div style="display:flex;gap:8px;align-items:center;">
        <div id="rgb-preview" style="width:48px;height:28px;border-radius:4px;border:1px solid #ccc"></div>
        <button id="rgb-apply" style="flex:1;padding:6px;border-radius:6px;border:1px solid #777;background:#f7f7f7;cursor:pointer">Áp dụng</button>
      </div>
    `;
    document.body.appendChild(wrap);
    _rgbPickerEl = wrap;

    const els = {};
    ['r','g','b'].forEach(c=> {
        els[c] = wrap.querySelector(`#rgb-${c}`);
        els[c+'v'] = wrap.querySelector(`#rgb-${c}v`);
    });
    const preview = wrap.querySelector('#rgb-preview');
    
    function updatePreview(){
      const R=els.r.value, G=els.g.value, B=els.b.value;
      const color = `rgb(${R},${G},${B})`;
      preview.style.background = color;
      els['rv'].textContent = R; els['gv'].textContent = G; els['bv'].textContent = B;
    }
    ['r','g','b'].forEach(c => els[c].addEventListener('input', updatePreview));

    wrap.querySelector('#rgb-close').addEventListener('click', ()=>wrap.classList.add('hidden'));
    wrap.querySelector('#rgb-apply').addEventListener('click', ()=>{
      const color = `rgb(${els.r.value},${els.g.value},${els.b.value})`;
      if(typeof wrap._onApply === 'function') wrap._onApply(color);
      wrap.classList.add('hidden');
    });
    updatePreview();
    wrap.classList.add('hidden');
    return _rgbPickerEl;
  }

  function showRGBPickerAt(clientX, clientY, initialColor, onApply){
    const picker = createRGBPicker();
    function parseToRGB(col){
      if(!col) return [0,0,0];
      if(col[0] === '#'){
        try{
          return [parseInt(col.substr(1,2),16), parseInt(col.substr(3,2),16), parseInt(col.substr(5,2),16)];
        }catch(e){ return [0,0,0]; }
      }
      const m = col.match(/rgb\(\s*([0-9]+),\s*([0-9]+),\s*([0-9]+)\s*\)/);
      return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0,0,0];
    }
    const [R,G,B] = parseToRGB(initialColor || S.color || '#000000');
    
    picker.querySelector('#rgb-r').value = R;
    picker.querySelector('#rgb-g').value = G;
    picker.querySelector('#rgb-b').value = B;
    ['r','g','b'].forEach(c=>picker.querySelector(`#rgb-${c}`).dispatchEvent(new Event('input')));
    
    picker._onApply = onApply;
    
    const w = 240, h = 200;
    let left = clientX + 10, top = clientY + 10;
    if(left + w > window.innerWidth) left = window.innerWidth - w - 10;
    if(top + h > window.innerHeight) top = window.innerHeight - h - 10;
    picker.style.left = left + 'px'; picker.style.top = top + 'px';
    picker.classList.remove('hidden');
  }

  document.addEventListener('click', (ev)=>{
    const tgt = S.contextTarget;
    if(!tgt || !ev.target.classList.contains('cm-item')) return;
    const key = ev.target.dataset.cm;
    if(contextMenu) contextMenu.classList.add('hidden');

    if(key === 'edit-text' && tgt.type === 'shape'){
        const sh = S.shapes[tgt.id];
        if(sh && sh.type === 'text'){
            const newContent = prompt("Sửa nội dung:", sh.content); 
            if(newContent !== null) sh.content = newContent; 
            if(global.Renderer) global.Renderer.render();
        }
    } else if(key === 'change-color'){
      let initial = S.color || '#000000';
      if(tgt.type === 'shape') {
          const s = S.shapes[tgt.id];
          if(s.type === 'text') initial = s.style?.color || s.style?.fill || initial;
          else initial = s.style?.stroke || initial;
      }
      else if(tgt.type === 'point') initial = S.points[tgt.id]?.color || initial;
      else if(tgt.type === 'group' && tgt.ids.length) initial = S.points[tgt.ids[0]]?.color || initial;

      showRGBPickerAt(ev.clientX, ev.clientY, initial, (color)=>{
        if(tgt.type === 'shape'){
          const sh = S.shapes[tgt.id];
          if(!sh.style) sh.style = {};
          if(sh.type === 'text'){ sh.style.color = color; sh.style.fill = color; }
          else sh.style.stroke = color;
        } else if(tgt.type === 'point'){
          S.points[tgt.id].color = color;
        } else if(tgt.type === 'group'){
          tgt.ids.forEach(id => { 
              if(S.points[id]) S.points[id].color = color; 
              else if(S.shapes[id] && S.shapes[id].type === 'text'){
                  if(!S.shapes[id].style) S.shapes[id].style={};
                  S.shapes[id].style.color = color;
                  S.shapes[id].style.fill = color;
              }
          });
          for(const sid in S.shapes){
            const sh = S.shapes[sid];
            if(!sh) continue;
            if(sh.type === 'segment' || sh.type === 'line'){
              if(tgt.ids.includes(sh.a) && tgt.ids.includes(sh.b)){
                if(!sh.style) sh.style = {};
                sh.style.stroke = color;
              }
            } else if(sh.type === 'circle'){
              if(tgt.ids.includes(sh.center)){
                if(!sh.style) sh.style = {};
                sh.style.stroke = color;
              }
            }
          }
        }
        if(global.Renderer) global.Renderer.render();
      });
    } else if(key === 'toggle-dash'){
      if(tgt.type === 'shape'){
        if(!S.shapes[tgt.id].style) S.shapes[tgt.id].style = {};
        S.shapes[tgt.id].style.dashed = !S.shapes[tgt.id].style.dashed;
      } else if(tgt.type === 'group'){
        for(const sid in S.shapes){
          const sh = S.shapes[sid];
          if(!sh) continue;
          if((['segment','line'].includes(sh.type) && tgt.ids.includes(sh.a) && tgt.ids.includes(sh.b)) ||
             (sh.type === 'circle' && tgt.ids.includes(sh.center))){
             if(!sh.style) sh.style = {};
             sh.style.dashed = !sh.style.dashed;
          }
        }
      }
      if(global.Renderer) global.Renderer.render();
    } else if(key === 'delete'){
      if(tgt.type === 'shape') global.Objects.deleteShape(tgt.id);
      else if(tgt.type === 'point') global.Objects.deletePoint(tgt.id);
      else if(tgt.type === 'group'){
        const toDel = tgt.ids.slice();
        // --- FIX: Xóa cả Point và Text ---
        toDel.forEach(id => {
            if(S.points[id]) global.Objects.deletePoint(id);
            else if(S.shapes[id]) global.Objects.deleteShape(id);
        });
        
        // Clean up connected shapes (lines connected to deleted points)
        for(const sid in Object.assign({}, S.shapes)){
            const sh = S.shapes[sid];
            if(!sh) continue;
            if((['segment','line'].includes(sh.type) && (toDel.includes(sh.a) || toDel.includes(sh.b))) ||
               (sh.type === 'circle' && toDel.includes(sh.center))) {
                global.Objects.deleteShape(sid);
            }
        }
        S.selectedPoints = []; S.selectionBox = null;
      }
      S.contextTarget = null; if(global.Renderer) global.Renderer.render();
    } else if(key === 'rename-point'){
      if(tgt.type === 'point'){
        const newName = prompt('Đặt tên cho điểm:', S.points[tgt.id].name || '');
        if(newName !== null) { S.points[tgt.id].name = newName; if(global.Renderer) global.Renderer.render(); }
      }
    }
    S.contextTarget = null;
  }, true);

  const btnChange = document.getElementById('btn-change-color');
  if(btnChange) btnChange.addEventListener('click', ()=>{});

  window.addEventListener("load", () => {
      global.Renderer.render();
  });

  window.addEventListener('blur', ()=>{ if(contextMenu) contextMenu.classList.add('hidden'); if(_rgbPickerEl) _rgbPickerEl.classList.add('hidden'); });

})(window);