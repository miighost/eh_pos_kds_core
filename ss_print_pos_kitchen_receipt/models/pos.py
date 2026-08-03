# -*- coding: utf-8 -*-

from odoo import models, fields, api


class PosConfig(models.Model):
    _inherit = 'pos.config'

    kitchen_print = fields.Boolean(string='Enable kitchen receipt Printing Button', default=True)
    kitchen_print_auto = fields.Boolean(string='Automatic kitchen receipt Printing', default=False)

    @api.onchange('module_pos_restaurant')
    def _onchange_module_pos_restaurant(self):
        if not getattr(self, 'module_pos_restaurant', False):
            self.kitchen_print_auto = False
            self.kitchen_print = False

    @api.onchange('is_order_printer')
    def _onchange_is_order_printer(self):
        if hasattr(self, 'is_order_printer') and not self.is_order_printer:
            self.kitchen_print = False

    def _loader_params_pos_config(self):
        result = super()._loader_params_pos_config() if hasattr(super(), '_loader_params_pos_config') else {'search_params': {'fields': []}}
        if 'search_params' in result and 'fields' in result['search_params']:
            fields_list = result['search_params']['fields']
            if 'kitchen_print' not in fields_list:
                fields_list.append('kitchen_print')
            if 'kitchen_print_auto' not in fields_list:
                fields_list.append('kitchen_print_auto')
        return result

    @api.model
    def _load_pos_data_read(self, records=None, config=None, *args, **kwargs):
        try:
            data = super()._load_pos_data_read(records, config, *args, **kwargs) if hasattr(super(), '_load_pos_data_read') else []
        except Exception:
            data = []

        if data and isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            cfg = config or (records[:1] if records else False)
            if cfg:
                data[0].update({
                    'kitchen_print': getattr(cfg, 'kitchen_print', True),
                    'kitchen_print_auto': getattr(cfg, 'kitchen_print_auto', False),
                })
        return data


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    kitchen_print = fields.Boolean(related='pos_config_id.kitchen_print', readonly=False)
    kitchen_print_auto = fields.Boolean(related='pos_config_id.kitchen_print_auto', readonly=False)

    @api.onchange('pos_module_pos_restaurant')
    def _onchange_pos_module_pos_restaurant(self):
        if hasattr(self, 'pos_module_pos_restaurant') and not self.pos_module_pos_restaurant:
            self.kitchen_print_auto = False
            self.kitchen_print = False

    @api.onchange('pos_is_order_printer')
    def _onchange_pos_is_order_printer(self):
        if hasattr(self, 'pos_is_order_printer') and not self.pos_is_order_printer:
            self.kitchen_print = False
