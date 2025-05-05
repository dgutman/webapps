import { makeAbetaApp } from "../abeta.mjs";
makeAbetaApp(true);

$('#dsa-sidebar').on('click', '.item', (event) => {
    let item = $(event.target).data('item');
    this.openItem(item._id, event.target);
});