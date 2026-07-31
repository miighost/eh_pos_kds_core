/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { KitchenReceiptComponent } from "./KitchenReceiptComponent";
import { exportForKitchenPrinting } from "./utils";

async function doPrintKitchenReceipt(posStore, currentOrder) {
    const pos = posStore;
    if (!pos) {
        return;
    }
    const order = currentOrder || pos.get_order();
    if (!order) {
        return;
    }
    const lines = order.getOrderlines ? order.getOrderlines() : (order.orderlines || []);
    if (lines.length === 0) {
        return;
    }

    const kitchenData = exportForKitchenPrinting(pos, order);
    await pos.printer.print(
        KitchenReceiptComponent,
        { data: kitchenData },
        { webPrintFallback: true }
    );

    // Save line.printed_qty on each orderline so future additions are tracked precisely
    for (const line of lines) {
        const qtyNum = line.get_quantity ? line.get_quantity() : (line.quantity || line.qty || 1);
        line.printed_qty = qtyNum;
    }
    order.was_kot_printed = true;

    if (pos.sendOrderInPreparation) {
        try {
            await pos.sendOrderInPreparation(order);
        } catch (_e) {
            // ignore if not configured
        }
    }
}

patch(ProductScreen.prototype, {
    setup() {
        super.setup();
        if (this.pos && !this.pos.printKitchenReceipt) {
            this.pos.printKitchenReceipt = (order) =>
                doPrintKitchenReceipt(this.pos, order || this.currentOrder || this.pos.get_order());
        }
    },

    async printKitchenReceipt() {
        const order = this.currentOrder || this.pos?.get_order();
        await doPrintKitchenReceipt(this.pos, order);
    },
});
