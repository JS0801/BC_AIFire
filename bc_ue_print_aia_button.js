/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record'], (log, record) => {
    const OLD_BUTTON_ID = 'custpage_print_aia_forms';
    const NEW_BUTTON_ID = 'custpage_bc_print_aia_form';
    const CLIENT_SCRIPT_MODULE_PATH = './bc_cs_print_aia_button.js';

    const beforeLoad = (context) => {
        try {
            const form = context.form;
            const currentRecord = context.newRecord;

            if (!form || !currentRecord || !currentRecord.id) {
                return;
            }

            hideOldButton(form);

            if (context.type !== context.UserEventType.VIEW) {
                return;
            }

            form.clientScriptModulePath = CLIENT_SCRIPT_MODULE_PATH;
            var created = currentRecord.getValue('custbody_bc_g702_g703_group_pdf');

            var button_Name = created? 'Re-Print AIA Form' : 'Print AIA Form';
            

            form.addButton({
                id: NEW_BUTTON_ID,
                label: button_Name,
                functionName: 'printAiaForm'
            });

            log.debug('AIA Print Button Added', {
                recordType: currentRecord.type,
                recordId: currentRecord.id,
                buttonId: NEW_BUTTON_ID,
                clientScriptModulePath: CLIENT_SCRIPT_MODULE_PATH
            });
        } catch (e) {
            log.error('AIA Print Button beforeLoad Error', {
                message: e && e.message ? e.message : String(e),
                stack: e && e.stack ? e.stack : ''
            });
        }
    };

    const hideOldButton = (form) => {
        try {
            form.removeButton({
                id: OLD_BUTTON_ID
            });

            log.debug('Old AIA Print Button Hidden', {
                buttonId: OLD_BUTTON_ID
            });
        } catch (e) {
            log.debug('Old AIA Print Button Not Present', {
                buttonId: OLD_BUTTON_ID,
                message: e && e.message ? e.message : String(e)
            });
        }
    };

    return {
        beforeLoad
    };
});
