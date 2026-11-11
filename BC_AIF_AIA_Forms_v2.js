/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/file', 'N/record', 'N/render', 'N/search', 'N/log'],
    function (file, record, render, search, log) {

        const TEMPLATE_FILE_ID = 20436;
        const SAVE_PDF_ACTION = 'save';
        const AIA_PDF_FIELD_ID = 'custbody_bc_g702_g703_group_pdf';

        function onRequest(context) {
            if (context.request.method !== 'GET') {
                context.response.write('Unsupported request method.');
                return;
            }

            const request = context.request;
            const response = context.response;
            const recId = safeString(request.parameters.recordid || request.parameters.id);
            const action = safeString(request.parameters.action);

            try {
                if (!recId) {
                    throw new Error('Missing required parameter: recordid');
                }

                log.audit('AIA Suitelet Start', { invoiceId: recId });

                const invoiceRec = record.load({
                    type: record.Type.INVOICE,
                    id: recId
                });

                const subsidiaryId = safeString(getValue(invoiceRec, 'subsidiary'));
                const projectId = safeString(getValue(invoiceRec, 'cseg_bc_project'));
                const createdFromId = safeString(getValue(invoiceRec, 'createdfrom'));

                if (!subsidiaryId) {
                    throw new Error('Invoice is missing Subsidiary.');
                }
                if (!projectId) {
                    throw new Error('Invoice is missing BlueCollar Project.');
                }
                if (!createdFromId) {
                    throw new Error('Invoice is missing Created From Sales Order.');
                }

                const subRec = record.load({
                    type: 'subsidiary',
                    id: subsidiaryId
                });
                const projRec = record.load({
                    type: 'customrecord_cseg_bc_project',
                    id: projectId
                });

                const periodTo = formatDateForNetSuite(getValue(invoiceRec, 'enddate') || getValue(invoiceRec, 'trandate'));
                const transDate = formatDateForNetSuite(getValue(invoiceRec, 'trandate'));
                const applicationNumber = safeString(getValue(invoiceRec, 'custbody_bc_pay_app_number'));

                log.debug('AIA Header Context', {
                    invoiceId: recId,
                    subsidiaryId: subsidiaryId,
                    projectId: projectId,
                    createdFromId: createdFromId,
                    applicationNumber: applicationNumber,
                    periodTo: periodTo
                });

                const htmlFile = file.load({ id: TEMPLATE_FILE_ID });
                let html = normalizeTemplateXml(htmlFile.getContents());

                const searchObj = buildMemoObject({
                    createdFromId: createdFromId,
                    recId: recId,
                    periodTo: periodTo,
                    projectId: projectId
                });

                const fromContractor = [
                    escapeXml(getValue(subRec, 'name')),
                    escapeXmlWithBreaks(getValue(subRec, 'mainaddress_text'))
                ].filter(Boolean).join('<br/>');
                const subscribedText = getText(invoiceRec, 'custbody_bc_aia_subscribed');
                const subscribedDateParts = getMonthYearParts(subscribedText);
                const projectAddressHtml = getProjectAddressHtml(projectId, invoiceRec);

                html = applyPlaceholders(html, {
                    TOOWNER: escapeXmlWithBreaks(getValue(invoiceRec, 'billaddress')),
                    tranid: escapeXmlWithBreaks(getValue(invoiceRec, 'tranid')),
                    FROMCONTRACTOR: fromContractor,
                    PROJECT: escapeXml(getText(invoiceRec, 'cseg_bc_project')),
                    CONTRACTADDRESS: projectAddressHtml,
                    VIAARCHITECT: '',
                    applicationNumber: escapeXml(applicationNumber),
                    applicationDate: escapeXml(transDate),
                    periodTo: escapeXml(periodTo),
                    DATE: escapeXml(transDate),
                    projectNumber: escapeXml(getValue(projRec, 'custrecord_bc_proj_number')),
                    contractFor: escapeXml(getValue(projRec, 'name')),
                    architectsProjectNumber: escapeXml(getValue(projRec, 'custrecord_bc_proj_number')),
                    contractDate: escapeXml(formatDateForNetSuite(getValue(projRec, 'custrecordbc_proj_contract_date'))),
                    CONTRACTOR: escapeXml(getText(invoiceRec, 'subsidiary')),
                    BY: escapeXml(getText(invoiceRec, 'custbody_bc_aia_by')),
                    STATEOF: escapeXml(getText(invoiceRec, 'custbody_bc_aia_stateof')),
                    COUNTYOF: escapeXml(getValue(invoiceRec, 'custbody_bc_aia_countyof')),
                    SUBSCRIBED: escapeXml(subscribedText),
                    'DAY OF': escapeXml(getValue(invoiceRec, 'custbody_bc_aia_day_of')),
                    DAYOF: escapeXml(getValue(invoiceRec, 'custbody_bc_aia_day_of')),
                    MONTH: escapeXml(subscribedDateParts.month),
                    YEAR: escapeXml(subscribedDateParts.year),
                    NOTARYPUB: escapeXml(getValue(invoiceRec, 'custbody_bc_aia_notary_public')),
                    NOTARYPUBLIC: escapeXml(getValue(invoiceRec, 'custbody_bc_aia_notary_public')),
                    MCE: '',
                    ARCHITECTBY: '',
                    ARCHITECTDATE: '',

                    OCS: formatNumber(searchObj.TotalObj.OCS),
                    NCBCO: formatNumber(searchObj.TotalObj.NCBCO),
                    CSTD: formatNumber(searchObj.TotalObj.CSTD),
                    TCASTD: formatNumber(searchObj.TotalObj.TCASTD),
                    POSM: formatNumber(searchObj.TotalObj.POSM),
                    SM: formatNumber(searchObj.TotalObj.SM),
                    POCW: formatNumber(searchObj.TotalObj.POCW),
                    CW: formatNumber(searchObj.TotalObj.CW),
                    TELR: formatNumber(searchObj.TotalObj.TELR),
                    LPCFP: formatNumber(searchObj.TotalObj.LPCFP),
                    CPD: formatNumber(searchObj.TotalObj.CPD),
                    AC: formatNumber(searchObj.TotalObj.CPD),
                    BTFIR: formatNumber(searchObj.TotalObj.BTFIR),

                    TCAa: formatNumber(searchObj.ChangeObj.TCAa),
                    TCAd: formatNumber(searchObj.ChangeObj.TCAd),
                    TATMa: formatNumber(searchObj.ChangeObj.TATMa),
                    TATMd: formatNumber(searchObj.ChangeObj.TATMd),
                    TOTALa: formatNumber(searchObj.ChangeObj.TOTALa),
                    TOTALd: formatNumber(searchObj.ChangeObj.TOTALd),
                    NCBCOT: formatNumber(searchObj.ChangeObj.NCBCOT),

                    'totals.scheduledValue': formatNumber(searchObj.TotalObj.soNewAmount),
                    'totals.workCompletedFromPreviousApplication': formatNumber(searchObj.TotalObj.totalInvoiceTotal - searchObj.TotalObj.currentInvoiceTotal),
                    'totals.workCompletedThisPeriod': formatNumber(searchObj.TotalObj.currentInvoiceTotal),
                    'totals.materialsPresentlyStored': formatNumber(0),
                    'totals.totalCompletedAndStoredToDate': formatNumber(searchObj.TotalObj.totalInvoiceTotal),
                    'totals.percent': formatNumber(searchObj.TotalObj.totalPercentTotal),
                    'totals.balanceToFinish': formatNumber(searchObj.TotalObj.BTFIR1),
                    'totals.retainage': formatNumber(searchObj.TotalObj.totalInvoiceRetention)
                });

                html = html.replace('<!-- ROWS GO HERE -->', buildContinuationRows(searchObj));
                const unresolvedPlaceholders = findUnresolvedPlaceholders(html);
                if (unresolvedPlaceholders.length) {
                    log.debug('AIA Unresolved Placeholders Removed', {
                        count: unresolvedPlaceholders.length,
                        placeholders: unresolvedPlaceholders.slice(0, 50)
                    });
                }
                html = removeUnresolvedPlaceholders(html);

                log.audit('AIA Suitelet Totals', {
                    invoiceId: recId,
                    scheduledValue: searchObj.TotalObj.soNewAmount,
                    completedToDate: searchObj.TotalObj.TCASTD,
                    retainage: searchObj.TotalObj.CW,
                    retainagePercent: searchObj.TotalObj.POCW,
                    earnedLessRetainage: searchObj.TotalObj.TELR,
                    currentPaymentDue: searchObj.TotalObj.CPD
                });

                const pdfFile = render.xmlToPdf({ xmlString: html });

                if (action === SAVE_PDF_ACTION) {
                    const fileId = savePdfAndUpdateInvoice({
                        pdfFile: pdfFile,
                        templateFile: htmlFile,
                        invoiceRec: invoiceRec,
                        invoiceId: recId,
                        projectName: getText(invoiceRec, 'cseg_bc_project')
                    });

                    writeJson(response, {
                        success: true,
                        invoiceId: recId,
                        fileId: fileId,
                        fieldId: AIA_PDF_FIELD_ID,
                        message: 'AIA form generated and saved on the invoice.'
                    });
                    return;
                }

                response.writeFile({
                    file: pdfFile,
                    isInline: true
                });
            } catch (e) {
                log.error('AIA Suitelet Error', {
                    invoiceId: recId,
                    message: e && e.message ? e.message : safeString(e),
                    stack: e && e.stack ? e.stack : ''
                });

                if (action === SAVE_PDF_ACTION) {
                    writeJson(response, {
                        success: false,
                        invoiceId: recId,
                        error: e && e.message ? e.message : safeString(e)
                    });
                    return;
                }

                response.write('An error occurred: ' + (e && e.message ? e.message : safeString(e)));
            }
        }

        function buildContinuationRows(searchObj) {
            let dynamicRows = '';
            let lineCount = 0;

            Object.keys(searchObj).forEach(function (memoKey) {
                if (memoKey === 'TotalObj' || memoKey === 'ChangeObj') {
                    return;
                }

                lineCount++;
                const row = searchObj[memoKey];
                const totalInvoiceTotal = toNumber(row.totalInvoiceTotal);
                const currentInvoiceTotal = toNumber(row.currentInvoiceTotal);
                const scheduledValue = toNumber(row.soNewAmount);

                dynamicRows += `
            <tr line-height="100%">
            <td align="center" style="width: 5%; font-size:11px; padding-top:7px; border-right: 1px solid black;">${lineCount}</td>
            <td align="left" style="width: 20%; font-size:11px; padding-top:7px; border-right: 1px solid black;">${escapeXml(row.memo)}</td>
            <td align="right" style="width: 10%; font-size:11px; padding-top:7px; border-right: 1px solid black;">${formatNumber(scheduledValue)}</td>
            <td align="right" style="width: 10%; font-size:11px; padding-top:7px; border-right: 1px solid black;">${formatNumber(totalInvoiceTotal - currentInvoiceTotal)}</td>
            <td align="right" style="width: 10%; font-size:11px; padding-top:7px; border-right: 1px solid black;">${formatNumber(currentInvoiceTotal)}</td>
            <td align="right" style="width: 10%; font-size:11px; padding-top:7px; border-right: 1px solid black;">0.00</td>
            <td align="right" style="width: 10%; font-size:11px; padding-top:7px; border-right: 1px solid black;">${formatNumber(totalInvoiceTotal)}</td>
            <td align="center" style="width: 5%; font-size:11px; padding-top:7px; border-right: 1px solid black;">${formatNumber(row.totalPercent)}</td>
            <td align="right" style="width: 10%; font-size:11px; padding-top:7px; border-right: 1px solid black;">${formatNumber(scheduledValue - totalInvoiceTotal)}</td>
            <td align="right" style="width: 11%; font-size:11px; padding-top:7px;">${formatNumber(row.totalInvoiceRetention)}</td>
            </tr>
            `;
            });

            return dynamicRows;
        }

        function buildMemoObject(options) {
            const createdFromId = options.createdFromId;
            const recId = options.recId;
            const periodTo = options.periodTo;
            const projectId = options.projectId;

            const memoObj = {
                TotalObj: createTotalObj(),
                ChangeObj: createChangeObj()
            };

            let soLines = 0;
            let currentInvoiceLines = 0;
            let totalTransactionLines = 0;

            const soColumns = {
                lineNumber: search.createColumn({ name: 'custcol_bc_proj_line_num', summary: 'GROUP', sort: search.Sort.ASC }),
                memo: search.createColumn({ name: 'memo', summary: 'GROUP' }),
                amount: search.createColumn({ name: 'amount', summary: 'SUM' }),
                changeAmount: search.createColumn({
                    name: 'formulanumeric',
                    summary: 'SUM',
                    formula: '{amount} - NVL({custcol_bc_proj_org_value}, 0)'
                }),
                originalValue: search.createColumn({ name: 'custcol_bc_proj_org_value', summary: 'SUM' })
            };

            const soSearch = search.create({
                type: 'salesorder',
                settings: [{ name: 'consolidationtype', value: 'ACCTTYPE' }],
                filters: [
                    ['type', 'anyof', 'SalesOrd'],
                    'AND', ['internalid', 'anyof', createdFromId],
                    'AND', ['mainline', 'is', 'F'],
                    'AND', ['taxline', 'is', 'F'],
                    'AND', ['shipping', 'is', 'F']
                ],
                columns: [
                    soColumns.lineNumber,
                    soColumns.memo,
                    soColumns.amount,
                    soColumns.changeAmount,
                    soColumns.originalValue
                ]
            });

            soSearch.run().each(function (result) {
                const lineNumber = safeString(result.getValue(soColumns.lineNumber));
                if (!lineNumber) {
                    return true;
                }

                const line = getOrCreateLine(memoObj, lineNumber);
                line.memo = line.memo || result.getValue(soColumns.memo) || lineNumber;
                line.soOldAmount += toNumber(result.getValue(soColumns.originalValue));
                line.soChangeAmount += toNumber(result.getValue(soColumns.changeAmount));
                line.soNewAmount += toNumber(result.getValue(soColumns.amount));

                memoObj.TotalObj.OCS += toNumber(result.getValue(soColumns.originalValue));
                memoObj.TotalObj.NCBCO += toNumber(result.getValue(soColumns.changeAmount));
                memoObj.TotalObj.CSTD += toNumber(result.getValue(soColumns.amount));
                soLines++;

                return true;
            });

            log.debug('AIA SO Search Complete', {
                createdFromId: createdFromId,
                soLines: soLines,
                contractSumToDate: memoObj.TotalObj.CSTD
            });

            const currentInvoiceColumns = {
                lineNumber: search.createColumn({ name: 'custcol_bc_proj_line_num', summary: 'GROUP', sort: search.Sort.ASC }),
                memo: search.createColumn({ name: 'memo', summary: 'GROUP' }),
                amount: search.createColumn({ name: 'amount', summary: 'SUM' }),
                retention: search.createColumn({ name: 'custcol_bc_sov_unbilled_retention', summary: 'SUM' }),
                grossTotal: search.createColumn({
                    name: 'formulanumeric',
                    summary: 'SUM',
                    formula: '{amount} + NVL({custcol_bc_sov_unbilled_retention}, 0)'
                })
            };

            const currentInvoiceSearch = search.create({
                type: 'invoice',
                settings: [{ name: 'consolidationtype', value: 'ACCTTYPE' }],
                filters: [
                    ['type', 'anyof', 'CustInvc'],
                    'AND', ['cseg_bc_project', 'anyof', projectId],
                    'AND', ['internalidnumber', 'equalto', recId],
                    'AND', ['mainline', 'is', 'F'],
                    'AND', ['taxline', 'is', 'F'],
                    'AND', ['shipping', 'is', 'F'],
                    'AND', ['createdfrom', 'anyof', createdFromId],
                    'AND', ['createdfrom.mainline', 'is', 'T']
                ],
                columns: [
                    currentInvoiceColumns.lineNumber,
                    currentInvoiceColumns.memo,
                    currentInvoiceColumns.amount,
                    currentInvoiceColumns.retention,
                    currentInvoiceColumns.grossTotal
                ]
            });

            currentInvoiceSearch.run().each(function (result) {
                const lineNumber = safeString(result.getValue(currentInvoiceColumns.lineNumber));
                if (!lineNumber || !memoObj[lineNumber]) {
                    log.debug('AIA Current Invoice Line Skipped', {
                        lineNumber: lineNumber,
                        reason: !lineNumber ? 'Missing SOV line number' : 'Line number not found on source Sales Order'
                    });
                    return true;
                }

                const line = memoObj[lineNumber];
                line.currentInvoiceNetAmount += toNumber(result.getValue(currentInvoiceColumns.amount));
                line.currentInvoiceRetention += toNumber(result.getValue(currentInvoiceColumns.retention));
                line.currentInvoiceTotal += toNumber(result.getValue(currentInvoiceColumns.grossTotal));
                currentInvoiceLines++;

                return true;
            });

            log.debug('AIA Current Invoice Search Complete', {
                invoiceId: recId,
                currentInvoiceLines: currentInvoiceLines
            });

            const totalInvoiceColumns = {
                lineNumber: search.createColumn({ name: 'custcol_bc_proj_line_num', summary: 'GROUP', sort: search.Sort.ASC }),
                memo: search.createColumn({ name: 'memo', summary: 'GROUP' }),
                amount: search.createColumn({ name: 'amount', summary: 'SUM' }),
                retention: search.createColumn({ name: 'custcol_bc_sov_unbilled_retention', summary: 'SUM' }),
                transactionType: search.createColumn({ name: 'type', summary: 'GROUP' })
            };

            const totalInvoiceSearch = search.create({
                type: 'transaction',
                settings: [{ name: 'consolidationtype', value: 'ACCTTYPE' }],
                filters: [
                    ['type', 'anyof', 'CustInvc', 'CustCred'],
                    'AND', ['cseg_bc_project', 'anyof', projectId],
                    'AND', ['internalidnumber', 'notgreaterthan', recId],
                    'AND', ['mainline', 'is', 'F'],
                    'AND', ['taxline', 'is', 'F'],
                    'AND', ['shipping', 'is', 'F'],
                    'AND', [['createdfrom', 'anyof', createdFromId], 'OR', ['createdfrom.createdfrom', 'anyof', createdFromId]],
                    'AND', ['createdfrom.mainline', 'is', 'T']
                ],
                columns: [
                    totalInvoiceColumns.lineNumber,
                    totalInvoiceColumns.memo,
                    totalInvoiceColumns.amount,
                    totalInvoiceColumns.retention,
                    totalInvoiceColumns.transactionType
                ]
            });

            totalInvoiceSearch.run().each(function (result) {
                const lineNumber = safeString(result.getValue(totalInvoiceColumns.lineNumber));
                if (!lineNumber || !memoObj[lineNumber]) {
                    log.debug('AIA Total Transaction Line Skipped', {
                        lineNumber: lineNumber,
                        reason: !lineNumber ? 'Missing SOV line number' : 'Line number not found on source Sales Order'
                    });
                    return true;
                }

                const transactionType = safeString(result.getValue(totalInvoiceColumns.transactionType));
                const line = memoObj[lineNumber];
                const rawAmount = toNumber(result.getValue(totalInvoiceColumns.amount));
                const rawRetention = toNumber(result.getValue(totalInvoiceColumns.retention));
                const signedAmount = transactionType === 'CustCred' && rawAmount > 0 ? -rawAmount : rawAmount;
                const signedRetention = transactionType === 'CustCred' ? -Math.abs(rawRetention) : rawRetention;

                line.totalInvoiceNetAmount += signedAmount;
                line.totalInvoiceRetention += signedRetention;
                line.totalInvoiceTotal += signedAmount + signedRetention;
                line.totalPercent = safePercent(line.totalInvoiceTotal, line.soNewAmount);
                totalTransactionLines++;

                return true;
            });

            Object.keys(memoObj).forEach(function (memoKey) {
                if (memoKey === 'TotalObj' || memoKey === 'ChangeObj') {
                    return;
                }

                const line = memoObj[memoKey];
                memoObj.TotalObj.soOldAmount += line.soOldAmount;
                memoObj.TotalObj.soChangeAmount += line.soChangeAmount;
                memoObj.TotalObj.soNewAmount += line.soNewAmount;
                memoObj.TotalObj.currentInvoiceNetAmount += line.currentInvoiceNetAmount;
                memoObj.TotalObj.currentInvoiceRetention += line.currentInvoiceRetention;
                memoObj.TotalObj.currentInvoiceTotal += line.currentInvoiceTotal;
                memoObj.TotalObj.totalInvoiceNetAmount += line.totalInvoiceNetAmount;
                memoObj.TotalObj.totalInvoiceRetention += line.totalInvoiceRetention;
                memoObj.TotalObj.totalInvoiceTotal += line.totalInvoiceTotal;
                memoObj.TotalObj.TCASTD += line.totalInvoiceTotal;
            });

            memoObj.TotalObj.totalPercentTotal = safePercent(memoObj.TotalObj.totalInvoiceTotal, memoObj.TotalObj.soNewAmount);
            memoObj.TotalObj.CW = memoObj.TotalObj.totalInvoiceRetention;
            memoObj.TotalObj.POCW = safePercent(memoObj.TotalObj.CW, memoObj.TotalObj.TCASTD);
            memoObj.TotalObj.TELR = memoObj.TotalObj.totalInvoiceNetAmount;
            memoObj.TotalObj.LPCFP = memoObj.TotalObj.totalInvoiceNetAmount - memoObj.TotalObj.currentInvoiceNetAmount;
            memoObj.TotalObj.CPD = memoObj.TotalObj.currentInvoiceNetAmount;
            memoObj.TotalObj.BTFIR = memoObj.TotalObj.CSTD - memoObj.TotalObj.TELR;
            memoObj.TotalObj.BTFIR1 = memoObj.TotalObj.CSTD - memoObj.TotalObj.TCASTD;

            memoObj.ChangeObj = buildChangeObject(createdFromId, periodTo);

            log.audit('AIA Calculation Complete', {
                createdFromId: createdFromId,
                invoiceId: recId,
                soLines: soLines,
                currentInvoiceLines: currentInvoiceLines,
                totalTransactionLines: totalTransactionLines,
                totals: memoObj.TotalObj,
                changeTotals: memoObj.ChangeObj
            });

            return memoObj;
        }

        function buildChangeObject(createdFromId, periodTo) {
            const changeObj = createChangeObj();
            if (!periodTo) {
                log.debug('AIA Change Search Skipped', 'Period To is blank.');
                return changeObj;
            }

            const currDate = new Date(periodTo);
            if (isNaN(currDate.getTime())) {
                log.debug('AIA Change Search Skipped', 'Period To is not a valid date: ' + periodTo);
                return changeObj;
            }

            const currMonthStartStr = formatDateForNetSuite(new Date(currDate.getFullYear(), currDate.getMonth(), 1));
            const prevMonthEndStr = formatDateForNetSuite(new Date(currDate.getFullYear(), currDate.getMonth(), 0));

            const changeColumns = {
                prevMonthAdd: search.createColumn({
                    name: 'formulanumeric',
                    summary: 'SUM',
                    formula: "CASE WHEN {custrecord_bc_amount} > 0 AND {custrecord_bc_parent_request.custrecord_bc_approved_on} <= TO_DATE('" + prevMonthEndStr + "','MM/DD/YYYY') THEN {custrecord_bc_amount} ELSE 0 END",
                    label: 'Prev Month Add'
                }),
                prevMonthDeduct: search.createColumn({
                    name: 'formulanumeric',
                    summary: 'SUM',
                    formula: "CASE WHEN {custrecord_bc_amount} < 0 AND {custrecord_bc_parent_request.custrecord_bc_approved_on} <= TO_DATE('" + prevMonthEndStr + "','MM/DD/YYYY') THEN {custrecord_bc_amount} ELSE 0 END",
                    label: 'Prev Month Deduct'
                }),
                thisMonthAdd: search.createColumn({
                    name: 'formulanumeric',
                    summary: 'SUM',
                    formula: "CASE WHEN {custrecord_bc_amount} > 0 AND {custrecord_bc_parent_request.custrecord_bc_approved_on} BETWEEN TO_DATE('" + currMonthStartStr + "','MM/DD/YYYY') AND TO_DATE('" + periodTo + "','MM/DD/YYYY') THEN {custrecord_bc_amount} ELSE 0 END",
                    label: 'This Month Add'
                }),
                thisMonthDeduct: search.createColumn({
                    name: 'formulanumeric',
                    summary: 'SUM',
                    formula: "CASE WHEN {custrecord_bc_amount} < 0 AND {custrecord_bc_parent_request.custrecord_bc_approved_on} BETWEEN TO_DATE('" + currMonthStartStr + "','MM/DD/YYYY') AND TO_DATE('" + periodTo + "','MM/DD/YYYY') THEN {custrecord_bc_amount} ELSE 0 END",
                    label: 'This Month Deduct'
                })
            };

            const changeSearch = search.create({
                type: 'customrecord_bc_change_req_billing_item',
                filters: [
                    ['custrecord_bc_related_transaction', 'anyof', createdFromId],
                    'AND',
                    ['custrecord_bc_chg_request_item_status', 'anyof', '1']
                ],
                columns: [
                    changeColumns.prevMonthAdd,
                    changeColumns.prevMonthDeduct,
                    changeColumns.thisMonthAdd,
                    changeColumns.thisMonthDeduct
                ]
            });

            changeSearch.run().each(function (result) {
                changeObj.TCAa = toNumber(result.getValue(changeColumns.prevMonthAdd));
                changeObj.TCAd = Math.abs(toNumber(result.getValue(changeColumns.prevMonthDeduct)));
                changeObj.TATMa = toNumber(result.getValue(changeColumns.thisMonthAdd));
                changeObj.TATMd = Math.abs(toNumber(result.getValue(changeColumns.thisMonthDeduct)));
                changeObj.TOTALa = changeObj.TCAa + changeObj.TATMa;
                changeObj.TOTALd = changeObj.TCAd + changeObj.TATMd;
                changeObj.NCBCOT = changeObj.TOTALa - changeObj.TOTALd;

                return true;
            });

            log.debug('AIA Change Search Complete', changeObj);
            return changeObj;
        }

        function getOrCreateLine(memoObj, lineNumber) {
            memoObj[lineNumber] = memoObj[lineNumber] || {
                memo: '',
                soOldAmount: 0,
                soChangeAmount: 0,
                soNewAmount: 0,
                currentInvoiceNetAmount: 0,
                currentInvoiceRetention: 0,
                currentInvoiceTotal: 0,
                totalInvoiceNetAmount: 0,
                totalInvoiceRetention: 0,
                totalInvoiceTotal: 0,
                totalPercent: 0
            };
            return memoObj[lineNumber];
        }

        function createTotalObj() {
            return {
                OCS: 0,
                NCBCO: 0,
                CSTD: 0,
                TCASTD: 0,
                POSM: 0,
                SM: 0,
                soOldAmount: 0,
                soChangeAmount: 0,
                soNewAmount: 0,
                currentInvoiceNetAmount: 0,
                currentInvoiceRetention: 0,
                currentInvoiceTotal: 0,
                totalInvoiceNetAmount: 0,
                totalInvoiceRetention: 0,
                totalInvoiceTotal: 0,
                totalPercentTotal: 0,
                CW: 0,
                POCW: 0,
                TELR: 0,
                LPCFP: 0,
                CPD: 0,
                BTFIR: 0,
                BTFIR1: 0
            };
        }

        function createChangeObj() {
            return {
                TCAa: 0,
                TCAd: 0,
                TATMa: 0,
                TATMd: 0,
                TOTALa: 0,
                TOTALd: 0,
                NCBCOT: 0
            };
        }

        function savePdfAndUpdateInvoice(options) {
            const invoiceId = options.invoiceId;
            const pdfFile = options.pdfFile;
            const templateFile = options.templateFile;
            const fileName = buildAiaPdfFileName(options.projectName, invoiceId);

            pdfFile.name = fileName;
            pdfFile.folder = '4891';
            pdfFile.isOnline = false;

            const fileId = pdfFile.save();

            record.submitFields({
                type: record.Type.INVOICE,
                id: invoiceId,
                values: {
                    [AIA_PDF_FIELD_ID]: fileId
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });

            log.audit('AIA PDF Saved On Invoice', {
                invoiceId: invoiceId,
                fileId: fileId,
                fileName: fileName,
                folder: pdfFile.folder,
                fieldId: AIA_PDF_FIELD_ID
            });

            return fileId;
        }

        function buildAiaPdfFileName(projectName, invoiceId) {
            const cleanProjectName = sanitizeFileName(projectName) || 'Invoice ' + invoiceId;
            return cleanProjectName + ' - _G702_G703.pdf';
        }

        function sanitizeFileName(value) {
            return safeString(value)
                .replace(/[\\/:*?"<>|#%{}~&]/g, '-')
                .replace(/\s+/g, ' ')
                .replace(/-+/g, '-')
                .trim();
        }

        function writeJson(response, payload) {
            response.setHeader({
                name: 'Content-Type',
                value: 'application/json'
            });
            response.write(JSON.stringify(payload));
        }

        function getProjectAddressHtml(projectId, invoiceRec) {
            const projectAddress = getProjectAddress(projectId);
            if (projectAddress.lines.length) {
                log.debug('AIA Project Address Found', {
                    projectId: projectId,
                    source: 'customrecord_bc_project_address',
                    lineCount: projectAddress.lines.length
                });
                return '<br />' + escapeXmlLines(projectAddress.lines);
            }

            const customerAddressLines = getInvoiceCustomerAddressLines(invoiceRec);
            log.debug('AIA Project Address Fallback', {
                projectId: projectId,
                source: 'invoice customer address without addressee',
                lineCount: customerAddressLines.length
            });

            return customerAddressLines.length ? '<br />' + escapeXmlLines(customerAddressLines) : '';
        }

        function getProjectAddress(projectId) {
            const address = {
                lines: []
            };

            if (!projectId) {
                return address;
            }

            const columns = {
                address1: search.createColumn({ name: 'custrecord_bc_address_address1' }),
                address2: search.createColumn({ name: 'custrecord_bc_address_address2' }),
                city: search.createColumn({ name: 'custrecord_bc_address_city' }),
                country: search.createColumn({ name: 'custrecord_bc_address_country' }),
                zip: search.createColumn({ name: 'custrecord_bc_address_zip' }),
                state: search.createColumn({ name: 'custrecord_bc_address_state' })
            };

            const projectAddressSearch = search.create({
                type: 'customrecord_bc_project_address',
                filters: [
                    ['custrecord_bc_address_project', 'anyof', projectId],
                    'AND',
                    ['isinactive', 'is', 'F'],
                    'AND',
                    ['custrecord_bc_address_type', 'anyof', '1']
                ],
                columns: [
                    columns.address1,
                    columns.address2,
                    columns.city,
                    columns.country,
                    columns.zip,
                    columns.state
                ]
            });

            const pagedData = projectAddressSearch.runPaged({ pageSize: 1 });
            log.debug('AIA Project Address Search Count', {
                projectId: projectId,
                count: pagedData.count
            });

            if (!pagedData.count) {
                return address;
            }

            projectAddressSearch.run().each(function (result) {
                address.lines = buildAddressLines({
                    address1: result.getValue(columns.address1),
                    address2: result.getValue(columns.address2),
                    city: result.getValue(columns.city),
                    state: result.getText(columns.state) || result.getValue(columns.state),
                    zip: result.getValue(columns.zip),
                    country: result.getText(columns.country) || result.getValue(columns.country)
                });

                return false;
            });

            return address;
        }

        function buildAddressLines(address) {
            const lines = [];
            const address1 = safeString(address.address1).trim();
            const address2 = safeString(address.address2).trim();
            const city = safeString(address.city).trim();
            const state = safeString(address.state).trim();
            const zip = safeString(address.zip).trim();
            const country = safeString(address.country).trim();
            const cityStateZip = [city, state, zip].filter(Boolean).join(' ');

            if (address1) {
                lines.push(address1);
            }
            if (address2) {
                lines.push(address2);
            }
            if (cityStateZip) {
                lines.push(cityStateZip);
            }
            if (country) {
                lines.push(country);
            }

            return lines;
        }

        function getInvoiceCustomerAddressLines(invoiceRec) {
            const structuredAddress = buildAddressLines({
                address1: getValue(invoiceRec, 'billaddr1'),
                address2: getValue(invoiceRec, 'billaddr2'),
                city: getValue(invoiceRec, 'billcity'),
                state: getValue(invoiceRec, 'billstate'),
                zip: getValue(invoiceRec, 'billzip'),
                country: getText(invoiceRec, 'billcountry')
            });

            if (structuredAddress.length) {
                return structuredAddress;
            }

            const addresseeCandidates = [
                getValue(invoiceRec, 'billaddressee'),
                getValue(invoiceRec, 'shipaddressee'),
                getText(invoiceRec, 'entity'),
                getValue(invoiceRec, 'entity')
            ];

            const fallbackAddressText = getValue(invoiceRec, 'billaddress') || getValue(invoiceRec, 'shipaddress');
            return removeAddresseeLine(splitAddressText(fallbackAddressText), addresseeCandidates);
        }

        function splitAddressText(addressText) {
            return safeString(addressText)
                .split(/\r\n|\r|\n/)
                .map(function (line) {
                    return line.trim();
                })
                .filter(Boolean);
        }

        function removeAddresseeLine(lines, addresseeCandidates) {
            if (!lines.length) {
                return lines;
            }

            const normalizedFirstLine = normalizeAddressLine(lines[0]);
            const normalizedCandidates = addresseeCandidates
                .map(normalizeAddressLine)
                .filter(Boolean);

            const matchesKnownAddressee = normalizedCandidates.some(function (candidate) {
                return candidate === normalizedFirstLine;
            });

            if (matchesKnownAddressee || looksLikeLeadingAddressee(lines)) {
                return lines.slice(1);
            }

            return lines;
        }

        function normalizeAddressLine(value) {
            return safeString(value)
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .replace(/[.,]/g, '')
                .trim();
        }

        function looksLikeLeadingAddressee(lines) {
            if (lines.length < 4) {
                return false;
            }

            return !looksLikeStreetAddress(lines[0]) && looksLikeStreetAddress(lines[1]);
        }

        function looksLikeStreetAddress(value) {
            const line = normalizeAddressLine(value);
            return /\d/.test(line) || /\b(p o box|po box|box|street|st|road|rd|avenue|ave|blvd|boulevard|drive|dr|lane|ln|court|ct|suite|ste|unit|highway|hwy|way|place|pl|circle|cir)\b/.test(line);
        }

        function escapeXmlLines(lines) {
            return lines.map(escapeXml).join('<br />');
        }

        function applyPlaceholders(html, values) {
            Object.keys(values).forEach(function (key) {
                html = html.replace(new RegExp('\\{\\{\\s*' + escapeRegExp(key) + '\\s*\\}\\}', 'g'), safeString(values[key]));
            });
            return html;
        }

        function normalizeTemplateXml(html) {
            let normalized = safeString(html);

            normalized = normalized.replace(/<#if\s+\.locale\s*==\s*["']fr_CA["']\s*>([\s\S]*?)<#else\s*>([\s\S]*?)<\/#if>/g, '$2');
            normalized = normalized.replace(/<#if\s+\.locale\s*==\s*["']fr_CA["']\s*>([\s\S]*?)<\/#if>/g, '');
            normalized = normalized.replace(/<#else\s*>/g, '');
            normalized = normalized.replace(/<\/#if>/g, '');
            normalized = normalized.replace(/&nbsp;/g, '&#160;');
            normalized = normalized.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9A-Fa-f]+);)/g, '&amp;');

            return normalized;
        }

        function findUnresolvedPlaceholders(html) {
            const matches = safeString(html).match(/\{\{\s*[^}]+?\s*\}\}/g) || [];
            const seen = {};
            const uniqueMatches = [];

            matches.forEach(function (match) {
                if (!seen[match]) {
                    seen[match] = true;
                    uniqueMatches.push(match);
                }
            });

            return uniqueMatches;
        }

        function removeUnresolvedPlaceholders(html) {
            return html.replace(/\{\{\s*[^}]+?\s*\}\}/g, '');
        }

        function escapeRegExp(value) {
            return safeString(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        function getValue(rec, fieldId) {
            try {
                return rec.getValue({ fieldId: fieldId });
            } catch (e) {
                log.debug('AIA getValue failed', {
                    fieldId: fieldId,
                    message: e && e.message ? e.message : safeString(e)
                });
                return '';
            }
        }

        function getText(rec, fieldId) {
            try {
                return rec.getText({ fieldId: fieldId }) || getValue(rec, fieldId);
            } catch (e) {
                log.debug('AIA getText fallback', {
                    fieldId: fieldId,
                    message: e && e.message ? e.message : safeString(e)
                });
                return getValue(rec, fieldId);
            }
        }

        function safeString(value) {
            return value === null || value === undefined ? '' : String(value);
        }

        function escapeXml(value) {
            return safeString(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        }

        function escapeXmlWithBreaks(value) {
            return escapeXml(value).replace(/\r\n|\r|\n/g, '<br />');
        }

        function toNumber(value) {
            if (value === null || value === undefined || value === '') {
                return 0;
            }
            const parsed = parseFloat(safeString(value).replace(/,/g, ''));
            return isFinite(parsed) ? parsed : 0;
        }

        function safePercent(numerator, denominator) {
            const denominatorNumber = toNumber(denominator);
            if (denominatorNumber === 0) {
                return 0;
            }
            return (toNumber(numerator) / denominatorNumber) * 100;
        }

        function formatNumber(val) {
            return toNumber(val).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }

        function formatDateForNetSuite(value) {
            if (!value) {
                return '';
            }

            if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
                return pad2(value.getMonth() + 1) + '/' + pad2(value.getDate()) + '/' + value.getFullYear();
            }

            const valueText = safeString(value);
            if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(valueText)) {
                return valueText;
            }

            const parsed = new Date(valueText);
            if (!isNaN(parsed.getTime())) {
                return pad2(parsed.getMonth() + 1) + '/' + pad2(parsed.getDate()) + '/' + parsed.getFullYear();
            }

            return valueText;
        }

        function getMonthYearParts(value) {
            const emptyParts = { month: '', year: '' };
            if (!value) {
                return emptyParts;
            }

            const parsed = parseDateValue(value);
            if (!parsed) {
                return {
                    month: safeString(value),
                    year: ''
                };
            }

            return {
                month: [
                    'January',
                    'February',
                    'March',
                    'April',
                    'May',
                    'June',
                    'July',
                    'August',
                    'September',
                    'October',
                    'November',
                    'December'
                ][parsed.getMonth()],
                year: String(parsed.getFullYear())
            };
        }

        function parseDateValue(value) {
            if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
                return value;
            }

            const valueText = safeString(value);
            const mmddyyyy = valueText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (mmddyyyy) {
                const parsedMmddyyyy = new Date(Number(mmddyyyy[3]), Number(mmddyyyy[1]) - 1, Number(mmddyyyy[2]));
                return isNaN(parsedMmddyyyy.getTime()) ? null : parsedMmddyyyy;
            }

            const parsed = new Date(valueText);
            return isNaN(parsed.getTime()) ? null : parsed;
        }

        function pad2(value) {
            return String(value).padStart(2, '0');
        }

        return { onRequest: onRequest };
    });
