(function(){
  class UIRenderer {
    constructor(){}
    setFormat(fn){ this.format = fn; }
    notifyFill(payload){ try{ window.TradeNotifier && window.TradeNotifier.notify(payload);}catch(_){} }
  }
  window.UIRenderer = UIRenderer;
})();


