const fs = require("fs");

const source = fs.readFileSync("index.html", "utf8");

const pages = [
    ["index.html", "dashboard"],
    ["dashboard.html", "dashboard"],
    ["inventory.html", "inventory"],
    ["sales.html", "sales"],
    ["orders.html", "orders"],
    ["reports.html", "reports"],
    ["customers.html", "customers"]
];

const destinations = {
    dashboard: "dashboard.html",
    inventory: "inventory.html",
    sales: "sales.html",
    orders: "orders.html",
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


    fs.writeFileSync(filename, html);
    console.log("Created:", filename);
}
