/* GrowBridge Assistant — bilingual (English / Kiswahili) business helper + translator.
   Runs fully in the browser. Reads live data from script.js (products, salesHistory, customers, totalSales). */
(function () {
    "use strict";

    var LANG_KEY = "growbridgeAssistantLang";
    var state = { lang: localStorage.getItem(LANG_KEY) || "auto", last: "en", dir: "en|sw", tab: "chat" };

    // ---------- helpers ----------
    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    }
    function tsh(n) { return "TSh " + Number(n || 0).toLocaleString("en-TZ"); }
    function data() {
        return {
            products: typeof products !== "undefined" ? products : [],
            sales: typeof salesHistory !== "undefined" ? salesHistory : [],
            customers: typeof customers !== "undefined" ? customers : [],
            total: typeof totalSales !== "undefined" ? totalSales : 0
        };
    }

    // ---------- language detection ----------
    var SW = ("habari mambo hujambo bidhaa mauzo mapato wateja mteja kuisha inaisha zinaisha ngapi nini jinsi naomba nipe " +
        "msaada ongeza futa hisa stoo asante samahani nataka ninaweza kuuza uza bei thamani leo zaidi sana gani ipi zipi " +
        "yangu wangu mwisho kuona kufuta kuongeza tafsiri nisaidie niambie biashara risiti").split(" ");
    function detect(text) {
        var words = text.toLowerCase().split(/[^a-zà-ÿ]+/);
        var hits = words.filter(function (w) { return SW.indexOf(w) !== -1; }).length;
        return hits > 0 ? "sw" : "en";
    }
    function currentLang(text) {
        if (state.lang === "en" || state.lang === "sw") return state.lang;
        return text ? (state.last = detect(text)) : state.last;
    }

    // ---------- assistant brain ----------
    function has(text, re) { return re.test(text); }

    function answer(raw) {
        var text = raw.toLowerCase().trim();
        var L = currentLang(raw);
        var sw = L === "sw";
        function t(en, swa) { return sw ? swa : en; }
        var d = data();

        // how-to questions
        if (has(text, /(how|jinsi|namna|nawezaje|naweza(je)?|ninawezaje|kuongeza|kufuta|kuuza)/)) {
            if (has(text, /(add|new|ongeza|kuongeza|mpya).*(product|item|bidhaa)|(product|bidhaa).*(add|ongeza)/))
                return t("To add a product: open Inventory, fill in the name, price and quantity, then press Add Product.",
                    "Kuongeza bidhaa: fungua Inventory, jaza jina, bei na idadi, kisha bonyeza Add Product.");
            if (has(text, /(delete|remove|futa|kufuta).*(sale|mauzo)|(sale|mauzo).*(delete|futa)/))
                return t("To delete a sale: open Sales, scroll to Sales History and press Delete next to the record. You can choose to return the units to stock, or press Keep it to cancel.",
                    "Kufuta mauzo: fungua Sales, shuka hadi Sales History na bonyeza Delete kwenye rekodi. Unaweza kuchagua kurudisha bidhaa stoo, au bonyeza Keep it kughairi.");
            if (has(text, /(sale|sell|uza|kuuza|mauzo)/))
                return t("To record a sale: open Sales, choose the product, enter the quantity and press Record Sale. A receipt is created automatically and stock goes down.",
                    "Kurekodi mauzo: fungua Sales, chagua bidhaa, weka idadi na bonyeza Record Sale. Risiti hutengenezwa yenyewe na stoo hupungua.");
            if (has(text, /(customer|mteja|wateja)/))
                return t("To add a customer: open Customers, enter the name and phone number and press Add Customer.",
                    "Kuongeza mteja: fungua Customers, weka jina na namba ya simu kisha bonyeza Add Customer.");
        }

        // a specific product mentioned?
        var named = d.products.filter(function (p) { return text.indexOf(String(p.name).toLowerCase()) !== -1; })[0];
        if (named) {
            var sold = d.sales.filter(function (s) { return s.productName === named.name; })
                .reduce(function (a, s) { return a + Number(s.quantity); }, 0);
            return t(
                named.name + ": " + named.quantity + " in stock at " + tsh(named.price) + " each" +
                    (named.quantity <= 5 ? " (low stock!)" : "") + ". Total sold so far: " + sold + ".",
                named.name + ": zimebaki " + named.quantity + " stoo, bei " + tsh(named.price) + " kila moja" +
                    (named.quantity <= 5 ? " (stoo inaisha!)" : "") + ". Zilizouzwa hadi sasa: " + sold + ".");
        }

        if (has(text, /(low|running out|out of stock|\w*isha\b|ndogo|upungufu)/)) {
            var low = d.products.filter(function (p) { return p.quantity <= 5; });
            if (!low.length) return t("Good news — no products are low on stock.", "Habari njema — hakuna bidhaa inayoisha stoo.");
            return t("Low stock (5 or fewer):\n", "Bidhaa zinazoisha (5 au pungufu):\n") +
                low.map(function (p) { return "• " + p.name + ": " + p.quantity; }).join("\n");
        }

        if (has(text, /(best|top|most|popular|inayouzika|zinazouzika|zaidi)/) && d.sales.length) {
            var map = {};
            d.sales.forEach(function (s) { map[s.productName] = (map[s.productName] || 0) + Number(s.quantity); });
            var top = Object.keys(map).sort(function (a, b) { return map[b] - map[a]; })[0];
            return t("Top seller: " + top + " (" + map[top] + " units sold).", "Inayouzika zaidi: " + top + " (zimeuzwa " + map[top] + ").");
        }

        if (has(text, /(recent|last|latest|mwisho|hivi karibuni|ya mwisho)/)) {
            if (!d.sales.length) return t("No sales recorded yet.", "Bado hakuna mauzo yaliyorekodiwa.");
            var s = d.sales[d.sales.length - 1];
            return t("Latest sale: " + s.quantity + " × " + s.productName + " for " + tsh(s.total) + " on " + new Date(s.date).toLocaleString() + ".",
                "Mauzo ya mwisho: " + s.quantity + " × " + s.productName + " kwa " + tsh(s.total) + " tarehe " + new Date(s.date).toLocaleString() + ".");
        }

        if (has(text, /(value|thamani)/)) {
            var v = d.products.reduce(function (a, p) { return a + p.price * p.quantity; }, 0);
            return t("Your stock is worth " + tsh(v) + ".", "Thamani ya stoo yako ni " + tsh(v) + ".");
        }

        if (has(text, /(sales|sold|revenue|income|mauzo|mapato|umeuza|zimeuzwa|today|leo)/)) {
            var today = new Date().toDateString();
            var todays = d.sales.filter(function (x) { return new Date(x.date).toDateString() === today; })
                .reduce(function (a, x) { return a + Number(x.total); }, 0);
            return t("Total sales: " + tsh(d.total) + " from " + d.sales.length + " transactions. Today: " + tsh(todays) + ".",
                "Jumla ya mauzo: " + tsh(d.total) + " kutoka miamala " + d.sales.length + ". Leo: " + tsh(todays) + ".");
        }

        if (has(text, /(customer|mteja|wateja)/))
            return t("You have " + d.customers.length + " customer(s) saved.", "Una wateja " + d.customers.length + " waliohifadhiwa.");

        if (has(text, /(product|inventory|stock|bidhaa|hisa|stoo)/)) {
            if (!d.products.length) return t("There are no products yet.", "Bado hakuna bidhaa.");
            return t("You have " + d.products.length + " products:\n", "Una bidhaa " + d.products.length + ":\n") +
                d.products.map(function (p) { return "• " + p.name + ": " + p.quantity + " @ " + tsh(p.price); }).join("\n");
        }

        if (has(text, /(translat|tafsiri|tafsiria)/)) {
            setTab("translate");
            return t("Opening the translator for you ➜", "Nakufungulia kitafsiri ➜");
        }

        if (has(text, /(thank|asante)/)) return t("You're welcome! 😊", "Karibu sana! 😊");
        if (has(text, /^(hi|hello|hey|mambo|habari|hujambo|salaam|vipi)/))
            return t("Hello! Ask me about stock, sales or customers.", "Habari! Niulize kuhusu stoo, mauzo au wateja.");

        return t("I can help with stock, sales, customers and how to use GrowBridge. Try: \"low stock\" or \"total sales\".",
            "Naweza kusaidia kuhusu stoo, mauzo, wateja na jinsi ya kutumia GrowBridge. Jaribu: \"bidhaa zinazoisha\" au \"jumla ya mauzo\".");
    }

    // ---------- translator ----------
    var PHRASES = {
        "hello": "Habari", "good morning": "Habari za asubuhi", "good evening": "Habari za jioni",
        "thank you": "Asante", "welcome": "Karibu", "please": "Tafadhali", "sorry": "Samahani",
        "how much is this": "Hii ni bei gani", "price": "Bei", "stock": "Hisa", "sales": "Mauzo",
        "customer": "Mteja", "receipt": "Risiti", "discount": "Punguzo", "payment": "Malipo",
        "change": "Chenji", "out of stock": "Imeisha", "available": "Ipo", "quantity": "Idadi",
        "how can i help you": "Naweza kukusaidia vipi"
    };
    var REVERSE = {};
    Object.keys(PHRASES).forEach(function (k) { REVERSE[PHRASES[k].toLowerCase()] = k.charAt(0).toUpperCase() + k.slice(1); });

    function norm(s) { return s.toLowerCase().trim().replace(/[.!?]+$/, ""); }

    function translate(text, dir) {
        var key = norm(text);
        var local = dir === "en|sw" ? PHRASES[key] : REVERSE[key];
        if (local) return Promise.resolve(local);
        var url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=" + dir;
        return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
            if (j && j.responseData && j.responseStatus === 200 && j.responseData.translatedText)
                return j.responseData.translatedText;
            throw new Error("bad response");
        });
    }

    // ---------- UI ----------
    var fab = el("button", "gb-fab", "💬");
    fab.type = "button";
    fab.setAttribute("aria-label", "Open assistant");

    var panel = el("section", "gb-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "GrowBridge assistant");
    panel.hidden = true;

    var head = el("div", "gb-head");
    var title = el("strong", "", "GrowBridge Assistant");
    var langBtn = el("button", "gb-mini", "");
    langBtn.type = "button";
    var closeBtn = el("button", "gb-mini", "✕");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    head.append(title, langBtn, closeBtn);

    var tabs = el("div", "gb-tabs");
    var tabChat = el("button", "", "Assistant");
    var tabTr = el("button", "", "Translate");
    tabChat.type = tabTr.type = "button";
    tabs.append(tabChat, tabTr);

    // chat view
    var chatView = el("div", "gb-view");
    var log = el("div", "gb-log");
    var chips = el("div", "gb-chips");
    var chatForm = el("div", "gb-row");
    var input = el("input");
    input.type = "text";
    input.autocomplete = "off";
    var send = el("button", "", "➤");
    send.type = "button";
    send.setAttribute("aria-label", "Send");
    chatForm.append(input, send);
    chatView.append(log, chips, chatForm);

    // translate view
    var trView = el("div", "gb-view gb-tr");
    var dirRow = el("div", "gb-dir");
    var fromLbl = el("span", "gb-pill");
    var swapBtn = el("button", "gb-mini", "⇄");
    swapBtn.type = "button";
    swapBtn.setAttribute("aria-label", "Swap languages");
    var toLbl = el("span", "gb-pill");
    dirRow.append(fromLbl, swapBtn, toLbl);
    var src = el("textarea");
    src.maxLength = 450;
    src.rows = 4;
    var trBtn = el("button", "gb-go", "");
    trBtn.type = "button";
    var out = el("div", "gb-out");
    var copyBtn = el("button", "gb-mini gb-copy", "Copy");
    copyBtn.type = "button";
    copyBtn.hidden = true;
    trView.append(dirRow, src, trBtn, out, copyBtn);

    panel.append(head, tabs, chatView, trView);
    document.body.append(fab, panel);

    var UI = {
        en: { ph: "Ask about stock, sales…", chips: ["Low stock", "Total sales", "Top product", "How to record a sale"],
              tph: "Type text to translate…", go: "Translate", from: "English", to: "Kiswahili", lang: "EN",
              welcome: "Hello! 👋 I'm your GrowBridge assistant. Ask me about stock, sales or customers.\nHabari! Niulize kwa Kiswahili pia." },
        sw: { ph: "Uliza kuhusu stoo, mauzo…", chips: ["Bidhaa zinazoisha", "Jumla ya mauzo", "Inayouzika zaidi", "Jinsi ya kuuza"],
              tph: "Andika maandishi ya kutafsiri…", go: "Tafsiri", from: "Kiswahili", to: "English", lang: "SW",
              welcome: "Habari! 👋 Mimi ni msaidizi wa GrowBridge. Niulize kuhusu stoo, mauzo au wateja." }
    };

    function ui() { return UI[state.lang === "sw" ? "sw" : "en"]; }

    function addMsg(text, who) {
        var m = el("div", "gb-msg gb-" + who, text);
        log.appendChild(m);
        log.scrollTop = log.scrollHeight;
    }

    function render() {
        var u = ui();
        input.placeholder = u.ph;
        src.placeholder = u.tph;
        trBtn.textContent = u.go;
        langBtn.textContent = "🌐 " + (state.lang === "auto" ? "AUTO" : u.lang);
        var en = { n: "English" }, swh = { n: "Kiswahili" };
        fromLbl.textContent = state.dir === "en|sw" ? en.n : swh.n;
        toLbl.textContent = state.dir === "en|sw" ? swh.n : en.n;
        chips.textContent = "";
        u.chips.forEach(function (c) {
            var b = el("button", "gb-chip", c);
            b.type = "button";
            b.addEventListener("click", function () { ask(c); });
            chips.appendChild(b);
        });
    }

    function setTab(name) {
        state.tab = name;
        chatView.hidden = name !== "chat";
        trView.hidden = name !== "translate";
        tabChat.className = name === "chat" ? "on" : "";
        tabTr.className = name === "translate" ? "on" : "";
    }

    function ask(text) {
        text = (text || input.value).trim();
        if (!text) return;
        input.value = "";
        addMsg(text, "me");
        var reply;
        try { reply = answer(text); } catch (e) { reply = "Sorry, something went wrong. / Samahani, kuna hitilafu."; }
        setTimeout(function () { addMsg(reply, "bot"); }, 250);
    }

    function runTranslate() {
        var text = src.value.trim();
        if (!text) return;
        out.textContent = "…";
        copyBtn.hidden = true;
        translate(text, state.dir).then(function (res) {
            out.textContent = res;
            copyBtn.hidden = false;
        }).catch(function () {
            out.textContent = state.lang === "sw"
                ? "Imeshindwa kutafsiri. Angalia mtandao kisha jaribu tena."
                : "Couldn't translate. Check your internet connection and try again.";
        });
    }

    function open() {
        panel.hidden = false;
        fab.hidden = true;
        if (!log.children.length) addMsg(ui().welcome, "bot");
        (state.tab === "chat" ? input : src).focus();
    }
    function close() { panel.hidden = true; fab.hidden = false; }

    fab.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) close(); });
    tabChat.addEventListener("click", function () { setTab("chat"); });
    tabTr.addEventListener("click", function () { setTab("translate"); });
    send.addEventListener("click", function () { ask(); });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") ask(); });
    trBtn.addEventListener("click", runTranslate);
    swapBtn.addEventListener("click", function () {
        state.dir = state.dir === "en|sw" ? "sw|en" : "en|sw";
        if (out.textContent && out.textContent !== "…") { src.value = out.textContent; out.textContent = ""; copyBtn.hidden = true; }
        render();
    });
    langBtn.addEventListener("click", function () {
        state.lang = state.lang === "auto" ? "en" : state.lang === "en" ? "sw" : "auto";
        localStorage.setItem(LANG_KEY, state.lang);
        render();
    });
    copyBtn.addEventListener("click", function () {
        var txt = out.textContent;
        if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(function () {});
        copyBtn.textContent = "✓";
        setTimeout(function () { copyBtn.textContent = "Copy"; }, 1200);
    });

    setTab("chat");
    render();
})();
