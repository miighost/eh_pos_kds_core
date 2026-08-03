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

    const kitchenData = exportForKitchenPrinting(pos, order);

    // Auto-print ONLY when there are new unprinted items or if it's the first print.
    // Prevents printing duplicate KOT receipts if no new items were added.
    if (kitchenData && (kitchenData.has_new_items || !order.was_kot_printed)) {
        if (pos.printer && typeof pos.printer.print === "function") {
            try {
                await pos.printer.print(
                    KitchenReceiptComponent,
                    { data: kitchenData },
                    { webPrintFallback: true }
                );
            } catch (_e) {
                // ignore printer errors
            }
        }

        // Update line.printed_qty on each orderline so future additions are tracked precisely
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
            // ignore if not configured
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

    // 1. Auto print KOT for NEW unprinted items only (no duplicate prints)
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

    // 3. Return to FloorScreen
    if (pos.showScreen) {
        try {
            pos.showScreen("FloorScreen");
        } catch (_e) {
            // fallback
        }
    }
}

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
});

if (ActionpadWidget && ActionpadWidget.prototype) {
    patch(ActionpadWidget.prototype, {
        async onClickOrderButton() {
            const order = this.currentOrder || (this.pos && this.pos.get_order && this.pos.get_order());
            await doSendOrderToKitchenAndReturnToTables(this.pos, order);
        },

        async sendOrderAndReturnToTables() {
            const order = this.currentOrder || (this.pos && this.pos.get_order && this.pos.get_order());
            await doSendOrderToKitchenAndReturnToTables(this.pos, order);
        },
    });
}
