(function(global){
  const S = global.AppState;
  const Tools = {};

  function setTool(t){
    S.tool = t;
    document.querySelectorAll('.tool')
      .forEach(b => b.classList.toggle('active', b.dataset.tool===t));
  }

  Tools.setTool = setTool;
  global.Tools = Tools;
})(window);
