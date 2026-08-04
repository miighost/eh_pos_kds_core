/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { ActionpadWidget } from "@point_of_sale/app/screens/product_screen/action_pad/action_pad";
import { KitchenReceiptComponent } from "./KitchenReceiptComponent";
import { exportForKitchenPrinting } from "./utils";

function getOrderLines(order) {
    if (!order) {
        return [];
    }
    if (typeof order.get_orderlines === "function") {
        return order.get_orderlines() || [];
    }
    if (typeof order.get_order_lines === "function") {
        return order.get_order_lines() || [];
    }
    if (Array.isArray(order.orderlines)) {
        return order.orderlines;
    }
    if (Array.isArray(order.lines)) {
        return order.lines;
    }
    return [];
}

async function doPrintKitchenReceipt(posStore, currentOrder) {
    const pos = posStore;
    if (!pos) {
        return;
    }
    const order = currentOrder || (pos.get_order ? pos.get_order() : false);
    if (!order) {
        return;
    }
    const lines = getOrderLines(order);
    if (lines.length === 0) {
        return;
    }

    const categoriesToPrint = [];
    const foodData = exportForKitchenPrinting(pos, order, "Food");
    if (foodData && (foodData.has_new_items || !order.was_kot_printed) && foodData.orderlines.length > 0) {
        categoriesToPrint.push({ title: "KITCHEN", data: foodData });
    }

    const drinksData = exportForKitchenPrinting(pos, order, "Drinks");
    if (drinksData && (drinksData.has_new_items || !order.was_kot_printed) && drinksData.orderlines.length > 0) {
        categoriesToPrint.push({ title: "BAR", data: drinksData });
    }

    if (categoriesToPrint.length === 0) {
        const fullData = exportForKitchenPrinting(pos, order);
        if (fullData && (fullData.has_new_items || !order.was_kot_printed) && fullData.orderlines.length > 0) {
            categoriesToPrint.push({ title: "KITCHEN", data: fullData });
        }
    }


    for (const item of categoriesToPrint) {
        item.data.category_title = item.title;
        let printedDirect = false;

        if (pos.hardware_proxy && pos.hardware_proxy.printer) {
            try {
                const res = await pos.hardware_proxy.printer.print_receipt(
                    KitchenReceiptComponent,
                    { data: item.data }
                );
                if (res && res.result) {
                    printedDirect = true;
                }
            } catch (_e) {
                // proxy error
            }
        }

        if (!printedDirect && pos.printer && typeof pos.printer.print === "function") {
            try {
                await pos.printer.print(
                    KitchenReceiptComponent,
                    { data: item.data },
                    { webPrintFallback: true }
                );
            } catch (_e) {
                // ignore
            }
        }
    }

    if (categoriesToPrint.length > 0) {
        for (const line of lines) {
            const qtyNum = line.get_quantity ? line.get_quantity() : (line.quantity || line.qty || 1);
            line.printed_qty = qtyNum;
        }
        order.was_kot_printed = true;
    }

    if (pos.sendOrderInPreparation) {
        try {
            await pos.sendOrderInPreparation(order);
        } catch (_e) {
            // ignore network printer errors during testing
        }
    }
}


async function doSendOrderToKitchenAndReturnToTables(posStore, currentOrder) {
    const pos = posStore;
    if (!pos) {
        return;
    }
    const order = currentOrder || (pos.get_order ? pos.get_order() : false);
    if (!order) {
        return;
    }
    const lines = getOrderLines(order);
    if (lines.length === 0) {
        return;
    }

    // 1. Auto print separate KOT tickets for Food vs Drinks (no duplicates)
    try {
        await doPrintKitchenReceipt(pos, order);
    } catch (_e) {
        // ignore
    }

    // 2. Send/sync to preparation printers & KDS backend
    if (typeof pos.sendOrderInPreparation === "function") {
        try {
            await pos.sendOrderInPreparation(order);
        } catch (_e) {
            // ignore
        }
    } else if (typeof pos.push_single_order === "function") {
        try {
            await pos.push_single_order(order);
        } catch (_e) {
            // ignore
        }
    } else if (typeof pos.sync_orders === "function") {
        try {
            await pos.sync_orders();
        } catch (_e) {
            // ignore
        }
    }

    // 3. Return to FloorScreen / Tables map (/pos/ui/<config_id>/floor)
    let navigated = false;
    if (pos.router && typeof pos.router.navigate === "function") {
        try {
            pos.router.navigate("floor");
            navigated = true;
        } catch (_e) {}
    }
    if (!navigated && pos.showScreen) {
        try {
            pos.showScreen("FloorScreen");
            navigated = true;
        } catch (_e) {}
    }
    if (!navigated && pos.showScreen) {
        try {
            pos.showScreen("floor");
        } catch (_e) {}
    }
    if (typeof pos.set_table === "function") {
        try {
            pos.set_table(null);
        } catch (_e) {}
    }
}


const commonMethods = {
    async printKitchenReceipt() {
        const order = this.currentOrder || (this.pos && this.pos.get_order && this.pos.get_order());
        await doPrintKitchenReceipt(this.pos, order);
    },

    async onClickOrderButton() {
        const order = this.currentOrder || (this.pos && this.pos.get_order && this.pos.get_order());
        await doSendOrderToKitchenAndReturnToTables(this.pos, order);
    },

    async sendOrderAndReturnToTables() {
        const order = this.currentOrder || (this.pos && this.pos.get_order && this.pos.get_order());
        await doSendOrderToKitchenAndReturnToTables(this.pos, order);
    },
};

patch(ProductScreen.prototype, {
    setup() {
        super.setup();
        if (this.pos) {
            this.pos.printKitchenReceipt = (order) =>
                doPrintKitchenReceipt(this.pos, order || this.currentOrder || (this.pos.get_order && this.pos.get_order()));
            this.pos.sendOrderAndReturnToTables = (order) =>
                doSendOrderToKitchenAndReturnToTables(this.pos, order || this.currentOrder || (this.pos.get_order && this.pos.get_order()));
        }
    },
    ...commonMethods,
});

if (ActionpadWidget && ActionpadWidget.prototype) {
    patch(ActionpadWidget.prototype, commonMethods);
}


