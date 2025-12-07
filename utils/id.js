(function(global){
  let _id = 1;
  function generateID(prefix){
    prefix = prefix || 'id';
    return prefix + '_' + (_id++);
  }
  global.generateID = generateID;
})(window);
