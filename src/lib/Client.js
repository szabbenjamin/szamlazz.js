'use strict'

const assert = require('assert')
const merge = require('merge')
const xml2js = require('xml2js')
const XMLUtils = require('./XMLUtils')
const axios = require('axios')
const FormData = require('form-data')
const Constants = require('./Constants').setup()

const szamlazzURL = 'https://www.szamlazz.hu/szamla/'

const defaultOptions = {
  eInvoice: false,
  requestInvoiceDownload: false,
  downloadedInvoiceCount: 1,
  responseVersion: Constants.ResponseVersion.PlainTextOrPdf
}

class Client {
  constructor(options) {
    this.cookie = null
    this._options = merge({}, defaultOptions, options || {})

    this._useToken = typeof this._options.authToken === 'string' && this._options.authToken.trim().length > 1

    if (!this._useToken) {
      assert(typeof this._options.user === 'string' && this._options.user.trim().length > 1, 'Valid User field missing form client options')

      assert(
        typeof this._options.password === 'string' && this._options.password.trim().length > 1,
        'Valid Password field missing form client options'
      )
    }
  }

  getInvoiceData(options) {
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

    return _sendRequest({
      client: this,
      fileFieldName: 'action-szamla_agent_xml',
      xml,
      rootElementName: 'szamla',
      pdfInResponse: options.pdf,
      xmlResponse: true // Allways
    })
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
      rootElementName: 'xmlszamlavalasz',
      pdfInResponse: this._options.requestInvoiceDownload,
      xmlResponse: this._options.responseVersion.value === Constants.ResponseVersion.Xml.value
    }).then(({ headers, pdf, pdfBase64 }) => ({
      invoiceId: headers.szlahu_szamlaszam,
      netTotal: headers.szlahu_nettovegosszeg,
      grossTotal: headers.szlahu_bruttovegosszeg,
      pdf,
      pdfBase64
    }))
  }

  issueInvoice(invoice) {
    const xml = this._generateInvoiceXML(invoice)
    return _sendRequest({
      client: this,
      fileFieldName: 'action-xmlagentxmlfile',
      xml,
      rootElementName: 'xmlszamlavalasz',
      pdfInResponse: this._options.requestInvoiceDownload,
      xmlResponse: this._options.responseVersion.value === Constants.ResponseVersion.Xml.value
    }).then(({ headers, pdf, pdfBase64 }) => ({
      invoiceId: headers.szlahu_szamlaszam,
      netTotal: headers.szlahu_nettovegosszeg,
      grossTotal: headers.szlahu_bruttovegosszeg,
      pdf,
      pdfBase64
    }))
  }

  getReceiptData(options) {
    const hasReceiptId = typeof options.receiptId === 'string' && options.receiptId.trim().length > 1
    assert.ok(hasReceiptId, 'ReceiptId must be specified')

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n\
        <xmlnyugtaget xmlns="http://www.szamlazz.hu/xmlnyugtaget" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlnyugtaget http://www.szamlazz.hu/docs/xsds/agentpdf/xmlnyugtaget.xsd">\n' +
      XMLUtils.wrapWithElement('beallitasok', [...this._getAuthFields(), ['pdfLetoltes', options.pdf]], 1) +
      XMLUtils.wrapWithElement(
        'fejlec',
        [
          ['nyugtaszam', options.receiptId]
          // pdfSablon ???
        ],
        1
      ) +
      '</xmlnyugtaget>'

    return _sendRequest({
      client: this,
      fileFieldName: 'action-szamla_agent_nyugta_get',
      xml,
      rootElementName: 'xmlnyugtavalasz',
      pdfElementName: 'nyugtaPdf',
      pdfInResponse: options.pdf || false,
      xmlResponse: true // Allways
    })
  }

  issueReceipt(receipt) {
    const xml = this._generateReceiptXML(receipt)
    return _sendRequest({
      client: this,
      fileFieldName: 'action-szamla_agent_nyugta_create',
      xml,
      rootElementName: 'xmlnyugtavalasz',
      dataElementName: 'nyugta',
      pdfElementName: 'nyugtaPdf',
      pdfInResponse: this._options.requestReceiptDownload,
      xmlResponse: true // Allways
    }).then(({ data, pdf, pdfBase64 }) => {
      return {
        receiptId: data.alap[0].nyugtaszam[0],
        netTotal: data.osszegek[0].totalossz[0].netto[0],
        grossTotal: data.osszegek[0].totalossz[0].brutto[0],
        pdf,
        pdfBase64
      }
    })
  }

  setRequestInvoiceDownload(value) {
    this._options.requestInvoiceDownload = value
  }

  setResponseVersion(responseVersion) {
    this._options.responseVersion = responseVersion
  }

  _getAuthFields() {
    let authFields = []

    if (this._useToken) {
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
    const xmlHeader =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla xmlszamla.xsd">\n'

    const xmlFooter = '</xmlszamla>'

    return (
      xmlHeader +
      XMLUtils.wrapWithElement(
        'beallitasok',
        [
          ...this._getAuthFields(),
          ['eszamla', this._options.eInvoice],
          ['szamlaLetoltes', this._options.requestInvoiceDownload],
          ['szamlaLetoltesPld', this._options.downloadedInvoiceCount],
          ['valaszVerzio', this._options.responseVersion.value]
        ],
        1
      ) +
      invoice._generateXML(1) +
      xmlFooter
    )
  }

  _generateReceiptXML(receipt) {
    const xmlHeader =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<xmlnyugtacreate xmlns="http://www.szamlazz.hu/xmlnyugtacreate" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xsi:schemaLocation="http://www.szamlazz.hu/xmlnyugtacreate http://www.szamlazz.hu/docs/xsds/nyugta/xmlnyugtacreate.xsd">\n'

    const xmlFooter = '</xmlnyugtacreate>'

    return (
      xmlHeader +
      XMLUtils.wrapWithElement('beallitasok', [...this._getAuthFields(), ['pdfLetoltes', this._options.requestInvoiceDownload]], 1) +
      receipt._generateXML(1) +
      xmlFooter
    )
  }
}

// TODO: create a more elaborate way to store the cookies
const _sendRequest = async ({
  client,
  fileFieldName,
  xml,
  rootElementName,
  dataElementName = null,
  pdfElementName = 'pdf',
  xmlResponse = false,
  pdfInResponse = false
}) => {
  const formData = new FormData()
  const options = {
    filename: 'request.xml',
    contentType: 'text/xml'
  }
  formData.append(fileFieldName, xml, options)

  const requestHeaders = formData.getHeaders()
  if (!!client.cookie) {
    requestHeaders.Cookie = client.cookie
  }

  let responseType = 'text'
  if (!xmlResponse && pdfInResponse) {
    responseType = 'arraybuffer'
  }

  // Start the Request
  const httpResponse = await axios.post(szamlazzURL, formData, { headers: requestHeaders, responseType })

  // Store the new cookie for later usage
  if (!!httpResponse.headers['set-cookie']) {
    client.cookie = httpResponse.headers['set-cookie']
  }

  // Check for errors
  if (httpResponse.status !== 200) {
    throw new Error(`${httpResponse.status} ${httpResponse.statusText}`)
  }

  if (httpResponse.headers.szlahu_error_code) {
    const err = new Error(decodeURIComponent(httpResponse.headers.szlahu_error.replace(/\+/g, ' ')))
    err['code'] = httpResponse.headers.szlahu_error_code
    throw err
  }

  const headers = httpResponse.headers
  let data = httpResponse.data
  let pdf
  let pdfBase64

  // Process the response
  if (xmlResponse) {
    const { [rootElementName]: parsedXmlResponse } = await xml2js.parseStringPromise(httpResponse.data)

    // Check for errors in the XML response
    if (!!parsedXmlResponse.sikeres && parsedXmlResponse.sikeres[0] === 'false' && !!parsedXmlResponse.hibakod) {
      const err = new Error(parsedXmlResponse.hibauzenet[0])
      err['code'] = parsedXmlResponse.hibakod[0]
      throw err
    }

    if (!!dataElementName && !!parsedXmlResponse[dataElementName]) {
      data = parsedXmlResponse[dataElementName][0]
    } else {
      data = parsedXmlResponse
    }

    if (!!pdfElementName && !!parsedXmlResponse[pdfElementName]) {
      pdf = Buffer.from(parsedXmlResponse[pdfElementName][0], 'base64')
      pdfBase64 = parsedXmlResponse[pdfElementName][0]
    }
  } else if (pdfInResponse) {
    // PLAIN text with PDF
    data = undefined
    pdf = httpResponse.data
    pdfBase64 = Buffer(pdf).toString('base64')
  }
  return { headers, data, pdf, pdfBase64 }
}

module.exports = Client
