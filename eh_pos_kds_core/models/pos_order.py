import logging

from odoo import models

_logger = logging.getLogger(__name__)

PAID_STATES = ("paid", "done", "invoiced")


class PosOrder(models.Model):
    """Intake seam from POS into the kitchen.

    When an order reaches a paid state it is routed to the matching boards. The
    intake diffs the order lines against what the kitchen already knows, keyed by
    the order line uuid, so re syncs never duplicate and removed quantity is
    absorbed and voided rather than deleted.
    """

    _inherit = "pos.order"

    def _process_order(self, order, existing_order):
        order_id = super()._process_order(order, existing_order)
        pos_order = self.env["pos.order"].browse(order_id)
        if pos_order and pos_order.state in PAID_STATES:
            try:
                pos_order.sudo()._eh_kds_intake()
            except Exception:
                # A kitchen routing problem must never block a sale.
                _logger.exception("eh_pos_kds: intake failed for pos.order %s", order_id)
        return order_id

    def _eh_kds_ref(self):
        self.ensure_one()
        return self.tracking_number or self.pos_reference or self.name or str(self.id)

    # -- extension seams (used by the restaurant and self-order add-ons) ------

    def _eh_kds_routable_lines(self):
        """Lines that should be routed to the kitchen. Default: all lines.
        The restaurant add-on narrows this to lines whose course is fired.
        """
        self.ensure_one()
        return self.lines

    def _eh_kds_ticket_vals(self):
        """Extra values for the ticket on create (e.g. the restaurant table)."""
        return {}

    def _eh_kds_item_vals(self, line):
        """Extra values for a ticket item on create (e.g. the course)."""
        return {}

    def _eh_kds_intake(self, options=None):
        """Route this order's new and removed lines to the kitchen boards."""
        self.ensure_one()
        Board = self.env["eh.kds.board"].sudo()
        Ticket = self.env["eh.kds.ticket"].sudo()
        Item = self.env["eh.kds.ticket.item"].sudo()
        Card = self.env["eh.kds.card"].sudo()

        if not Board.search_count([("active", "=", True)]):
            return Ticket

        ticket = Ticket.search([("pos_order_id", "=", self.id)], limit=1)
        if not ticket:
            ticket = Ticket.create(
                dict({"pos_order_id": self.id, "ticket_ref": self._eh_kds_ref()}, **self._eh_kds_ticket_vals())
            )

        touched = self.env["eh.kds.board"].sudo()
        for line in self._eh_kds_routable_lines():
            item = ticket.item_ids.filtered(lambda i, line=line: i.pos_order_line_uuid == line.uuid)[:1]
            known = (item.quantity - item.cancelled) if item else 0.0
            delta = line.qty - known
            if delta > 0:
                attr_value_ids = line.product_id.product_template_attribute_value_ids.ids
                if not item:
                    item = Item.create(
                        dict(
                            {
                                "ticket_id": ticket.id,
                                "product_id": line.product_id.id,
                                "quantity": line.qty,
                                "pos_order_line_id": line.id,
                                "pos_order_line_uuid": line.uuid,
                                "customer_note": line.customer_note or False,
                                "note": line.note or False,
                                "attribute_value_ids": [(6, 0, attr_value_ids)],
                            },
                            **self._eh_kds_item_vals(line),
                        )
                    )
                    for board, lane in Board._route_item(self.config_id, line.product_id, attr_value_ids):
                        card = Card.create({"item_id": item.id, "lane_id": lane.id})
                        card._log("placed", to_lane=lane, push=False)
                        touched |= board
                else:
                    item.quantity = line.qty
            elif delta < 0 and item:
                absorbed = min(item.quantity, item.cancelled - delta)
                item.cancelled = absorbed
                for card in item.card_ids.filtered(lambda c: c.status != "voided"):
                    card._log("voided", push=False)
                    touched |= card.board_id

        for board in touched:
            board._kds_push(
                board.access_token,
                "kds.ticket",
                {"ticket_id": ticket.id, "ticket_ref": ticket.ticket_ref, "event": "intake"},
            )
            board._kds_push(board.access_token, "kds.status", {"ticket_ref": ticket.ticket_ref})
        return ticket
