//renderer.js
(function(global) {
  const S = global.AppState;
  const svg = document.getElementById('board');
  const POINT_R = 5;
  const TEXT_OFFSET = 12;
  const HANDLE_SIZE = 10;

  let CTM = null;

  // -------------------- 1. Helper --------------------
  function createElement(name, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const key in attrs) {
      if (key === 'xlink:href') {
        el.setAttributeNS('http://www.w3.org/1999/xlink', key, attrs[key]);
      } else {
        el.setAttribute(key, attrs[key]);
      }
    }
    return el;
  }

  // -------------------- 2. Coord Convert --------------------
  function clientToSvgPoint(x, y) {
    if (!CTM) {
      try {
        CTM = svg.getScreenCTM();
      } catch (e) {
        return { x: x, y: y };
      }
    }
    const pt = svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    const svgP = pt.matrixTransform(CTM.inverse());
    return { x: svgP.x, y: svgP.y };
  }

  // -------------------- 3. Style --------------------
  function applyShapeStyle(el, style = {}, isSelected = false) {
    let strokeColor = style.stroke || S.color || 'black';
    let strokeWidth = style['stroke-width'] || 2;

    el.setAttribute('stroke', strokeColor);
    el.setAttribute('stroke-width', strokeWidth);
    el.setAttribute('fill', style.fill || 'none');

    if (style.dashed || (S.dashedDefault && style.dashed !== false)) {
      el.setAttribute('stroke-dasharray', style['stroke-dasharray'] || '5,5');
    } else {
      el.removeAttribute('stroke-dasharray');
    }
  }

  // -------------------- DRAW PRIMITIVES --------------------

  function drawPoint(p, pid) {
    const r = POINT_R;
    const isSelected = S.selectedPoints && S.selectedPoints.includes(pid);
    const fillColor = isSelected ? '#007bff' : (p.color || 'black');
    const strokeColor = isSelected ? 'white' : 'white';

    const circle = createElement('circle', {
      cx: p.x, cy: p.y, r: isSelected ? r + 1 : r,
      fill: fillColor,
      stroke: strokeColor,
      'stroke-width': 1
    });
    circle.classList.add('point');
    svg.appendChild(circle);

    if (p.name) {
      const text = createElement('text', {
        x: p.x + TEXT_OFFSET,
        y: p.y + TEXT_OFFSET,
        'font-size': 16,
        fill: fillColor,
        'font-family': 'sans-serif'
      });
      text.textContent = p.name;
      svg.appendChild(text);
    }
  }

  function drawSegment(sh) {
    const p1 = S.points[sh.a], p2 = S.points[sh.b];
    if (!p1 || !p2) return;

    const line = createElement('line', {
      x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y
    });

    applyShapeStyle(line, sh.style);

    if (S.selectedShape === sh.id) {
      line.setAttribute('stroke', '#007bff');
      line.setAttribute('stroke-width', (Number(sh.style?.['stroke-width'] || 2)) + 1);
    }

    line.classList.add('shape', 'segment');
    svg.appendChild(line);
  }

  function drawLine(sh) {
    const p1 = S.points[sh.a], p2 = S.points[sh.b];
    if (!p1 || !p2) return;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;

    const uX = dx / len;
    const uY = dy / len;
    const EXT = 10000;

    const line = createElement('line', {
      x1: p1.x - uX * EXT, y1: p1.y - uY * EXT,
      x2: p1.x + uX * EXT, y2: p1.y + uY * EXT
    });

    applyShapeStyle(line, sh.style);

    if (S.selectedShape === sh.id) {
      line.setAttribute('stroke', '#007bff');
      line.setAttribute('stroke-width', (Number(sh.style?.['stroke-width'] || 2)) + 1);
    }

    line.classList.add('shape', 'line');
    svg.appendChild(line);
  }

  function drawCircle(sh) {
    const c = S.points[sh.center];
    if (!c) return;

    const circle = createElement('circle', {
      cx: c.x, cy: c.y, r: sh.radius, fill: 'none'
    });

    applyShapeStyle(circle, sh.style);

    if (S.selectedShape === sh.id) {
      circle.setAttribute('stroke', '#007bff');
      circle.setAttribute('stroke-width', (Number(sh.style?.['stroke-width'] || 2)) + 1);
    }

    circle.classList.add('shape', 'circle');
    svg.appendChild(circle);
  }

  // -------------------- NEW: DRAW TEXT SHAPE --------------------
  // Đã fix để hỗ trợ đổi màu khi select và tương thích với events.js

  function renderText(sh) {
      const el = document.createElementNS("http://www.w3.org/2000/svg", "text");
      
      // Hỗ trợ cả property .text và .content để tương thích ngược
      el.textContent = sh.text || sh.content || "";
      
      el.setAttribute("x", sh.x);
      el.setAttribute("y", sh.y);
      
      // Xử lý Style
      const style = sh.style || {};
      const fontSize = style.size || 16;
      
      // --- FIX: Kiểm tra cả Single Select VÀ Group Select ---
      // 1. S.selectedShape === sh.id: Khi click trực tiếp vào text
      // 2. S.selectedPoints.includes(sh.id): Khi text nằm trong vùng quét chuột phải
      const isSelected = (S.selectedShape === sh.id) || 
                         (S.selectedPoints && S.selectedPoints.includes(sh.id));

      // Nếu đang chọn thì màu Xanh (#007bff), không thì dùng màu của style hoặc đen
      const color = isSelected ? '#007bff' : (style.stroke || style.color || style.fill || "black");

      el.setAttribute("font-size", fontSize);
      el.setAttribute("fill", color);
      el.setAttribute("font-family", "sans-serif");
      
      // Ngăn chặn hành vi bôi đen văn bản của trình duyệt để Drag hoạt động mượt mà
      el.style.userSelect = "none"; 
      el.style.pointerEvents = "auto"; 

      svg.appendChild(el);
  }

  // -------------------- 4. Selection Box --------------------

  function drawSelectionBox() {
    if (!S.selectionBox) return;
    const b = S.selectionBox;

    const rect = createElement('rect', {
      x: b.x, y: b.y, width: b.w, height: b.h,
      fill: 'rgba(0, 123, 255, 0.1)',
      stroke: '#007bff',
      'stroke-width': 1,
      'stroke-dasharray': '4,4',
      'pointer-events': 'none'
    });
    rect.classList.add('no-pointer');
    svg.appendChild(rect);

    if (b.w > 0 && b.h > 0) {
      drawResizeHandles(b);
      drawRotateHandle(b);
    }
  }

  function drawResizeHandles(b) {
    const coords = [
      {x: b.x, y: b.y},
      {x: b.x + b.w/2, y: b.y},
      {x: b.x + b.w, y: b.y},
      {x: b.x + b.w, y: b.y + b.h/2},
      {x: b.x + b.w, y: b.y + b.h},
      {x: b.x + b.w/2, y: b.y + b.h},
      {x: b.x, y: b.y + b.h},
      {x: b.x, y: b.y + b.h/2}
    ];

    coords.forEach(p => {
      const hitbox = createElement('rect', {
        x: p.x - 15, y: p.y - 15,
        width: 30, height: 30,
        fill: 'transparent',
        'pointer-events': 'all'
      });
      hitbox.classList.add('resize-handle');
      svg.appendChild(hitbox);

      const handle = createElement('rect', {
        x: p.x - HANDLE_SIZE/2, y: p.y - HANDLE_SIZE/2,
        width: HANDLE_SIZE, height: HANDLE_SIZE,
        fill: 'white', stroke: '#007bff', 'stroke-width': 1,
        'pointer-events': 'none'
      });
      svg.appendChild(handle);
    });
  }

  function drawRotateHandle(b) {
    const cx = b.x + b.w / 2;
    const handleY = b.y - 20;

    const line = createElement('line', {
      x1: cx, y1: b.y, x2: cx, y2: handleY,
      stroke: '#007bff', 'stroke-width': 1
    });
    svg.appendChild(line);

    const circle = createElement('circle', {
      cx: cx, cy: handleY, r: 4,
      fill: 'white', stroke: '#007bff', 'stroke-width': 1,
      style: 'cursor: grab'
    });
    svg.appendChild(circle);
  }

  // -------------------- 5. Render --------------------
  function render() {
    svg.innerHTML = '';

    try { CTM = svg.getScreenCTM(); }
    catch (e) { CTM = null; }

    for (const id in S.shapes) {
      const sh = S.shapes[id];
      sh.id = id;

      if (sh.type === 'segment') drawSegment(sh);
      else if (sh.type === 'circle') drawCircle(sh);
      else if (sh.type === 'line') drawLine(sh);
      else if (sh.type === 'text') renderText(sh); // <-- Gọi hàm render text đã sửa
    }

    if (S.preview) {
      const p = S.preview;
      const style = { stroke: p.color || S.color, dashed: p.dashed || S.dashedDefault };

      if (p.type === 'segment') {
        const line = createElement('line', {
          x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2,
          'stroke-width': 2
        });
        applyShapeStyle(line, style);
        line.classList.add('preview');
        svg.appendChild(line);
      }

      else if (p.type === 'line' && p.p1 && p.p2) {
        const dx = p.p2.x - p.p1.x;
        const dy = p.p2.y - p.p1.y;
        const len = Math.hypot(dx, dy);
        if (len > 0) {
          const uX = dx / len, uY = dy / len;
          const EXT = 10000;

          const line = createElement('line', {
            x1: p.p1.x - uX * EXT, y1: p.p1.y - uY * EXT,
            x2: p.p1.x + uX * EXT, y2: p.p1.y + uY * EXT,
            'stroke-width': 2
          });
          applyShapeStyle(line, style);
          line.classList.add('preview');
          svg.appendChild(line);
        }
      }

      else if (p.type === 'circle') {
        const circle = createElement('circle', {
          cx: p.cx, cy: p.cy, r: p.r,
          fill: 'none', 'stroke-width': 2
        });
        applyShapeStyle(circle, style);
        circle.classList.add('preview');
        svg.appendChild(circle);
      }
    }

    for (const id in S.points) {
      drawPoint(S.points[id], id);
    }

    drawSelectionBox();
  }

  global.Renderer = {
    render,
    clientToSvgPoint
  };

})(window);