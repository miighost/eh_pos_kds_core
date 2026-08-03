/** @odoo-module */

export function getRootCategoryGroup(pos, product) {
    if (!product) {
        return "Food";
    }
    let categId = false;
    if (Array.isArray(product.pos_categ_id) && product.pos_categ_id.length > 0) {
        categId = product.pos_categ_id[0];
    } else if (typeof product.pos_categ_id === "number") {
        categId = product.pos_categ_id;
    } else if (product.pos_categ_id?.id) {
        categId = product.pos_categ_id.id;
    } else if (product.categ_id) {
        categId = Array.isArray(product.categ_id) ? product.categ_id[0] : (product.categ_id.id || product.categ_id);
    }

    if (!categId || !pos) {
        const pName = (product.name || product.display_name || "").toLowerCase();
        if (
            pName.includes("drink") ||
            pName.includes("beer") ||
            pName.includes("wine") ||
            pName.includes("cocktail") ||
            pName.includes("juice") ||
            pName.includes("coffee") ||
            pName.includes("tea") ||
            pName.includes("water") ||
            pName.includes("soda")
        ) {
            return "Drinks";
        }
        return "Food";
    }

    let cat = false;
    if (pos.db && typeof pos.db.get_category_by_id === "function") {
        cat = pos.db.get_category_by_id(categId);
    } else if (pos.models && pos.models["pos.category"]) {
        cat = pos.models["pos.category"].get(categId);
    }

    let curr = cat;
    let guard = 0;
    while (curr && curr.parent_id && guard < 10) {
        guard++;
        const parentId = Array.isArray(curr.parent_id) ? curr.parent_id[0] : (curr.parent_id.id || curr.parent_id);
        if (!parentId) break;
        let parentCat = false;
        if (pos.db && typeof pos.db.get_category_by_id === "function") {
            parentCat = pos.db.get_category_by_id(parentId);
        } else if (pos.models && pos.models["pos.category"]) {
            parentCat = pos.models["pos.category"].get(parentId);
        }
        if (parentCat) {
            curr = parentCat;
        } else {
            break;
        }
    }

    const catName = curr ? (curr.name || "") : (cat ? (cat.name || "") : "");
    const lower = catName.toLowerCase();
    if (
        lower.includes("drink") ||
        lower.includes("bar") ||
        lower.includes("beverage") ||
        lower.includes("wine") ||
        lower.includes("cocktail") ||
        lower.includes("beer") ||
        lower.includes("juice") ||
        lower.includes("coffee") ||
        lower.includes("tea") ||
        lower.includes("beverages")
    ) {
        return "Drinks";
    }
    return "Food";
}

export function exportForKitchenPrinting(pos, order, targetCategoryGroup = null) {
    if (!order) {
        return null;
    }

    let lines = order.getOrderlines ? order.getOrderlines() : (order.orderlines || order.lines || []);

    if (targetCategoryGroup) {
        lines = lines.filter((line) => {
            const product = line.getProduct ? line.getProduct() : (line.product || {});
            const group = getRootCategoryGroup(pos, product);
            return group === targetCategoryGroup;
        });
    }

    let hasNewItems = false;
    const newLines = [];
    const sentLines = [];

    const orderlines = lines.map((line) => {
        const product = line.getProduct ? line.getProduct() : (line.product || {});
        const productName = product ? (product.name || product.display_name || "") : "";
        const attributeValues =
            line.orderDisplayProductName?.attributeString ||
            (line.getFullProductName ? line.getFullProductName().replace(productName, "").trim() : "");

        let qtyNum = 1;
        let qtyStr = "";
        if (line.get_quantity) {
            qtyNum = line.get_quantity();
            qtyStr = String(qtyNum);
        } else if (line.getQuantityStr) {
            const qObj = line.getQuantityStr();
            qtyStr = qObj ? (qObj.qtyStr || String(qObj)) : "1";
            qtyNum = parseFloat(qtyStr) || 1;
        } else {
            qtyNum = line.quantity || line.qty || 1;
            qtyStr = String(qtyNum);
        }

        let note = "";
        if (pos.getStrNotes) {
            note = pos.getStrNotes(line.getNote ? line.getNote() : line.note);
        } else if (line.getNote) {
            note = line.getNote() || "";
        } else {
            note = line.note || "";
        }

        const printedQty = typeof line.printed_qty === "number" ? line.printed_qty : 0;
        const newQty = Math.max(0, qtyNum - printedQty);
        const isNew = newQty > 0;

        const lineData = {
            qty: qtyStr,
            qty_num: qtyNum,
            printed_qty: printedQty,
            new_qty: newQty,
            product_name: productName,
            attribute_values: attributeValues,
            note: note,
            is_new: isNew,
        };

        if (isNew) {
            hasNewItems = true;
            newLines.push(lineData);
        } else {
            sentLines.push(lineData);
        }

        return lineData;
    });

    let dateStr = "";
    try {
        if (order.date_order) {
            dateStr = typeof order.date_order === "string" ? order.date_order : order.date_order.toLocaleString();
        } else {
            dateStr = new Date().toLocaleString();
        }
    } catch (_e) {
        dateStr = new Date().toLocaleString();
    }

    const tableName =
        order.table_id && order.table_id.table_number
            ? order.table_id.table_number
            : (order.table_id?.name || "");
    const floorName =
        order.table_id && order.table_id.floor_id
            ? order.table_id.floor_id.name
            : "";

    const cashierName = order.getCashierName
        ? order.getCashierName()
        : (pos.get_cashier ? pos.get_cashier()?.name : "");

    const isAddition = Boolean(order.was_kot_printed && hasNewItems);

    return {
        name: order.name || order.pos_reference || "N/A",
        date: dateStr,
        table_name: tableName,
        floor_name: floorName,
        cashier: cashierName,
        general_note: order.general_customer_note || "",
        orderlines: orderlines,
        new_lines: newLines,
        sent_lines: sentLines,
        is_addition: isAddition,
        has_new_items: hasNewItems,
    };
}
