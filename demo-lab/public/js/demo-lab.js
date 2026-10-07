/* Next wiring step: find slots with data-demo-id and drop the live demo in. */
(function () {
  var nodes = document.querySelectorAll("[data-demo-id]");
  var slots = {};
  for (var i = 0; i < nodes.length; i++) {
    var id = nodes[i].getAttribute("data-demo-id");
    if (!slots[id]) slots[id] = [];
    slots[id].push(nodes[i]);
  }
  window.GMADemoLab = {
    ids: ["ticket", "extract", "organizer"],
    slots: slots
  };
})();
