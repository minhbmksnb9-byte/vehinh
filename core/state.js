(function(global){
  const State = {
    tool: 'point',
    color: '#001c97ff',
    // size: 100,
    dashedDefault: false,
    points: {},   // id -> {id,x,y,name}
    shapes: {},   // id -> {id,type,...}
    nextIndex: 1,
    selectedPoints: [], // point ids selected (max 2)
    selectedShape: null,
    preview: null,
    dragging: null,
    contextTarget: null,

    // NEW: selection box & transform
    selectionBox: null, // {x,y,width,height} in svg coords
    transform: { mode: null }, // transform dragging state (move/rotate)
    // temporary measurement labels (id -> {x,y,text})
    measurements: {} // key -> {x,y,text,ttl(optional)}
  };
  global.AppState = State;
})(window);
