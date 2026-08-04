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
        if hasattr(self, 'is_order_printer') and not getattr(self, 'is_order_printer', False):
            self.kitchen_print = False

    def _loader_params_pos_config(self):
        parent_func = getattr(super(PosConfig, self), '_loader_params_pos_config', None)
        if parent_func:
            result = parent_func()
            if isinstance(result, dict) and 'search_params' in result:
                fields_list = result['search_params'].setdefault('fields', [])
                if 'kitchen_print' not in fields_list:
                    fields_list.append('kitchen_print')
                if 'kitchen_print_auto' not in fields_list:
                    fields_list.append('kitchen_print_auto')
            return result
        return {'search_params': {'fields': ['kitchen_print', 'kitchen_print_auto']}}

    def _load_pos_data_fields(self, config_id):
        parent_func = getattr(super(PosConfig, self), '_load_pos_data_fields', None)
        fields_list = list(parent_func(config_id)) if parent_func else []
        if 'kitchen_print' not in fields_list:
            fields_list.append('kitchen_print')
        if 'kitchen_print_auto' not in fields_list:
            fields_list.append('kitchen_print_auto')
        return fields_list



class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    kitchen_print = fields.Boolean(related='pos_config_id.kitchen_print', readonly=False)
    kitchen_print_auto = fields.Boolean(related='pos_config_id.kitchen_print_auto', readonly=False)

    @api.onchange('pos_module_pos_restaurant')
    def _onchange_pos_module_pos_restaurant(self):
        if hasattr(self, 'pos_module_pos_restaurant') and not getattr(self, 'pos_module_pos_restaurant', False):
            self.kitchen_print_auto = False
            self.kitchen_print = False

    @api.onchange('pos_is_order_printer')
    def _onchange_pos_is_order_printer(self):
        if hasattr(self, 'pos_is_order_printer') and not getattr(self, 'pos_is_order_printer', False):
            self.kitchen_print = False


