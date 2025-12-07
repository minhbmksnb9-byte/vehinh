// app.js - bootstrap
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.tool').forEach(b=>{ if(b.dataset.tool==='point') b.classList.add('active'); });
  AppState.tool = 'point';
  AppState.color = document.getElementById('colorPicker').value;
  Renderer.render();
});
