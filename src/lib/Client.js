'use strict'

const assert = require('assert')
const merge = require('merge')
const xml2js = require('xml2js')
const XMLUtils = require('./XMLUtils')
const axios = require('axios')
const FormData = require('form-data')
const Constants = require('./Constants').setup()

const xmlHeader =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
  'xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla xmlszamla.xsd">\n'

const xmlFooter = '</xmlszamla>'

const szamlazzURL = 'https://www.szamlazz.hu/szamla/'

const defaultOptions = {
  eInvoice: false,
  requestInvoiceDownload: false,
  downloadedInvoiceCount: 1,
  responseVersion: Constants.ResponseVersion.PlainTextOrPdf
}

class Client {
  _cookie
  constructor(options) {
    this._options = merge({}, defaultOptions, options || {})

    this.useToken = typeof this._options.authToken === 'string' && this._options.authToken.trim().length > 1

    if (!this.useToken) {
      assert(typeof this._options.user === 'string' && this._options.user.trim().length > 1, 'Valid User field missing form client options')

      assert(
        typeof this._options.password === 'string' && this._options.password.trim().length > 1,
        'Valid Password field missing form client options'
      )
    }
  }

  // TODO: test this
  async getInvoiceData(options) {
    const hasinvoiceId = typeof options.invoiceId === 'string' && options.invoiceId.trim().length > 1
    const hasOrderNumber = typeof options.orderNumber === 'string' && options.orderNumber.trim().length > 1
    assert.ok(hasinvoiceId || hasOrderNumber, 'Either invoiceId or orderNumber must be specified')

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n\
      <xmlszamlaxml xmlns="http://www.szamlazz.hu/xmlszamlaxml" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlaxml http://www.szamlazz.hu/docs/xsds/agentpdf/xmlszamlaxml.xsd">\n' +
      XMLUtils.wrapWithElement([
        ...this._getAuthFields(),
        ['szamlaszam', options.invoiceId],
        ['rendelesSzam', options.orderNumber],
        ['pdf', options.pdf]
      ]) +
      '</xmlszamlaxml>'

    return _sendRequest({ client: this, fileFieldName: 'action-szamla_agent_xml', xml, pdfInResponse: false, xmlResponse: true }).then(
      (xmlObj) => {
        return xmlObj.szamla
      }
    )
  }

  // TODO: test this
  reverseInvoice(options) {
    assert(typeof options.invoiceId === 'string' && options.invoiceId.trim().length > 1, 'invoiceId must be specified')
    assert(options.eInvoice !== undefined, 'eInvoice must be specified')
    assert(options.requestInvoiceDownload !== undefined, 'requestInvoiceDownload must be specified')

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n\
      <xmlszamlast xmlns="http://www.szamlazz.hu/xmlszamlast" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlast https://www.szamlazz.hu/szamla/docs/xsds/agentst/xmlszamlast.xsd">\n' +
      XMLUtils.wrapWithElement('beallitasok', [
        ...this._getAuthFields(),
        ['eszamla', String(options.eInvoice)],
        ['szamlaLetoltes', String(options.requestInvoiceDownload)]
      ]) +
      XMLUtils.wrapWithElement('fejlec', [
        ['szamlaszam', options.invoiceId],
        ['keltDatum', new Date()]
      ]) +
      '</xmlszamlast>'

    return _sendRequest({
      client: this,
      fileFieldName: 'action-szamla_agent_st',
      xml,
      pdfInResponse: this._options.requestInvoiceDownload
    }).then(({ headers, pdf }) => {
      const result = {
        invoiceId: headers.szlahu_szamlaszam,
        netTotal: headers.szlahu_nettovegosszeg,
        grossTotal: headers.szlahu_bruttovegosszeg
      }
      if (!!pdf) {
        return { ...result, pdf }
      }
      return result
      // let pdf = null
      // const contentType = httpResponse.headers['content-type']

      // if (contentType && contentType.indexOf('application/pdf') === 0) {
      //   pdf = httpResponse.body
      // }
    })
  }

  issueInvoice(invoice) {
    const xml = this._generateInvoiceXML(invoice)
    return _sendRequest({
      client: this,
      fileFieldName: 'action-xmlagentxmlfile',
      xml,
      pdfInResponse: this._options.requestInvoiceDownload
    }).then(({ headers, pdf }) => {
      const result = {
        invoiceId: headers.szlahu_szamlaszam,
        netTotal: headers.szlahu_nettovegosszeg,
        grossTotal: headers.szlahu_bruttovegosszeg
      }
      if (!!pdf) {
        return { ...result, pdf }
      }
      return result
    })
  }

  setRequestInvoiceDownload(value) {
    this._options.requestInvoiceDownload = value
  }

  setResponseVersion(value) {
    this._options.responseVersion = value
  }

  _getAuthFields() {
    let authFields = []

    if (this.useToken) {
      authFields = authFields.concat([['szamlaagentkulcs', this._options.authToken]])
    } else {
      authFields = authFields.concat([
        ['felhasznalo', this._options.user],
        ['jelszo', this._options.password]
      ])
    }

    return authFields
  }

  _generateInvoiceXML(invoice) {
    return (
      xmlHeader +
      XMLUtils.wrapWithElement(
        'beallitasok',
        [
          ...this._getAuthFields(),
          ['eszamla', this._options.eInvoice],
          ['kulcstartojelszo', this._options.passphrase],
          ['szamlaLetoltes', this._options.requestInvoiceDownload],
          ['szamlaLetoltesPld', this._options.downloadedInvoiceCount],
          ['valaszVerzio', this._options.responseVersion]
        ],
        1
      ) +
      invoice._generateXML(1) +
      xmlFooter
    )
  }

  // TODO: create a more elaborate way to store the cookies
}

const _sendRequest = async ({ client, fileFieldName, xml, xmlResponse = false, pdfInResponse = false }) => {
  const formData = new FormData()
  const options = {
    filename: 'request.xml',
    contentType: 'text/xml'
  }
  formData.append(fileFieldName, xml, options)

  const headers = formData.getHeaders()
  if (!!client._cookie) {
    headers.Cookie = client._cookie
  }

  let responseType = 'text'
  if (!xmlResponse && pdfInResponse) {
    responseType = 'arraybuffer'
  }

  const httpResponse = await axios.post(szamlazzURL, formData, { headers, responseType })

  client._cookie = httpResponse.headers['set-cookie']

  if (httpResponse.status !== 200) {
    throw new Error(`${httpResponse.status} ${httpResponse.statusText}`)
  }

  if (httpResponse.headers.szlahu_error_code) {
    const err = new Error(decodeURIComponent(httpResponse.headers.szlahu_error.replace(/\+/g, ' ')))
    err['code'] = httpResponse.headers.szlahu_error_code
    throw err
  }

  if (pdfInResponse) {
    if (xmlResponse) {
      const parsed = await XMLUtils.xml2obj(httpResponse.data, { 'xmlszamlavalasz.pdf': 'pdf' })
      return { ...httpResponse, pdf: Buffer.from(parsed.pdf, 'base64') }
    } else {
      return { ...httpResponse, pdf: httpResponse.data }
    }
  } else if (xmlResponse) {
    return await xml2js.parseStringPromise(httpResponse.data)
  } else {
    return httpResponse
  }
}

module.exports = Client
