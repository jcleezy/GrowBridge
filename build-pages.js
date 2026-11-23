const fs = require("fs");

const source = fs.readFileSync("index.html", "utf8");

const pages = [
    ["index.html", "dashboard"],
    ["dashboard.html", "dashboard"],
    ["inventory.html", "inventory"],
    ["sales.html", "sales"],
    ["reports.html", "reports"],
    ["customers.html", "customers"]
];

const destinations = {
    dashboard: "dashboard.html",
    inventory: "inventory.html",
    sales: "sales.html",
    reports: "reports.html",
    customers: "customers.html"
};

for (const [filename, page] of pages) {
    let html = source;

html = html.replace(
    /<body[^>]*>/,
    `<body class="page-${page}">`
);
    for (const [section, destination] of Object.entries(destinations)) {
        html = html.replaceAll(`href="#${section}"`, `href="${destination}"`);
    }

    const customerLink = '<a href="customers.html" class="nav-link">\n            <span>♙</span> Customers\n        </a>';

    if (!html.includes(customerLink)) {
        html = html.replace(
            '<a href="reports.html" class="nav-link">',
            customerLink + '\n        <a href="reports.html" class="nav-link">'
        );
    }

    const css = `
<style>
body.page-dashboard main section:not(#dashboard),
body.page-inventory main section:not(#inventory),
body.page-sales main section:not(#sales),
body.page-reports main section:not(#reports),
body.page-customers main section:not(#customers) {
    display: none !important;
}
body.page-dashboard .nav-link[href="dashboard.html"],
body.page-inventory .nav-link[href="inventory.html"],
body.page-sales .nav-link[href="sales.html"],
body.page-reports .nav-link[href="reports.html"],
body.page-customers .nav-link[href="customers.html"] {
    background-color: #16a34a;
}
</style>`;

    html = html.replace("</head>", css + "\n</head>");

    fs.writeFileSync(filename, html);
    console.log("Created:", filename);
}
