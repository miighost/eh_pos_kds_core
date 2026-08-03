/** @odoo-module */

export function exportForKitchenPrinting(pos, order) {
    if (!order) {
        return null;
    }

    const lines = order.getOrderlines ? order.getOrderlines() : (order.orderlines || order.lines || []);
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
