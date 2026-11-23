// GROWBRIDGE PRODUCT INVENTORY
let products = JSON.parse(localStorage.getItem("growbridgeProducts")) || [
    { name: "Rice", price: 2500, quantity: 10 },
    { name: "Sugar", price: 3000, quantity: 15 },
    { name: "Cooking Oil", price: 8000, quantity: 5 }
];

// Find HTML elements
let productList = document.getElementById("product-list");
let totalValue = document.getElementById("total-value");
let productForm = document.getElementById("product-form");
// SALES ELEMENTS
let saleProduct = document.getElementById("sale-product");
let salesForm = document.getElementById("sales-form");
let saleMessage = document.getElementById("sale-message");
let totalSalesDisplay = document.getElementById("total-sales");

let totalSales = Number(localStorage.getItem("growbridgeTotalSales")) || 0;
// CUSTOMER MANAGEMENT

let customers = JSON.parse(
    localStorage.getItem("growbridgeCustomers")
) || [];

let customerForm =
    document.getElementById("customer-form");

    document.getElementById("customer-list");let customerList =
    document.getElementById("customer-list");
    document.getElementById("customer-search");let customerSearch =
    document.getElementById("customer-search");
let totalCustomersDisplay =
    document.getElementById("total-customers");
// LOAD SALES HISTORY
let salesHistory = JSON.parse(
    localStorage.getItem("growbridgeSalesHistory")
) || [];

let salesHistoryTable =
    document.getElementById("sales-history");
// BUSINESS REPORT ELEMENTS

let reportRevenue =
    document.getElementById("report-revenue");

let reportTransactions =
    document.getElementById("report-transactions");

let reportProductsSold =
    document.getElementById("report-products-sold");

let recentSalesTable =
    document.getElementById("recent-sales");

// DISPLAY SALES HISTORY

function displaySalesHistory() {

    salesHistoryTable.innerHTML = "";

    salesHistory.forEach(function(sale) {

        let row = document.createElement("tr");

        row.innerHTML = `
            <td>${sale.productName}</td>
            <td>${sale.quantity}</td>
            <td>TSh ${Number(sale.unitPrice).toLocaleString("en-TZ")}</td>
            <td>TSh ${Number(sale.total).toLocaleString("en-TZ")}</td>
            <td>${new Date(sale.date).toLocaleString()}</td>
        `;

        salesHistoryTable.appendChild(row);

    });

}

// BUSINESS REPORTS FUNCTION

function displayBusinessReports() {
console.log("Saved sales history:", salesHistory);
console.log("Sales history count:", salesHistory.length);
    // Calculate total revenue
    let totalRevenue = salesHistory.reduce(function(total, sale) {
        return total + Number(sale.total);
    }, 0);

    // Count sales transactions
    let totalTransactions = salesHistory.length;

    // Calculate total products sold
    let totalProductsSold = salesHistory.reduce(function(total, sale) {
        return total + Number(sale.quantity);
    }, 0);

    // Display report figures
    reportRevenue.textContent =
        "TSh " + totalRevenue.toLocaleString("en-TZ");

    reportTransactions.textContent = totalTransactions;

    reportProductsSold.textContent = totalProductsSold;

    // Display the five most recent sales
    recentSalesTable.innerHTML = "";

    let recentSales = salesHistory.slice(-5).reverse();

    recentSales.forEach(function(sale) {

        let row = document.createElement("tr");

        row.innerHTML = `
            <td>${sale.productName}</td>
            <td>${sale.quantity}</td>
            <td>TSh ${Number(sale.total).toLocaleString("en-TZ")}</td>
            <td>${new Date(sale.date).toLocaleString()}</td>
        `;

        recentSalesTable.appendChild(row);

    });

}
// DISPLAY CUSTOMERS



function displayCustomers() {

    customerList.innerHTML = "";
totalCustomersDisplay.textContent = customers.length;
    customers.forEach(function(customer, index) {

        let row = document.createElement("tr");

        let nameCell = document.createElement("td");
        nameCell.textContent = customer.name;

        let phoneCell = document.createElement("td");
        phoneCell.textContent = customer.phone;

        let actionCell = document.createElement("td");
        
let editButton = document.createElement("button");
editButton.textContent = "Edit";

editButton.addEventListener("click", function() {

    let newName = prompt("Enter new customer name:", customer.name);

    if (newName === null || newName.trim() === "") {
        return;
    }

    let newPhone = prompt("Enter new phone number:", customer.phone);

    if (newPhone === null || newPhone.trim() === "") {
        return;
    }

    customers[index].name = newName.trim();
    customers[index].phone = newPhone.trim();

    localStorage.setItem(
        "growbridgeCustomers",
        JSON.stringify(customers)
    );

    displayCustomers();

    alert("Customer updated successfully!");

});

actionCell.appendChild(editButton);

        let deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", function() {

            let confirmDelete = confirm(
                "Are you sure you want to delete this customer?"
            );

            if (confirmDelete) {

                customers.splice(index, 1);

                localStorage.setItem(
                    "growbridgeCustomers",
                    JSON.stringify(customers)
                );

                displayCustomers();

            }

        });

        actionCell.appendChild(deleteButton);

        row.appendChild(nameCell);
        row.appendChild(phoneCell);
        row.appendChild(actionCell);

        customerList.appendChild(row);

    });

}


function searchCustomers() {

    let searchValue = customerSearch.value.toLowerCase();

    customerList.innerHTML = "";

    customers.forEach(function(customer, index) {

        let name = customer.name.toLowerCase();
        let phone = customer.phone.toLowerCase();

        if (
            name.includes(searchValue) ||
            phone.includes(searchValue)
        ) {

            let row = document.createElement("tr");

            let nameCell = document.createElement("td");
            nameCell.textContent = customer.name;

            let phoneCell = document.createElement("td");
            phoneCell.textContent = customer.phone;

            let actionCell = document.createElement("td");

            let editButton = document.createElement("button");
            editButton.textContent = "Edit";

            editButton.addEventListener("click", function() {

                let newName = prompt("Enter new customer name:", customer.name);

                if (newName === null || newName.trim() === "") return;

                let newPhone = prompt("Enter new phone number:", customer.phone);

                if (newPhone === null || newPhone.trim() === "") return;

                customers[index].name = newName.trim();
                customers[index].phone = newPhone.trim();

                localStorage.setItem(
                    "growbridgeCustomers",
                    JSON.stringify(customers)
                );

                searchCustomers();

            });

            let deleteButton = document.createElement("button");
            deleteButton.textContent = "Delete";

            deleteButton.addEventListener("click", function() {

                if (confirm("Delete this customer?")) {

                    customers.splice(index, 1);

                    localStorage.setItem(
                        "growbridgeCustomers",
                        JSON.stringify(customers)
                    );

                    searchCustomers();

                }

            });

            actionCell.appendChild(editButton);
            actionCell.appendChild(deleteButton);

            row.appendChild(nameCell);
            row.appendChild(phoneCell);
            row.appendChild(actionCell);

            customerList.appendChild(row);

        }

    });

}
customerSearch.addEventListener("input", searchCustomers);

 // REGISTER CUSTOMER

customerForm.addEventListener("submit", function(event) {

    event.preventDefault();

    let name = document.getElementById("customer-name").value.trim();

    let phone = document.getElementById("customer-phone").value.trim();

    if (name === "" || phone === "") {
        alert("Please enter customer name and phone number.");
        return;
    }

    let customer = {
        name: name,
        phone: phone
    };

    customers.push(customer);

    localStorage.setItem(
        "growbridgeCustomers",
        JSON.stringify(customers)
    );

    displayCustomers();

    customerForm.reset();

    alert("Customer registered successfully!");

});

// DISPLAY SAVED CUSTOMERS
displayCustomers();


// DISPLAY PRODUCTS

function displayProducts() {

    productList.innerHTML = "";

    let searchInput = document.getElementById("product-search");

    let searchTerm = searchInput
        ? searchInput.value.toLowerCase()
        : "";

    let filteredProducts = products.filter(function(product) {
        return product.name.toLowerCase().includes(searchTerm);
    });

    localStorage.setItem(
        "growbridgeProducts",
        JSON.stringify(products)
    );

    // Calculate total stock value using ALL products
    let totalStockValue = products.reduce(function(total, product) {
        return total + product.price * product.quantity;
    }, 0);

    // Display matching products
    filteredProducts.forEach(function(product) {

        let row = document.createElement("tr");

        row.innerHTML = `
            <td>${product.name}</td>
            <td>TSh ${product.price.toLocaleString("en-TZ")}</td>
            <td>${product.quantity}</td>
            <td>
                ${product.quantity <= 5
                    ? '<span class="low-stock">LOW STOCK</span>'
                    : '<span class="available">Available</span>'}
            </td>
            <td>
                <button onclick="deleteProduct(${products.indexOf(product)})">
                    Delete
                </button>
            </td>
        `;

        productList.appendChild(row);

    });

    totalValue.textContent =
        "Total Stock Value: TSh " + totalStockValue.toLocaleString("en-TZ");

    // UPDATE DASHBOARD

    document.getElementById("total-products").textContent =
        products.length;

    document.getElementById("dashboard-stock-value").textContent =
        "TSh " + totalStockValue.toLocaleString("en-TZ");

    let lowStockCount = products.filter(function(product) {
        return product.quantity <= 5;
    }).length;

    document.getElementById("low-stock-count").textContent =
        lowStockCount;

    let totalUnits = products.reduce(function(total, product) {
        return total + product.quantity;
    }, 0);

    document.getElementById("total-units").textContent = totalUnits;

    // UPDATE SALES PRODUCT MENU

    saleProduct.innerHTML =
        '<option value="">Choose a product</option>';

    products.forEach(function(product, index) {

        let option = document.createElement("option");

        option.value = index;

        option.textContent =
            product.name + " (Stock: " + product.quantity + ")";

        saleProduct.appendChild(option);

    });

}





// Add new product
productForm.addEventListener("submit", function(event) {

    event.preventDefault();

    let name = document.getElementById("product-name").value;
    let price = Number(document.getElementById("product-price").value);
    let quantity = Number(document.getElementById("product-quantity").value);

    // Validate product name
    if (name.trim() === "") {
        alert("Please enter a product name.");
        return;
    }

    // Validate price and quantity
if (!Number.isFinite(price) || !Number.isFinite(quantity) || price <= 0 || quantity <= 0) {        alert("Price and quantity must be greater than zero.");
        return;
    }

    // Add product
    products.push({
        name: name.trim(),
        price: price,
        quantity: quantity
    });

    displaySalesHistory();displayProducts();

    productForm.reset();

});
displayProducts();
// Display initial products and reports
displayProducts();
displaySalesHistory();
displayBusinessReports();


// DISPLAY TOTAL SALES
totalSalesDisplay.textContent =
    "Total Sales: TSh " + totalSales.toLocaleString("en-TZ");

// RECORD A SALE
salesForm.addEventListener("submit", function(event) {

    event.preventDefault();

    let selectedIndex = Number(saleProduct.value);

    let quantitySold = Number(
        document.getElementById("sale-quantity").value
    );

    if (saleProduct.value === "" ||
        !Number.isInteger(quantitySold) ||
        quantitySold <= 0) {

        alert("Please select a product and enter a valid quantity.");
        return;
    }

    let product = products[selectedIndex];

    if (!product || quantitySold > product.quantity) {

        alert("Not enough stock available!");
        return;
    }

    let saleAmount = product.price * quantitySold;

    product.quantity -= quantitySold;

    totalSales += saleAmount;
// SAVE SALE RECORD

let saleRecord = {
    productName: product.name,
    quantity: quantitySold,
    unitPrice: product.price,
    total: saleAmount,
    date: new Date().toISOString()
};

salesHistory.push(saleRecord);

localStorage.setItem(
    "growbridgeSalesHistory",
    JSON.stringify(salesHistory)
);
    localStorage.setItem(
        "growbridgeTotalSales",
        totalSales
    );

    displayProducts();
displaySalesHistory();
displayBusinessReports();
    totalSalesDisplay.textContent =
        "Total Sales: TSh " + totalSales.toLocaleString("en-TZ");

    saleMessage.textContent =
        "Sale recorded successfully!";

    salesForm.reset();

});


// Delete a product
function deleteProduct(index) {

    products.splice(index, 1);

    displayProducts();
displayBusinessReports();
}
// EDIT PRODUCT

function editProduct(index) {

    let product = products[index];

    let newName = prompt("Enter new product name:", product.name);

    if (newName === null || newName.trim() === "") {
        return;
    }

    let newPrice = Number(
        prompt("Enter new product price:", product.price)
    );

    if (!Number.isFinite(newPrice) || newPrice <= 0) {
        alert("Please enter a valid price.");
        return;
    }

    let newQuantity = Number(
        prompt("Enter new product quantity:", product.quantity)
    );

    if (!Number.isInteger(newQuantity) || newQuantity < 0) {
        alert("Please enter a valid quantity.");
        return;
    }

    product.name = newName.trim();
    product.price = newPrice;
    product.quantity = newQuantity;

    displayProducts();

    alert("Product updated successfully!");

}
// GROWBRIDGE ACTIVE SIDEBAR LINK

let navLinks = document.querySelectorAll(".nav-link");

let pageSections = document.querySelectorAll("main section");

window.addEventListener("scroll", function() {

    let currentSection = "";

    pageSections.forEach(function(section) {

        let sectionTop = section.offsetTop;

        if (window.scrollY >= sectionTop - 150) {
            currentSection = section.getAttribute("id");
        }

    });

    navLinks.forEach(function(link) {

        link.classList.remove("active");

        if (link.getAttribute("href") === "#" + currentSection) {
            link.classList.add("active");
        }

    });

});
// GROWBRIDGE BACK TO TOP FUNCTION

let backToTop = document.getElementById("back-to-top");

window.addEventListener("scroll", function() {

    if (window.scrollY > 300) {
        backToTop.style.display = "block";
    } else {
        backToTop.style.display = "none";
    }

});

backToTop.addEventListener("click", function() {

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

});
// GROWBRIDGE PRODUCT SEARCH


productSearch.addEventListener("input", function() {
    displayProducts();
});
let productSearch = document.getElementById("product-search");

console.log("GrowBridge search initialized:", productSearch);

productSearch.addEventListener("input", function() {

    console.log("Search input:", productSearch.value);

    displayProducts();

});
