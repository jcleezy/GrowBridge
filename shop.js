/* GrowBridge Shop — buyer side: browse sellers' products, cart, order, track orders. */
(function () {
    "use strict";
    var root = document.getElementById("shop-root"), G = window.gbCloud;
    function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
    function tsh(n) { return "TSh " + Number(n || 0).toLocaleString("en-TZ"); }
    if (!G || !G.client || !G.session) { root.appendChild(h("p", "gb-auth-msg", "The shop needs sign-in and an internet connection.")); return; }

    var c = G.client, uid = G.session.user.id, NETWORKS = ["M-Pesa", "Tigo Pesa", "Airtel Money", "HaloPesa"];
    var st = { tab: "browse", q: "", products: [], sellers: {}, cart: {}, pay: {}, notes: {}, orders: [], msg: "" };

    var tabs = h("div", "gb-auth-tabs shop-tabs"), pane = h("div", "shop-pane");
    root.append(tabs, pane);

    function sellerName(id) { var s = st.sellers[id]; return (s && (s.shop_name || s.display_name)) || "Shop"; }
    function cartCount() { var n = 0; Object.keys(st.cart).forEach(function (s) { Object.keys(st.cart[s]).forEach(function (p) { n += st.cart[s][p]; }); }); return n; }
    function product(id) { return st.products.filter(function (p) { return p.id === id; })[0]; }

    function load() {
        return Promise.all([
            c.from("products").select("id,name,price,quantity,seller_id").gt("quantity", 0).order("name"),
            c.from("profiles").select("id,shop_name,display_name,momo_network,momo_number,phone").eq("role", "seller"),
            c.from("orders").select("id,status,paid,total,payment_method,payment_network,payment_ref,note,created_at,seller_id,order_items(name,qty,unit_price)").order("created_at", { ascending: false })
        ]).then(function (r) {
            st.products = r[0].data || [];
            st.sellers = {}; (r[1].data || []).forEach(function (s) { st.sellers[s.id] = s; });
            st.orders = r[2].data || [];
            render();
        });
    }

    function renderTabs() {
        tabs.textContent = "";
        [["browse", "Shop"], ["cart", "Cart (" + cartCount() + ")"], ["orders", "My orders"]].forEach(function (t) {
            var b = h("button", st.tab === t[0] ? "on" : "", t[1]); b.type = "button";
            b.addEventListener("click", function () { st.tab = t[0]; st.msg = ""; render(); });
            tabs.appendChild(b);
        });
    }

    function addToCart(p) {
        var cur = (st.cart[p.seller_id] = st.cart[p.seller_id] || {});
        if ((cur[p.id] || 0) < p.quantity) cur[p.id] = (cur[p.id] || 0) + 1;
        render();
    }

    function renderBrowse() {
        var search = h("input"); search.placeholder = "Search products or shops…"; search.value = st.q; search.type = "search";
        var grid = h("div", "shop-grid");
        function fill() {
            grid.textContent = "";
            var q = st.q.trim().toLowerCase(), shown = 0;
            st.products.forEach(function (p) {
                if (q && (p.name + " " + sellerName(p.seller_id)).toLowerCase().indexOf(q) === -1) return;
                shown++;
                var card = h("div", "dashboard-card shop-card");
                card.append(h("h3", "", p.name), h("p", "", tsh(p.price)), h("small", "", sellerName(p.seller_id) + " · " + p.quantity + " left"));
                var add = h("button", "", "Add to cart"); add.type = "button";
                add.addEventListener("click", function () { addToCart(p); });
                card.appendChild(add); grid.appendChild(card);
            });
            if (!shown) grid.appendChild(h("p", "empty-row", st.products.length ? "No matches." : "No products yet — sellers will appear here."));
        }
        search.addEventListener("input", function () { st.q = search.value; fill(); });
        fill(); pane.append(search, grid);
    }

    function renderCart() {
        var sellers = Object.keys(st.cart).filter(function (s) { return Object.keys(st.cart[s]).length; });
        if (st.msg) pane.appendChild(h("p", "gb-auth-msg good", st.msg));
        if (!sellers.length) { pane.appendChild(h("p", "empty-row", "Your cart is empty.")); return; }
        sellers.forEach(function (sid) {
            var box = h("div", "dashboard-card cart-box"), total = 0, s = st.sellers[sid] || {};
            box.appendChild(h("h3", "", sellerName(sid)));
            Object.keys(st.cart[sid]).forEach(function (pid) {
                var p = product(pid), qty = st.cart[sid][pid]; if (!p) return;
                total += p.price * qty;
                var row = h("div", "cart-row");
                var minus = h("button", "gb-mini", "−"), plus = h("button", "gb-mini", "+");
                minus.type = plus.type = "button";
                minus.addEventListener("click", function () { if (--st.cart[sid][pid] <= 0) delete st.cart[sid][pid]; render(); });
                plus.addEventListener("click", function () { if (qty < p.quantity) { st.cart[sid][pid]++; render(); } });
                row.append(h("span", "", p.name + " × " + qty), h("strong", "", tsh(p.price * qty)), minus, plus);
                box.appendChild(row);
            });
            var pay = (st.pay[sid] = st.pay[sid] || { method: "in_person", network: s.momo_network || NETWORKS[0] });
            var opts = h("div", "pay-opts");
            [["in_person", "Pay in person"], ["mobile_money", "Mobile money"]].forEach(function (o) {
                var b = h("button", pay.method === o[0] ? "on" : "", o[1]); b.type = "button";
                b.addEventListener("click", function () { pay.method = o[0]; render(); });
                opts.appendChild(b);
            });
            box.appendChild(opts);
            if (pay.method === "mobile_money") {
                var sel = h("select"); NETWORKS.forEach(function (n) { var o = h("option", "", n); o.selected = n === pay.network; sel.appendChild(o); });
                sel.addEventListener("change", function () { pay.network = sel.value; render(); });
                box.append(sel, h("small", "", s.momo_number
                    ? "Send " + tsh(total) + " to " + (s.momo_network || pay.network) + " " + s.momo_number + ", then add your payment reference under My orders."
                    : "This seller has not added a mobile money number. Choose pay in person or ask the seller."));
            }
            var note = h("textarea"); note.placeholder = "Note for the seller (optional)"; note.rows = 2; note.value = st.notes[sid] || "";
            note.addEventListener("input", function () { st.notes[sid] = note.value; });
            var go = h("button", "gb-auth-go", "Place order · " + tsh(total)); go.type = "button";
            go.addEventListener("click", function () {
                go.disabled = true;
                var items = Object.keys(st.cart[sid]).map(function (pid) { return { product_id: pid, qty: st.cart[sid][pid] }; });
                c.rpc("place_order", { p_seller: sid, p_items: items, p_method: pay.method, p_network: pay.method === "mobile_money" ? pay.network : null, p_note: st.notes[sid] || null })
                    .then(function (r) {
                        if (r.error) { go.disabled = false; st.msg = ""; alert(r.error.message); return; }
                        delete st.cart[sid]; st.tab = "orders"; st.msg = "Order placed!"; return load();
                    });
            });
            box.append(note, go); pane.appendChild(box);
        });
    }

    var LABEL = { pending: "Waiting for seller", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled" };
    function renderOrders() {
        if (st.msg) pane.appendChild(h("p", "gb-auth-msg good", st.msg));
        if (!st.orders.length) { pane.appendChild(h("p", "empty-row", "No orders yet.")); return; }
        st.orders.forEach(function (o) {
            var box = h("div", "dashboard-card cart-box");
            box.append(h("h3", "", sellerName(o.seller_id) + " · " + new Date(o.created_at).toLocaleDateString()),
                h("span", o.status === "cancelled" ? "low-stock" : "available", LABEL[o.status] || o.status));
            (o.order_items || []).forEach(function (i) { box.appendChild(h("small", "", i.qty + " × " + i.name + " — " + tsh(i.unit_price * i.qty))); });
            box.appendChild(h("strong", "", "Total " + tsh(o.total)));
            box.appendChild(h("small", "", o.payment_method === "in_person" ? "Payment: in person" :
                "Payment: " + (o.payment_network || "mobile money") + (o.paid ? " · paid ✓" : o.payment_ref ? " · reference sent, waiting for seller" : "")));
            if (o.payment_method === "mobile_money" && !o.paid && !o.payment_ref && o.status !== "cancelled") {
                var ref = h("input"); ref.placeholder = "Payment reference / transaction ID";
                var send = h("button", "", "Send reference"); send.type = "button";
                send.addEventListener("click", function () {
                    if (!ref.value.trim()) return;
                    c.rpc("buyer_set_payment_ref", { p_order: o.id, p_ref: ref.value.trim() }).then(load);
                });
                box.append(ref, send);
            }
            pane.appendChild(box);
        });
    }

    function render() {
        renderTabs(); pane.textContent = "";
        ({ browse: renderBrowse, cart: renderCart, orders: renderOrders })[st.tab]();
    }

    render();
    load().catch(function () { pane.textContent = ""; pane.appendChild(h("p", "gb-auth-msg", "Could not load the shop. Make sure the marketplace SQL was run in Supabase.")); });
    setInterval(function () { if (st.tab === "orders") load(); }, 30000);
})();
