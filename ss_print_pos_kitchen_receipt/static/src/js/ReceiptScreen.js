/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { ReceiptScreen } from "@point_of_sale/app/screens/receipt_screen/receipt_screen";
import { onMounted, useState } from "@odoo/owl";
import { KitchenReceiptComponent } from "./KitchenReceiptComponent";
import { exportForKitchenPrinting } from "./utils";

patch(ReceiptScreen.prototype, {
    setup() {
        super.setup();
        this.kitchenPrintState = useState({
            printedChanges: false,
        });

        onMounted(() => {
            if (this.pos.config.kitchen_print_auto) {
                this.printKitchenChanges();
            }
        });
    },

    async printReceiptAndKitchen() {
        await this.doFullPrint.call();
        await this.printKitchenChanges();
    },

    async printKitchenChanges() {
        if (!this.kitchenPrintState.printedChanges) {
            await this.pos.sendOrderInPreparation(this.currentOrder);
            this.kitchenPrintState.printedChanges = true;
        }
    },

    async printKitchenReceipt() {
        const kitchenData = exportForKitchenPrinting(this.pos, this.currentOrder);
        await this.pos.printer.print(
            KitchenReceiptComponent,
            { data: kitchenData },
            { webPrintFallback: true }
        );
    },

    _exportForKitchenPrinting(order) {
        return exportForKitchenPrinting(this.pos, order);
    },

    hasKitchenChanges() {
        const changes = this.pos.getOrderChanges(this.currentOrder);
        return Boolean(
            changes.nbrOfChanges ||
                Object.keys(changes.noteUpdate).length ||
                changes.general_customer_note ||
                changes.internal_note
        );
    },
});
