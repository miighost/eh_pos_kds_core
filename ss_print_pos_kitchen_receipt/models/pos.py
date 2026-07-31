# -*- coding: utf-8 -*-

from odoo import models, fields, api


class PosConfig(models.Model):
    _inherit = 'pos.config'

    kitchen_print = fields.Boolean(string='Enable kitchen receipt Printing Button', default=False)
    kitchen_print_auto = fields.Boolean(string='Automatic kitchen receipt Printing', default=False)

    @api.onchange('module_pos_restaurant')
    def _onchange_module_pos_restaurant(self):
        if not self.module_pos_restaurant:
            self.update({'kitchen_print_auto': False, 'kitchen_print': False})

    @api.onchange('is_order_printer')
    def _onchange_is_order_printer(self):
        if not self.is_order_printer:
            self.update({'kitchen_print': False})

    @api.model
    def _load_pos_data_read(self, records, config):
        data = super()._load_pos_data_read(records, config)
        if data:
            data[0].update({
                'kitchen_print': config.kitchen_print,
                'kitchen_print_auto': config.kitchen_print_auto,
            })
        return data


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    kitchen_print = fields.Boolean(related='pos_config_id.kitchen_print', readonly=False)
    kitchen_print_auto = fields.Boolean(related='pos_config_id.kitchen_print_auto', readonly=False)

    @api.onchange('pos_module_pos_restaurant')
    def _onchange_pos_module_pos_restaurant(self):
        if not self.pos_module_pos_restaurant:
            self.update({'kitchen_print_auto': False, 'kitchen_print': False})

    @api.onchange('pos_is_order_printer')
    def _onchange_pos_is_order_printer(self):
        if not self.pos_is_order_printer:
            self.update({'kitchen_print': False})
