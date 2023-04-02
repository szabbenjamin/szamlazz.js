declare module 'szamlazz.js' {
  // Type definitions for szamlazz.js
  // Definitions by: Gyorgy Zsapka

  // CLIENT
  interface InvoiceResponse {
    invoiceId: string
    netTotal: number
    grossTotal: number
    pdf: Buffer
    pdfBase64: string
  }

  interface ReceiptResponse {
    receiptId: string
    netTotal: number
    grossTotal: number
    pdf: Buffer
    pdfBase64: string
  }

  interface SendRequestResponse {
    headers: unknown
    data: unknown
    pdf: Buffer
    pdfBase64: string
  }

  interface ClientOptions {
    authToken: string
    eInvoice?: boolean
    requestInvoiceDownload?: boolean
    downloadedInvoiceCount?: number
    responseVersion?: Interface.ResponseVersion
  }

  interface GetInvoiceDataOptions {
    invoiceId?: string
    orderNumber?: string
    pdf: boolean
  }

  interface ReverseInvoiceOptions {
    invoiceId: string
    eInvoice: boolean
    requestInvoiceDownload: boolean
    responseVersion: Interface.ResponseVersion
  }

  interface GetReceiptDataOptions {
    receiptId: string
    pdf: boolean
  }

  class Client {
    constructor(options: ClientOptions)
    setRequestInvoiceDownload(value: boolean): void
    setResponseVersion(responseVersion: Interface.ResponseVersion): void

    // Invoice
    getInvoiceData(options: GetInvoiceDataOptions): Promise<SendRequestResponse>
    reverseInvoice(options: ReverseInvoiceOptions): Promise<InvoiceResponse>
    issueInvoice(invoice: Invoice): Promise<InvoiceResponse>
    _generateInvoiceXML(invoice: Invoice): string

    // Receipt
    getReceiptData(options: GetReceiptDataOptions): Promise<SendRequestResponse>
    issueReceipt(receipt: Receipt): Promise<ReceiptResponse>
    _generateReceiptXML(receipt: Receipt): string
  }

  // BUYER
  interface BuyerOptions {
    name: string
    country?: string
    zip: string
    city: string
    address: string
    taxNumber?: string,
    adoalany : number,
    postAddress?: {
      name: string
      zip: string
      city: string
      address: string
    }
    issuerName?: string
    identifier?: number
    phone?: string
    comment?: string
    email?: string
    sendEmail?: boolean
  }
  class Buyer {
    constructor(options: BuyerOptions)
    _generateXML(indentLevel: number): string
  }

  // SELLER
  interface SellerOptions {
    bank?: {
      name: string
      accountNumber: string
    }
    email?: {
      replyToAddress: string
      subject: string
      message: string
    }
    issuerName?: string
  }
  class Seller {
    constructor(options: SellerOptions)
    _generateXML(indentLevel: number): string
  }

  // INVOICE
  interface InvoiceOptions {
    issueDate?: Date
    fulfillmentDate?: Date
    dueDate?: Date
    paymentMethod: Interface.PaymentMethod
    currency: Interface.Currency
    language: Interface.Language
    exchangeRate?: number
    exchangeBank?: string
    seller: Seller
    buyer: Buyer
    items: Array<Item>
    orderNumber?: string
    proforma?: boolean
    invoiceIdPrefix?: string
    paid?: boolean
    comment?: string
    logoImage?: string
    prepaymentInvoice?: boolean
  }

  class Invoice {
    constructor(options: InvoiceOptions)
    _generateXML(indentLevel: number): string
  }

  interface ItemOptions {
    label: string
    quantity: number
    unit: string
    vat: number | 'TAM' | 'AAM' | 'EU' | 'EUK' | 'MAA' | 'ÁKK' // can be a number or a special string
    // vatValue: number
    netUnitPrice?: number // calculates gross and net values from per item net
    grossUnitPrice?: number // calculates gross and net values from per item net
    comment?: string
  }

  class Item {
    constructor(options: ItemOptions)
    _generateXML(indentLevel: number, currency: Interface.Currency): string
  }

  // RECEIPT
  interface ReceiptOptions {
    paymentMethod: Interface.PaymentMethod
    receiptNumberPrefix: string
    currency: Interface.Currency
    callId?: string
    exchangeRate?: number
    exchangeBank?: string
    comment?: string
    pdfTemplateId?: string
    pdfTemplte?: string
    ledgerId?: string
    items: Array<ReceiptItem>
  }

  class Receipt {
    constructor(options: ReceiptOptions)
    _generateXML(indentLevel: number): string
  }

  interface ReceiptItemOptions extends ItemOptions {
    receiptItemId?: string
  }

  class ReceiptItem {
    constructor(options: ReceiptItemOptions)
    _generateXML(indentLevel: number, currency: Interface.Currency): string
  }

  // CONSTANTS
  function setup(_module: any): any
  namespace Interface {
    class Currency {
      constructor(value: string, roundPriceExp: number, comment: string)
      value: string
      comment: string
      roundPriceExp: number
      toString(): string
    }
    class Language {
      constructor(value: string, name: string)
      value: string
      name: string
      toString(): string
    }
    class PaymentMethod {
      constructor(value: string, comment: string)
      value: string
      comment: string
      toString(): string
    }
    class ResponseVersion {
      constructor(value: number, comment: string)
      value: number
      comment: string
      toString(): string
    }
  }

  const Currency: {
    Ft: Interface.Currency
    HUF: Interface.Currency
    EUR: Interface.Currency
    CHF: Interface.Currency
    USD: Interface.Currency
    AUD: Interface.Currency
    AED: Interface.Currency
    BGN: Interface.Currency
    CAD: Interface.Currency
    CNY: Interface.Currency
    CZK: Interface.Currency
    DKK: Interface.Currency
    EEK: Interface.Currency
    GBP: Interface.Currency
    HRK: Interface.Currency
    ISK: Interface.Currency
    JPY: Interface.Currency
    LTL: Interface.Currency
    LVL: Interface.Currency
    NOK: Interface.Currency
    NZD: Interface.Currency
    PLN: Interface.Currency
    RON: Interface.Currency
    RUB: Interface.Currency
    SEK: Interface.Currency
    SKK: Interface.Currency
    UAH: Interface.Currency
  }
  const PaymentMethod: {
    Cash: Interface.PaymentMethod
    BankTransfer: Interface.PaymentMethod
    CreditCard: Interface.PaymentMethod
    PayPal: Interface.PaymentMethod
    Stripe: Interface.PaymentMethod
  }
  const Language: {
    Hungarian: Interface.Language
    English: Interface.Language
    German: Interface.Language
    Italian: Interface.Language
    Romanian: Interface.Language
    Slovak: Interface.Language
  }
  const ResponseVersion: {
    PlainTextOrPdf: Interface.ResponseVersion
    Xml: Interface.ResponseVersion
  }
}
