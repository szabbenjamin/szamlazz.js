'use strict'

const assert = require('assert')
const Constants = require('./Constants').setup()
const XMLUtils = require('./XMLUtils')
const ReceiptItem = require('./ReceiptItem')

const defaultOptions = {
  paymentMethod: Constants.PaymentMethod.CreditCard,
  currency: Constants.Currency.Ft,
  exchangeRate: 0,
  exchangeBank: ''
}

class Receipt {
  constructor(options) {
    this._options = {}
    this._options.paymentMethod = options.paymentMethod || defaultOptions.paymentMethod
    this._options.callId = options.callId
    this._options.receiptNumberPrefix = options.receiptNumberPrefix
    this._options.currency = options.currency || defaultOptions.currency
    this._options.exchangeRate = options.exchangeRate || defaultOptions.exchangeRate
    this._options.exchangeBank = options.exchangeBank || defaultOptions.exchangeBank
    this._options.comment = options.comment
    this._options.pdfTemplateId = options.pdfTemplateId
    this._options.ledgerId = options.ledgerId
    this._options.exchangeBank = options.exchangeBank
    this._options.exchangeRate = options.exchangeRate
    this._options.pdfTemplte = options.pdfTemplte
    this._options.items = options.items
  }

  _generateXML(indentLevel) {
    indentLevel = indentLevel || 0

    assert(
      this._options.paymentMethod instanceof Constants.Interface.PaymentMethod,
      'Valid PaymentMethod field missing from receipt options'
    )

    assert(
      typeof this._options.receiptNumberPrefix !== 'undefined' && this._options.receiptNumberPrefix !== '',
      'Valid ReceiptNumberPrefix field missing from receipt options'
    )

    assert(this._options.currency instanceof Constants.Interface.Currency, 'Valid Currency field missing from receipt options')

    assert(Array.isArray(this._options.items), 'Valid ReceiptItems array missing from receipt options')

    let o = XMLUtils.wrapWithElement(
      'fejlec',
      [
        ['fizmod', this._options.paymentMethod.value],
        ['elotag', this._options.receiptNumberPrefix],
        ['hivasAzonosito', this._options.callId],
        ['penznem', this._options.currency.value],
        ['megjegyzes', this._options.comment],
        ['pdfSablon', this._options.pdfTemplateId],
        ['fokonyvVevo', this._options.ledgerId],
        ['devizabank', this._options.exchangeBank],
        ['devizaarf', this._options.exchangeRate],
        ['devizaarf', this._options.pdfTemplte]
      ],
      indentLevel
    )

    o += XMLUtils.pad(indentLevel) + '<tetelek>\n'
    o += this._options.items
      .map((item) => {
        assert(item instanceof ReceiptItem, 'Element in items array is not an instance of the ReceiptItem class')
        return item._generateXML(indentLevel, this._options.currency)
      })
      .join('')
    o += XMLUtils.pad(indentLevel) + '</tetelek>\n'

    // TODO: create the optional kifizetesek node
    // if (this._options.paymentMethodDetails) {
    //   o += this._options.paymentMethodDetails._generateXML(indentLevel)
    // }

    return o
  }
}

module.exports = Receipt
