/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/url', 'N/ui/message'], (currentRecord, url, message) => {
    const SUITELET_SCRIPT_ID = 'customscript_bc_sl_aia_form';
    const SUITELET_DEPLOYMENT_ID = 'customdeploy_bc_sl_aia_form';

    let activeMessage;
    let isProcessing = false;

    const pageInit = () => {};

    const printAiaForm = () => {
        if (isProcessing) {
            showStatus({
                type: message.Type.INFORMATION,
                title: 'AIA Form',
                messageText: 'AIA form is already being generated...',
                duration: 5000
            });
            return;
        }

        try {
            const rec = currentRecord.get();
            const recordId = rec && rec.id;

            if (!recordId) {
                showStatus({
                    type: message.Type.ERROR,
                    title: 'AIA Form',
                    messageText: 'Unable to create AIA form because the record ID is missing.',
                    duration: 8000
                });
                return;
            }

            isProcessing = true;
            showStatus({
                type: message.Type.INFORMATION,
                title: 'AIA Form',
                messageText: 'Generating AIA form and saving it to this invoice...',
                duration: 15000
            });

            const suiteletUrl = url.resolveScript({
                scriptId: SUITELET_SCRIPT_ID,
                deploymentId: SUITELET_DEPLOYMENT_ID,
                params: {
                    recordid: recordId,
                    action: 'save'
                }
            });

            callSuitelet(suiteletUrl, handleSuiteletSuccess, handleSuiteletFailure);
        } catch (e) {
            isProcessing = false;
            showError(e);
        }
    };

    const callSuitelet = (suiteletUrl, successCallback, failureCallback) => {
        const xhr = new XMLHttpRequest();

        xhr.open('GET', suiteletUrl, true);
        xhr.setRequestHeader('Accept', 'application/json');

        xhr.onreadystatechange = () => {
            if (xhr.readyState !== 4) {
                return;
            }

            isProcessing = false;

            if (xhr.status < 200 || xhr.status >= 300) {
                failureCallback('Suitelet request failed with status ' + xhr.status + '.');
                return;
            }

            try {
                const payload = JSON.parse(xhr.responseText || '{}');
                if (!payload.success) {
                    failureCallback(payload.error || payload.message || 'AIA form generation failed.');
                    return;
                }

                successCallback(payload);
            } catch (e) {
                failureCallback('Suitelet returned an invalid response: ' + (xhr.responseText || '').slice(0, 300));
            }
        };

        xhr.onerror = () => {
            isProcessing = false;
            failureCallback('Unable to call AIA Suitelet.');
        };

        xhr.send();
    };

    const handleSuiteletSuccess = (payload) => {
        showStatus({
            type: message.Type.CONFIRMATION,
            title: 'AIA Form',
            messageText: 'AIA form saved on this invoice.',
            duration: 6000
        });

        window.setTimeout(() => {
            window.location.reload();
        }, 1500);
    };

    const handleSuiteletFailure = (errorMessage) => {
        showStatus({
            type: message.Type.ERROR,
            title: 'AIA Form Error',
            messageText: errorMessage,
            duration: 10000
        });
    };

    const showError = (e) => {
        showStatus({
            type: message.Type.ERROR,
            title: 'AIA Form Error',
            messageText: e && e.message ? e.message : String(e),
            duration: 10000
        });
    };

    const showStatus = (options) => {
        if (activeMessage) {
            activeMessage.hide();
        }

        activeMessage = message.create({
            type: options.type,
            title: options.title,
            message: options.messageText
        });

        activeMessage.show({
            duration: options.duration
        });
    };

    return {
        pageInit,
        printAiaForm
    };
});
