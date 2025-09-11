const functionRoutes = {
        coa: { name: 'Chart of Account', upload: 'upload-coa', convert: 'process-Coa', download: 'download-coa' },
        customer: { name: 'Customer', upload: 'upload-customer', convert: 'process-customer', download: 'download-customer' },
        supplier: { name: 'Supplier', upload: 'upload-supplier', convert: 'process-supplier', download: 'download-supplier' },
        class: { name: 'Class', upload: 'upload-class', convert: 'process-class', download: 'download-class' },
        items: { name: 'Items', upload: 'upload-item', convert: 'process-item', download: 'download-item' },
        openar: { name: 'Open Accounts Receivable (AR)', upload: 'upload-openar', convert: 'process-openar', download: 'download-openar' },
        openap: { name: 'Open Accounts Payable (AP)', upload: 'upload-openap', convert: 'process-openap', download: 'download-openap' },
        invoice: { name: 'Invoice', upload: 'upload-invoice', convert: 'process-invoice', download: 'download-invoice' },
        adjustmentnote: { name: 'Adjustment Note', upload: 'upload-adjustmentnote', convert: 'process-adjustmentnote', download: 'download-adjustmentnote' },
        bill: { name: 'Bill', upload: 'upload-bill', convert: 'process-bill', download: 'download-bill' },
        suppliercredit: { name: 'Supplier Credit', upload: 'upload-suppliercredit', convert: 'process-suppliercredit', download: 'download-suppliercredit' },
        cheque: { name: 'Cheque', upload: 'upload-cheque', convert: 'process-cheque', download: 'download-cheque' },
        deposit: { name: 'Deposit', upload: 'upload-deposit', convert: 'process-deposit', download: 'download-deposit' },
        journal: { name: 'Journal', upload: 'upload-journal', convert: 'process-journal', download: 'download-journal' },
        creditcardcharge: { name: 'Credit Card Charge (Expense)', upload: 'upload-creditcardcharge', convert: 'process-creditcardcharge', download: 'download-creditcardcharge' },
        transfer: { name: 'Transfer', upload: 'upload-transfer', convert: 'process-transfer', download: 'download-transfer' },
        billpayment: { name: 'Bill Payment', upload: 'upload-billpayment', convert: 'process-billpayment', download: 'download-billpayment' },
        invoicepayment: { name: 'Invoice Payment', upload: 'upload-invoicepayment', convert: 'process-invoicepayment', download: 'download-invoicepayment' },
        billpaymentcreditcard: { name: 'Bill Payment Credit Card', upload: 'upload-billpaymentcreditcard', convert: 'process-billpaymentcreditcard', download: 'download-billpaymentcreditcard' },
        openingbalance: { name: 'Opening Balance', upload: 'upload-openingbalance', convert: 'process-openingbalance', download: 'download-openingbalance' },
    };
    
    export default functionRoutes;
    