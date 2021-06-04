'use strict'

const assert = require('assert')
const merge = require('merge')
const XMLUtils = require('./XMLUtils')
const Constants = require('./Constants').setup()

// TODO: extract this logic becase it is the same as the one in the Item class
function round(value, exp) {
  if (exp < 1) {
    return Math.round(value)
  }

  const r = Math.pow(10, exp)

  return Math.round(value * r) / r
}

const defaultOptions = {
  quantity: 1,
  vatValue: 0
}

class ReceiptItem {
  constructor(options) {
    this._options = merge.recursive(true, defaultOptions, options || {})
  }

  _generateXML(indentLevel, currency) {
    assert(typeof this._options.label === 'string' && this._options.label.trim() !== '', 'Valid Label value missing from item options')

    assert(typeof this._options.quantity === 'number' && this._options.quantity !== 0, 'Valid Count value missing from item options')

    assert(typeof this._options.vat !== 'undefined' && this._options.vat !== '', 'Valid Vat Percentage value missing from item options')

    assert(currency instanceof Constants.Interface.Currency, 'Valid Currency field missing')

    // TODO: extract this logic becase it is the same as the one in the Item class
    if (typeof this._options.vat === 'number') {
      if (this._options.netUnitPrice) {
        this._options.netValue = round(this._options.netUnitPrice * this._options.quantity, currency.roundPriceExp)
        this._options.vatValue = round((this._options.netValue * this._options.vat) / 100, currency.roundPriceExp)
        this._options.grossValue = this._options.netValue + this._options.vatValue
      } else if (this._options.grossUnitPrice) {
        this._options.grossValue = round(this._options.grossUnitPrice * this._options.quantity, currency.roundPriceExp)
        this._options.vatValue = round((this._options.grossValue / (this._options.vat + 100)) * this._options.vat, currency.roundPriceExp)
        this._options.netValue = this._options.grossValue - this._options.vatValue
        this._options.netUnitPrice = round(this._options.netValue / this._options.quantity, 2)
      } else {
        throw new Error('Net or Gross Value is required for ReceiptItem price calculation')
      }
    } else if (typeof this._options.vat === 'string') {
      if (['TAM', 'AAM', 'EU', 'EUK', 'MAA', 'ÁKK'].includes(this._options.vat)) {
        if (this._options.netUnitPrice) {
          this._options.netValue = round(this._options.netUnitPrice * this._options.quantity, currency.roundPriceExp)
          this._options.vatValue = 0
          this._options.grossValue = this._options.netValue + this._options.vatValue
        } else if (this._options.grossUnitPrice) {
          this._options.grossValue = round(this._options.grossUnitPrice * this._options.quantity, currency.roundPriceExp)
          this._options.vatValue = 0
          this._options.netValue = this._options.grossValue - this._options.vatValue
          this._options.netUnitPrice = round(this._options.netValue / this._options.quantity, 2)
        } else {
          throw new Error('Net or Gross Value is required for ReceiptItem price calculation')
        }
      }
    }

    indentLevel = indentLevel || 0

    return XMLUtils.wrapWithElement(
      'tetel',
      [
        ['megnevezes', this._options.label],
        ['mennyiseg', this._options.quantity],
        ['mennyisegiEgyseg', this._options.unit],
        ['nettoEgysegar', this._options.netUnitPrice],
        ['afakulcs', this._options.vat],
        ['netto', this._options.netValue],
        ['afa', this._options.vatValue],
        ['brutto', this._options.grossValue],
        ['azonosito', this._options.receiptItemId]
        // TODO: [ 'fokonyv', this._options.ledger ]
      ],
      indentLevel
    )
  }
}
module.exports = ReceiptItem
